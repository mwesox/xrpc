import type { ContractDefinition, Endpoint } from "@xrpckit/sdk";
import { TsBuilder } from "./ts-builder";

export class TsServerGenerator {
  private w: TsBuilder;

  constructor() {
    this.w = new TsBuilder();
  }

  generateServer(contract: ContractDefinition): string {
    const w = this.w.reset();

    const schemaImports = new Set<string>();
    const typeImports = new Set<string>();

    for (const ep of contract.endpoints) {
      schemaImports.add(this.getSchemaName(ep, "input"));
      schemaImports.add(this.getSchemaName(ep, "output"));
      typeImports.add(this.getTypeName(ep, "Input"));
      typeImports.add(this.getTypeName(ep, "Output"));
    }

    const importItems = [
      ...Array.from(schemaImports),
      ...Array.from(typeImports).map((t) => `type ${t}`),
    ];

    w.import("./types", importItems);
    w.import("zod", ["ZodError"]);
    w.n();

    this.generateCoreTypes(w);
    this.generateHandlers(contract, w);
    this.generateSchemaMap(contract, w);
    this.generateErrorHelpers(w);
    this.generateRpcHandler(w);
    this.generateFetchHandler(w);

    return w.toString();
  }

  private generateCoreTypes(w: TsBuilder): void {
    w.type("RpcId", "string | number | null");
    w.n();

    w.type(
      "RpcErrorCode",
      "'INVALID_REQUEST' | 'METHOD_NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'INVALID_PARAMS' | 'INVALID_RESPONSE' | 'INTERNAL_ERROR'",
    );
    w.n();

    w.interface("RpcErrorPayload", (b) => {
      b.l("message: string;")
        .l("code?: RpcErrorCode;")
        .l("data?: unknown;");
    });

    w.interface("RpcRequest", (b) => {
      b.l("method: string;")
        .l("params?: unknown;")
        .l("id?: RpcId;")
        .l("jsonrpc?: string;");
    });

    w.interface("RpcResponse", (b) => {
      b.l("id?: RpcId;")
        .l("result?: unknown;")
        .l("error?: RpcErrorPayload;");
    });

    w.interface("RpcErrorFormatInput", (b) => {
      b.l("code: RpcErrorCode;")
        .l("message: string;")
        .l("error: unknown;");
    });

    w.interface("RpcHandlerOptions", (b) => {
      b.l("validateInputs?: boolean;")
        .l("validateOutputs?: boolean;")
        .l("formatError?: (input: RpcErrorFormatInput) => RpcErrorPayload;");
    });

    w.l("export interface FetchHandlerOptions<TContext = unknown> extends RpcHandlerOptions {")
      .i()
      .l("getContext?: (request: Request) => Promise<TContext> | TContext;")
      .u()
      .l("}")
      .n();

    w.type(
      "Handler<TInput, TOutput, TContext>",
      "(params: TInput, ctx: TContext) => Promise<TOutput> | TOutput",
    );
    w.n();
  }

  private generateHandlers(contract: ContractDefinition, w: TsBuilder): void {
    w.l("export interface Handlers<TContext = unknown> {")
      .i();

    for (const endpoint of contract.endpoints) {
      const inputType = this.getTypeName(endpoint, "Input");
      const outputType = this.getTypeName(endpoint, "Output");
      w.l(
        `"${endpoint.fullName}": Handler<${inputType}, ${outputType}, TContext>;`,
      );
    }

    w.u().l("}").n();
  }

  private generateSchemaMap(contract: ContractDefinition, w: TsBuilder): void {
    w.l("const schemaMap = {");
    w.i();
    for (const endpoint of contract.endpoints) {
      const inputSchemaName = this.getSchemaName(endpoint, "input");
      const outputSchemaName = this.getSchemaName(endpoint, "output");
      w.l(
        `"${endpoint.fullName}": { input: ${inputSchemaName}, output: ${outputSchemaName} },`,
      );
    }
    w.u();
    w.l("} as const;").n();

    w.type("SchemaMap", "typeof schemaMap");
    w.type("MethodName", "keyof SchemaMap");
    w.n();
  }

  private generateErrorHelpers(w: TsBuilder): void {
    w.l("function buildError(")
      .i()
      .l("code: RpcErrorCode,")
      .l("message: string,")
      .l("error: unknown,")
      .l("formatError?: (input: RpcErrorFormatInput) => RpcErrorPayload,")
      .u()
      .l("): RpcErrorPayload {")
      .i()
      .l("if (formatError) {")
      .i()
      .l("return formatError({ code, message, error });")
      .u()
      .l("}")
      .n()
      .l("if (error instanceof ZodError) {")
      .i()
      .l("return { code, message, data: error.flatten() };")
      .u()
      .l("}")
      .n()
      .l("if (error instanceof Error) {")
      .i()
      .l("return { code, message: error.message || message };")
      .u()
      .l("}")
      .n()
      .l("return { code, message, data: error };")
      .u()
      .l("}")
      .n();

    w.l("function mapErrorCodeToStatus(code?: RpcErrorCode): number {")
      .i()
      .l("switch (code) {")
      .i()
      .l("case 'METHOD_NOT_FOUND':")
      .i()
      .l("return 404;")
      .u()
      .l("case 'METHOD_NOT_ALLOWED':")
      .i()
      .l("return 405;")
      .u()
      .l("case 'INVALID_REQUEST':")
      .l("case 'INVALID_PARAMS':")
      .i()
      .l("return 400;")
      .u()
      .l("case 'INVALID_RESPONSE':")
      .l("case 'INTERNAL_ERROR':")
      .i()
      .l("return 500;")
      .u()
      .l("default:")
      .i()
      .l("return 500;")
      .u()
      .u()
      .l("}")
      .u()
      .l("}")
      .n();
  }

