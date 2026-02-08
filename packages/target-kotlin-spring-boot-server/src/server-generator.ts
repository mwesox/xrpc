import type { ContractDefinition } from "@xrpckit/sdk";
import { KotlinBuilder } from "./kotlin-builder";
import type { EndpointTypeInfo } from "./type-generator";
import { endpointFunctionName, escapeKotlinString } from "./utils";

export class KotlinServerGenerator {
  private readonly w = new KotlinBuilder();

  constructor(private readonly packageRoot = "xrpc.generated") {}

  generateHandlers(
    contract: ContractDefinition,
    endpointTypes: Record<string, EndpointTypeInfo>,
  ): string {
    const w = this.w.reset();

    const typeImports = new Set<string>();
    for (const endpoint of contract.endpoints) {
      const types = endpointTypes[endpoint.fullName];
      if (types) {
        typeImports.add(types.inputType);
        typeImports.add(types.outputType);
      }
    }

    w.package(`${this.packageRoot}.rpc.server`);
    if (typeImports.size > 0) {
      w.imports(
        ...Array.from(typeImports)
          .sort()
          .map((typeName) => `${this.packageRoot}.rpc.types.${typeName}`),
      );
    }

    w.l("interface Handlers {").i();

    for (const endpoint of contract.endpoints) {
      const endpointType = endpointTypes[endpoint.fullName];
      if (!endpointType) continue;

      w.l(
        `fun ${endpointFunctionName(endpoint.fullName)}(params: ${endpointType.inputType}): ${endpointType.outputType}`,
      );
    }

    w.u().l("}");

    return w.toString();
  }

  generateDispatcher(
    contract: ContractDefinition,
    endpointTypes: Record<string, EndpointTypeInfo>,
  ): string {
    const w = this.w.reset();

    const typeImports = new Set<string>();
    for (const endpoint of contract.endpoints) {
      const types = endpointTypes[endpoint.fullName];
      if (types) {
        typeImports.add(types.inputType);
      }
    }

    w.package(`${this.packageRoot}.rpc.server`);
    w.imports(
      "com.fasterxml.jackson.core.type.TypeReference",
      "com.fasterxml.jackson.databind.JsonNode",
      "com.fasterxml.jackson.databind.ObjectMapper",
      "jakarta.validation.Validator",
      `${this.packageRoot}.rpc.model.DispatchResult`,
      `${this.packageRoot}.rpc.model.RpcErrorCode`,
      `${this.packageRoot}.rpc.model.RpcErrorPayload`,
      `${this.packageRoot}.rpc.model.RpcRequest`,
      `${this.packageRoot}.rpc.model.RpcResponse`,
    );

    if (typeImports.size > 0) {
      w.imports(
        ...Array.from(typeImports)
          .sort()
          .map((typeName) => `${this.packageRoot}.rpc.types.${typeName}`),
      );
    }

    w.l("class XrpcDispatcher(").i();
    w.l("private val handlers: Handlers,");
    w.l("private val objectMapper: ObjectMapper,");
    w.l("private val validator: Validator,");
    w.u().l(") {").i();

    w.l("fun handle(request: RpcRequest): DispatchResult {").i();
    w.l("val method = request.method");
    w.l("if (method.isNullOrBlank()) {").i();
    w.l('return invalidRequest(request.id, "Missing method")');
    w.u().l("}");

    w.l("return try {").i();
    w.l("when (method) {").i();
    for (const endpoint of contract.endpoints) {
      const fn = endpointFunctionName(endpoint.fullName);
      const caseFn = `handle${fn.charAt(0).toUpperCase()}${fn.slice(1)}`;
      w.l(`\"${escapeKotlinString(endpoint.fullName)}\" -> ${caseFn}(request)`);
    }
    w.l("else -> methodNotFound(request.id, method)");
    w.u().l("}");
    w.u().l("} catch (error: IllegalArgumentException) {").i();
    w.l('invalidParams(request.id, error.message ?: "Invalid params")');
    w.u().l("} catch (error: Exception) {").i();
    w.l('internalError(request.id, error.message ?: "Internal error")');
    w.u().l("}");
    w.u().l("}").n();

    for (const endpoint of contract.endpoints) {
      const types = endpointTypes[endpoint.fullName];
      if (!types) continue;

      const fn = endpointFunctionName(endpoint.fullName);
      const caseFn = `handle${fn.charAt(0).toUpperCase()}${fn.slice(1)}`;
      w.l(`private fun ${caseFn}(request: RpcRequest): DispatchResult {`).i();
      w.l(`val params = convertParams<${types.inputType}>(request.params)`);
      w.l("val inputViolations = validate(params)");
      w.l("if (inputViolations.isNotEmpty()) {").i();
      w.l(
        'return invalidParams(request.id, "Validation failed", inputViolations)',
      );
      w.u().l("}");
      w.l(`val result = handlers.${fn}(params)`);
      w.l("val outputViolations = validate(result)");
      w.l("if (outputViolations.isNotEmpty()) {").i();
      w.l(
        'return invalidResponse(request.id, "Response validation failed", outputViolations)',
      );
      w.u().l("}");
      w.l(
        "return DispatchResult(200, RpcResponse(id = request.id, result = objectMapper.valueToTree(result)))",
      );
      w.u().l("}").n();
    }

    w.l(
      "private inline fun <reified T> convertParams(params: JsonNode?): T {",
    ).i();
    w.l("val payload = params ?: objectMapper.createObjectNode()");
    w.l(
      "return objectMapper.convertValue(payload, object : TypeReference<T>() {})",
    );
    w.u().l("}").n();

    w.l("private fun validate(value: Any?): List<String> {").i();
    w.l("if (value == null) return emptyList()");
    w.l("return validator.validate(value).map { violation ->").i();
    w.l('"${violation.propertyPath}: ${violation.message}"');
    w.u().l("}");
    w.u().l("}").n();

    w.l(
      "private fun invalidRequest(id: JsonNode?, message: String, data: Any? = null): DispatchResult =",
    ).i();
    w.l(
      "DispatchResult(400, RpcResponse(id = id, error = RpcErrorPayload(code = RpcErrorCode.INVALID_REQUEST, message = message, data = toJsonNode(data))))",
    );
    w.u().n();

    w.l(
      "private fun methodNotFound(id: JsonNode?, method: String): DispatchResult =",
    ).i();
    w.l(
      'DispatchResult(404, RpcResponse(id = id, error = RpcErrorPayload(code = RpcErrorCode.METHOD_NOT_FOUND, message = "Method not found: $method")))',
    );
    w.u().n();

    w.l(
      "private fun invalidParams(id: JsonNode?, message: String, data: Any? = null): DispatchResult =",
    ).i();
    w.l(
      "DispatchResult(400, RpcResponse(id = id, error = RpcErrorPayload(code = RpcErrorCode.INVALID_PARAMS, message = message, data = toJsonNode(data))))",
    );
    w.u().n();

    w.l(
      "private fun invalidResponse(id: JsonNode?, message: String, data: Any? = null): DispatchResult =",
    ).i();
    w.l(
      "DispatchResult(500, RpcResponse(id = id, error = RpcErrorPayload(code = RpcErrorCode.INVALID_RESPONSE, message = message, data = toJsonNode(data))))",
    );
    w.u().n();

    w.l(
      "private fun internalError(id: JsonNode?, message: String): DispatchResult =",
    ).i();
    w.l(
      "DispatchResult(500, RpcResponse(id = id, error = RpcErrorPayload(code = RpcErrorCode.INTERNAL_ERROR, message = message)))",
    );
    w.u().n();

    w.l("private fun toJsonNode(value: Any?): JsonNode? =").i();
    w.l("if (value == null) null else objectMapper.valueToTree(value)");
    w.u();

    w.u().l("}");

    return w.toString();
  }

