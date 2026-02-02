import type { ContractDefinition, Endpoint } from "@xrpckit/sdk";
import { toPascalCase } from "@xrpckit/sdk";
import { SwiftBuilder } from "./swift-builder";
import { toLowerCamelCase } from "./utils";

export class SwiftClientGenerator {
  private w: SwiftBuilder;

  constructor() {
    this.w = new SwiftBuilder();
  }

  generateClient(contract: ContractDefinition): string {
    const w = this.w.reset();

    w.import("Foundation").n();

    this.generateJSONHelpers(w);
    w.n();
    this.generateConfig(w);
    w.n();
    this.generateErrorTypes(w);
    w.n();
    this.generateRequestResponseTypes(w);
    w.n();
    this.generateBaseClient(w);
    w.n();
    this.generateApiClient(contract, w);

    return w.toString();
  }

  private generateJSONHelpers(w: SwiftBuilder): void {
    w.mark("JSON Helpers");
    w.enum("XRPCJSON", [], (b) => {
      b.l("private static let iso8601WithFractional: ISO8601DateFormatter = {");
      b.i()
        .l("let formatter = ISO8601DateFormatter()")
        .l("formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]")
        .l("return formatter")
        .u()
        .l("}()")
        .n();

      b.l("private static let iso8601: ISO8601DateFormatter = {");
      b.i()
        .l("let formatter = ISO8601DateFormatter()")
        .l("formatter.formatOptions = [.withInternetDateTime]")
        .l("return formatter")
        .u()
        .l("}()")
        .n();

      b.l("public static func makeEncoder() -> JSONEncoder {");
      b.i()
        .l("let encoder = JSONEncoder()")
        .l("encoder.dateEncodingStrategy = .custom { date, encoder in")
        .i()
        .l("var container = encoder.singleValueContainer()")
        .l(
          "try container.encode(iso8601WithFractional.string(from: date))",
        )
        .u()
        .l("}")
        .l("return encoder")
        .u()
        .l("}")
        .n();

      b.l("public static func makeDecoder() -> JSONDecoder {");
      b.i()
        .l("let decoder = JSONDecoder()")
        .l("decoder.dateDecodingStrategy = .custom { decoder in")
        .i()
        .l("let container = try decoder.singleValueContainer()")
        .l("let value = try container.decode(String.self)")
        .l(
          "if let date = iso8601WithFractional.date(from: value) ?? iso8601.date(from: value) {",
        )
        .i()
        .l("return date")
        .u()
        .l("}")
        .l(
          "throw DecodingError.dataCorruptedError(in: container, debugDescription: \"Invalid ISO8601 date\")",
        )
        .u()
        .l("}")
        .l("return decoder")
        .u()
        .l("}");
    });
  }

  private generateConfig(w: SwiftBuilder): void {
    w.mark("Client Configuration");
    w.struct("XRPCClientConfig", [], (b) => {
      b.l("public var baseURL: URL")
        .l("public var headers: [String: String]")
        .l("public var session: URLSession")
        .l("public var encoder: JSONEncoder")
        .l("public var decoder: JSONDecoder")
        .n();

      b.l(
        "public init(baseURL: URL, headers: [String: String] = [:], session: URLSession = .shared, encoder: JSONEncoder? = nil, decoder: JSONDecoder? = nil) {",
      );
      b.i()
        .l("self.baseURL = baseURL")
        .l("self.headers = headers")
        .l("self.session = session")
        .l("self.encoder = encoder ?? XRPCJSON.makeEncoder()")
        .l("self.decoder = decoder ?? XRPCJSON.makeDecoder()")
        .u()
        .l("}");
    });
  }