  private generateRpcHandler(w: TsBuilder): void {
    w.l("export function createRpcHandler<TContext = unknown>(")
      .i()
      .l("handlers: Handlers<TContext>,")
      .l("options: RpcHandlerOptions = {},")
      .u()
      .l(") {")
      .i()
      .l("const validateInputs = options.validateInputs !== false;")
      .l("const validateOutputs = options.validateOutputs !== false;")
      .l("const formatError = options.formatError;")
      .n()
      .l("return async (request: RpcRequest, context: TContext): Promise<RpcResponse> => {")
      .i()
      .l("const id = request?.id ?? null;")
      .l("if (!request || typeof request !== 'object') {")
      .i()
      .l(
        "return { id, error: buildError('INVALID_REQUEST', 'Invalid request', request, formatError) };",
      )
      .u()
      .l("}")
      .n()
      .l("const method = request.method;")
      .l("if (!method || typeof method !== 'string') {")
      .i()
      .l(
        "return { id, error: buildError('INVALID_REQUEST', 'Missing method', request, formatError) };",
      )
      .u()
      .l("}")
      .n()
      .l("const schemas = schemaMap[method as MethodName];")
      .l("const handler = handlers[method as keyof Handlers<TContext>];")
      .l("if (!schemas || !handler) {")
      .i()
      .l(
        "return { id, error: buildError('METHOD_NOT_FOUND', `Method not found: ${method}`, method, formatError) };",
      )
      .u()
      .l("}")
      .n()
      .l("let params = request.params ?? {};")
      .l("if (validateInputs) {")
      .i()
      .l("try {")
      .i()
      .l("params = schemas.input.parse(params);")
      .u()
      .l("} catch (error) {")
      .i()
      .l(
        "return { id, error: buildError('INVALID_PARAMS', 'Invalid params', error, formatError) };",
      )
      .u()
      .l("}")
      .u()
      .l("}")
      .n()
      .l("let result: unknown;")
      .l("try {")
      .i()
      .l("result = await handler(params as never, context);")
      .u()
      .l("} catch (error) {")
      .i()
      .l(
        "return { id, error: buildError('INTERNAL_ERROR', 'Handler error', error, formatError) };",
      )
      .u()
      .l("}")
      .n()
      .l("if (validateOutputs) {")
      .i()
      .l("try {")
      .i()
      .l("result = schemas.output.parse(result);")
      .u()
      .l("} catch (error) {")
      .i()
      .l(
        "return { id, error: buildError('INVALID_RESPONSE', 'Invalid response', error, formatError) };",
      )
      .u()
      .l("}")
      .u()
      .l("}")
      .n()
      .l("return { id, result };")
      .u()
      .l("};")
      .u()
      .l("}")
      .n();
  }

  private generateFetchHandler(w: TsBuilder): void {
    w.l("export function createFetchHandler<TContext = unknown>(")
      .i()
      .l("handlers: Handlers<TContext>,")
      .l("options: FetchHandlerOptions<TContext> = {},")
      .u()
      .l(") {")
      .i()
      .l("const { getContext, ...rpcOptions } = options;")
      .l("const handle = createRpcHandler(handlers, rpcOptions);")
      .n()
      .l("return async (request: Request): Promise<Response> => {")
      .i()
      .l("if (request.method !== 'POST') {")
      .i()
      .l(
        "return Response.json({ error: buildError('METHOD_NOT_ALLOWED', 'Method not allowed', request.method, options.formatError) }, { status: 405 });",
      )
      .u()
      .l("}")
      .n()
      .l("let payload: RpcRequest;")
      .l("try {")
      .i()
      .l("payload = (await request.json()) as RpcRequest;")
      .u()
      .l("} catch (error) {")
      .i()
      .l(
        "return Response.json({ error: buildError('INVALID_REQUEST', 'Invalid JSON', error, options.formatError) }, { status: 400 });",
      )
      .u()
      .l("}")
      .n()
      .l("const context = getContext ? await getContext(request) : (undefined as TContext);")
      .l("const response = await handle(payload, context);")
      .l("const status = response.error ? mapErrorCodeToStatus(response.error.code) : 200;")
      .l("return Response.json(response, { status });")
      .u()
      .l("};")
      .u()
      .l("}")
      .n();

    w.l("export const createBunHandler = createFetchHandler;").n();
  }

  private getSchemaName(
    endpoint: Endpoint,
    suffix: "input" | "output",
  ): string {
    const parts = endpoint.fullName.split(".");
    const groupName = this.toCamelCase(parts[0]);
    const endpointName = this.toCamelCase(parts[1]);
    return `${groupName}${this.toPascalCase(endpointName)}${this.toPascalCase(suffix)}Schema`;
  }

  private getTypeName(endpoint: Endpoint, suffix: "Input" | "Output"): string {
    const parts = endpoint.fullName.split(".");
    const groupName = this.toPascalCase(parts[0]);
    const endpointName = this.toPascalCase(parts[1]);
    return `${groupName}${endpointName}${suffix}`;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}