  generateController(): string {
    const w = this.w.reset();

    w.package(`${this.packageRoot}.rpc.server`);
    w.imports(
      `${this.packageRoot}.rpc.model.RpcResponse`,
      `${this.packageRoot}.rpc.model.RpcRequest`,
      "org.springframework.http.ResponseEntity",
      "org.springframework.web.bind.annotation.PostMapping",
      "org.springframework.web.bind.annotation.RequestBody",
      "org.springframework.web.bind.annotation.RequestMapping",
      "org.springframework.web.bind.annotation.RestController",
    );

    w.l("@RestController");
    w.l('@RequestMapping("${xrpc.path:/rpc}")');
    w.l("class XrpcController(private val dispatcher: XrpcDispatcher) {").i();
    w.l("@PostMapping");
    w.l(
      "fun handle(@RequestBody request: RpcRequest): ResponseEntity<RpcResponse> {",
    ).i();
    w.l("val result = dispatcher.handle(request)");
    w.l("return ResponseEntity.status(result.status).body(result.response)");
    w.u().l("}");
    w.u().l("}");

    return w.toString();
  }

  generateModels(): string {
    const w = this.w.reset();

    w.package(`${this.packageRoot}.rpc.model`);
    w.imports(
      "com.fasterxml.jackson.annotation.JsonInclude",
      "com.fasterxml.jackson.databind.JsonNode",
    );

    w.l("enum class RpcErrorCode {").i();
    w.l("INVALID_REQUEST,");
    w.l("METHOD_NOT_FOUND,");
    w.l("METHOD_NOT_ALLOWED,");
    w.l("INVALID_PARAMS,");
    w.l("INVALID_RESPONSE,");
    w.l("INTERNAL_ERROR");
    w.u().l("}").n();

    w.l("@JsonInclude(JsonInclude.Include.NON_NULL)");
    w.l("data class RpcRequest(").i();
    w.l("val method: String? = null,");
    w.l("val params: JsonNode? = null,");
    w.l("val id: JsonNode? = null,");
    w.l("val jsonrpc: String? = null,");
    w.u().l(")").n();

    w.l("@JsonInclude(JsonInclude.Include.NON_NULL)");
    w.l("data class RpcErrorPayload(").i();
    w.l("val code: RpcErrorCode,");
    w.l("val message: String,");
    w.l("val data: JsonNode? = null,");
    w.u().l(")").n();

    w.l("@JsonInclude(JsonInclude.Include.NON_NULL)");
    w.l("data class RpcResponse(").i();
    w.l("val id: JsonNode? = null,");
    w.l("val result: JsonNode? = null,");
    w.l("val error: RpcErrorPayload? = null,");
    w.u().l(")").n();

    w.l("data class DispatchResult(").i();
    w.l("val status: Int,");
    w.l("val response: RpcResponse,");
    w.u().l(")");

    return w.toString();
  }
}