  private generateErrorTypes(w: SwiftBuilder): void {
    w.mark("Error Types");

    w.struct("XRPCErrorObject", ["Decodable", "Equatable"], (b) => {
      b.l("public let message: String?")
        .l("public let error: String?")
        .l("public let errors: XRPCAny?")
        .l("public let data: XRPCAny?")
        .n()
        .l(
          "public init(message: String? = nil, error: String? = nil, errors: XRPCAny? = nil, data: XRPCAny? = nil) {",
        )
        .i()
        .l("self.message = message")
        .l("self.error = error")
        .l("self.errors = errors")
        .l("self.data = data")
        .u()
        .l("}");
    });

    w.n();

    w.struct("XRPCErrorPayload", ["Error", "Decodable", "Equatable"], (b) => {
      b.l("public let message: String")
        .l("public let details: XRPCAny?")
        .n()
        .l("public init(message: String, details: XRPCAny? = nil) {")
        .i()
        .l("self.message = message")
        .l("self.details = details")
        .u()
        .l("}")
        .n()
        .l("public init(from decoder: Decoder) throws {")
        .i()
        .l("let container = try decoder.singleValueContainer()")
        .l("if let value = try? container.decode(String.self) {")
        .i()
        .l("self.message = value")
        .l("self.details = nil")
        .l("return")
        .u()
        .l("}")
        .l("if let object = try? container.decode(XRPCErrorObject.self) {")
        .i()
        .l(
          "self.message = object.message ?? object.error ?? \"Unknown error\"",
        )
        .l("self.details = object.errors ?? object.data")
        .l("return")
        .u()
        .l("}")
        .l(
          "throw DecodingError.typeMismatch(XRPCErrorPayload.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: \"Invalid error payload\"))",
        )
        .u()
        .l("}");
    });

    w.n();

    w.enum("XRPCClientError", ["Error", "Equatable"], (b) => {
      b.l("case transport(String)")
        .l("case server(statusCode: Int, message: String)")
        .l("case rpc(XRPCErrorPayload)")
        .l("case decoding(String)")
        .l("case invalidResponse(String)");
    });
  }

  private generateRequestResponseTypes(w: SwiftBuilder): void {
    w.mark("Request/Response");

    w.struct("XRPCRequest<Params: Encodable>", ["Encodable"], (b) => {
      b.l("public let method: String")
        .l("public let params: Params")
        .n()
        .l("public init(method: String, params: Params) {")
        .i()
        .l("self.method = method")
        .l("self.params = params")
        .u()
        .l("}");
    });

    w.n();

    w.struct("XRPCResponse<Result: Decodable>", ["Decodable"], (b) => {
      b.l("public let result: Result?")
        .l("public let error: XRPCErrorPayload?")
        .n()
        .l("public init(result: Result? = nil, error: XRPCErrorPayload? = nil) {")
        .i()
        .l("self.result = result")
        .l("self.error = error")
        .u()
        .l("}");
    });
  }

  private generateBaseClient(w: SwiftBuilder): void {
    w.mark("Base Client");
    w.struct("XRPCClient", [], (b) => {
      b.l("public let config: XRPCClientConfig")
        .n()
        .l("public init(config: XRPCClientConfig) {")
        .i()
        .l("self.config = config")
        .u()
        .l("}")
        .n();

      b.l(
        "public func call<Params: Encodable, Result: Decodable>(_ method: String, params: Params) async throws -> Result {",
      );
      b.i();
      b.l("var request = URLRequest(url: config.baseURL)")
        .l("request.httpMethod = \"POST\"")
        .l(
          "request.setValue(\"application/json\", forHTTPHeaderField: \"Content-Type\")",
        )
        .l("for (key, value) in config.headers { request.setValue(value, forHTTPHeaderField: key) }")
        .n();

      b.l("let payload = XRPCRequest(method: method, params: params)")
        .l("request.httpBody = try config.encoder.encode(payload)")
        .n();

      b.l("let data: Data")
        .l("let response: URLResponse")
        .l("do {")
        .i()
        .l("(data, response) = try await config.session.data(for: request)")
        .u()
        .l("} catch {")
        .i()
        .l("throw XRPCClientError.transport(error.localizedDescription)")
        .u()
        .l("}")
        .n();

      b.l("guard let httpResponse = response as? HTTPURLResponse else {")
        .i()
        .l("throw XRPCClientError.invalidResponse(\"No HTTP response\")")
        .u()
        .l("}")
        .n();

      b.l("let statusCode = httpResponse.statusCode")
        .l("let envelope: XRPCResponse<Result>")
        .l("do {")
        .i()
        .l(
          "envelope = try config.decoder.decode(XRPCResponse<Result>.self, from: data)",
        )
        .u()
        .l("} catch {")
        .i()
        .l("if !(200...299).contains(statusCode) {")
        .i()
        .l(
          "let message = String(data: data, encoding: .utf8) ?? HTTPURLResponse.localizedString(forStatusCode: statusCode)",
        )
        .l("throw XRPCClientError.server(statusCode: statusCode, message: message)")
        .u()
        .l("}")
        .l("throw XRPCClientError.decoding(error.localizedDescription)")
        .u()
        .l("}")
        .n();

      b.l("if let error = envelope.error {")
        .i()
        .l("throw XRPCClientError.rpc(error)")
        .u()
        .l("}")
        .n();

      b.l("if !(200...299).contains(statusCode) {")
        .i()
        .l(
          "let message = String(data: data, encoding: .utf8) ?? HTTPURLResponse.localizedString(forStatusCode: statusCode)",
        )
        .l("throw XRPCClientError.server(statusCode: statusCode, message: message)")
        .u()
        .l("}")
        .n();

      b.l("if let result = envelope.result {")
        .i()
        .l("return result")
        .u()
        .l("}")
        .n();

      b.l("if Result.self == XRPCEmpty.self {")
        .i()
        .l("return XRPCEmpty() as! Result")
        .u()
        .l("}")
        .n();

      b.l("throw XRPCClientError.invalidResponse(\"Missing result\")");

      b.u();
      b.l("}");
    });
  }

  private generateApiClient(contract: ContractDefinition, w: SwiftBuilder): void {
    w.mark("API Client");

    const groups = this.groupEndpointsByGroup(contract);
    const groupNames = Object.keys(groups);

    w.struct("ApiClient", [], (b) => {
      b.l("private let client: XRPCClient")
        .n()
        .l("public init(config: XRPCClientConfig) {")
        .i()
        .l("self.client = XRPCClient(config: config)")
        .u()
        .l("}")
        .n();

      groupNames.forEach((groupName) => {
        const groupStructName = toPascalCase(groupName);
        const propertyName = toLowerCamelCase(groupName);
        b.l(`public var ${propertyName}: ${groupStructName}Client {`);
        b.i();
        b.l(`${groupStructName}Client(client: client)`);
        b.u();
        b.l("}");
        b.n();
      });

      groupNames.forEach((groupName, idx) => {
        const groupStructName = toPascalCase(groupName);
        const endpoints = groups[groupName];
        b.l(`public struct ${groupStructName}Client {`);
        b.i();
        b.l("private let client: XRPCClient")
          .n()
          .l("public init(client: XRPCClient) {")
          .i()
          .l("self.client = client")
          .u()
          .l("}")
          .n();

        endpoints.forEach((endpoint) => {
          const methodName = toLowerCamelCase(endpoint.name);
          const inputType = this.getTypeName(endpoint.input.name);
          const outputType = this.getTypeName(endpoint.output.name);
          b.l(
            `public func ${methodName}(_ input: ${inputType}) async throws -> ${outputType} {`,
          );
          b.i();
          b.l(
            `try await client.call(\"${endpoint.fullName}\", params: input)`,
          );
          b.u();
          b.l("}");
          b.n();
        });

        b.u();
        b.l("}");
        if (idx < groupNames.length - 1) {
          b.n();
        }
      });
    });
  }

  private groupEndpointsByGroup(
    contract: ContractDefinition,
  ): Record<string, Endpoint[]> {
    const groups: Record<string, Endpoint[]> = {};

    for (const endpoint of contract.endpoints) {
      const [groupName] = endpoint.fullName.split(".");
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(endpoint);
    }

    return groups;
  }

  private getTypeName(name?: string): string {
    return name ? toPascalCase(name) : "XRPCAny";
  }
}
