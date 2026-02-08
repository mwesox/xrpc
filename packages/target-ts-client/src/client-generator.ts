import type { ContractDefinition, Endpoint } from "@xrpckit/sdk";
import { TsBuilder } from "./ts-builder";

export class TsClientGenerator {
  private w: TsBuilder;

  constructor() {
    this.w = new TsBuilder();
  }

  generateClient(contract: ContractDefinition): string {
    const w = this.w.reset();

    // Import types - collect all unique imports
    const schemaImports = new Set<string>();
    const typeImports = new Set<string>();

    for (const ep of contract.endpoints) {
      schemaImports.add(this.getSchemaName(ep, "input"));
      schemaImports.add(this.getSchemaName(ep, "output"));
      typeImports.add(this.getTypeName(ep, "Input"));
      typeImports.add(this.getTypeName(ep, "Output"));
    }

    // Import schemas and types
    const allImports = [
      ...Array.from(schemaImports),
      ...Array.from(typeImports).map((t) => `type ${t}`),
    ];
    w.import("./types", allImports);
    w.import("zod", ["z"]);
    w.n();

    // Generate base client configuration interface
    this.generateClientConfig(w);
    w.n();

    // Generate base RPC call function
    this.generateCallRpcFunction(w);

    // Generate type-safe wrapper functions for each endpoint
    w.comment("=== Individual Functions (backward compatible) ===");
    w.n();
    for (const endpoint of contract.endpoints) {
      this.generateEndpointFunction(endpoint, w);
      w.n();
    }

    // Generate client factory
    w.comment("=== Client Factory ===");
    w.n();
    this.generateClientFactory(contract, w);

    return w.toString();
  }

  private bucketEndpoints(
    contract: ContractDefinition,
  ): { flat: Endpoint[]; groups: Record<string, Endpoint[]> } {
    const flat: Endpoint[] = [];
    const groups: Record<string, Endpoint[]> = {};

    for (const endpoint of contract.endpoints) {
      const { groupName } = this.getEndpointNameParts(endpoint);
      if (!groupName) {
        flat.push(endpoint);
        continue;
      }

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(endpoint);
    }

    return { flat, groups };
  }

  private generateClientFactory(
    contract: ContractDefinition,
    w: TsBuilder,
  ): void {
    const { flat, groups } = this.bucketEndpoints(contract);

    w.l("export function createClient(config: XRpcClientConfig) {");
    w.i();
    w.l("return {");
    w.i();
    const groupNames = Object.keys(groups);
    const totalProperties = flat.length + groupNames.length;
    let propertyIndex = 0;

    for (const endpoint of flat) {
      propertyIndex += 1;
      const isLastProperty = propertyIndex === totalProperties;
      const methodName = this.toCamelCase(endpoint.name);
      const functionName = this.getFunctionName(endpoint);
      const inputType = this.getTypeName(endpoint, "Input");

      w.l(
        `${methodName}: (input: ${inputType}, options?: { signal?: AbortSignal }) =>`,
      );
      w.i();
      w.l(
        `${functionName}(config, input, options)${isLastProperty ? "" : ","}`,
      );
      w.u();
    }

    for (let i = 0; i < groupNames.length; i++) {
      const groupName = groupNames[i];
      const endpoints = groups[groupName];
      propertyIndex += 1;
      const isLastProperty = propertyIndex === totalProperties;

      w.l(`${groupName}: {`);
      w.i();

      for (let j = 0; j < endpoints.length; j++) {
        const endpoint = endpoints[j];
        const { endpointName } = this.getEndpointNameParts(endpoint);
        const methodName = this.toCamelCase(endpointName);
        const functionName = this.getFunctionName(endpoint);
        const inputType = this.getTypeName(endpoint, "Input");
        const isLastEndpoint = j === endpoints.length - 1;

        w.l(
          `${methodName}: (input: ${inputType}, options?: { signal?: AbortSignal }) =>`,
        );
        w.i();
        w.l(
          `${functionName}(config, input, options)${isLastEndpoint ? "" : ","}`,
        );
        w.u();
      }

      w.u();
      w.l(`}${isLastProperty ? "" : ","}`);
    }

    w.u();
    w.l("};");
    w.u();
    w.l("}");
    w.n();

    w.l("export type ApiClient = ReturnType<typeof createClient>;");
    w.n();
  }

  private generateClientConfig(w: TsBuilder): void {
    w.interface("XRpcClientConfig", (b) => {
      b.l("baseUrl: string;")
        .l("validateInputs?: boolean;")
        .l("validateOutputs?: boolean;")
        .l("headers?: Record<string, string>;");
    });
  }

  private generateCallRpcFunction(w: TsBuilder): void {
    w.comment("Base RPC call function");
    w.n();
    w.asyncFunction(
      "callRpc<T>(config: XRpcClientConfig, method: string, params: unknown, options?: { inputSchema?: z.ZodType; outputSchema?: z.ZodType; signal?: AbortSignal })",
      (b) => {
        b.comment("Validate input if enabled");
        b.l("let validatedParams = params;");
        b.l("if (config.validateInputs !== false && options?.inputSchema) {");
        b.i().l("validatedParams = options.inputSchema.parse(params);");
        b.u().l("}").n();

        b.comment("Make HTTP request");
        b.l("const response = await fetch(config.baseUrl, {");
        b.i().l("method: 'POST',").l("headers: {");
        b.i().l("'Content-Type': 'application/json',").l("...config.headers,");
        b.u()
          .l("},")
          .l("body: JSON.stringify({ method, params: validatedParams }),")
          .l("signal: options?.signal,");
        b.u().l("});").n();

        b.comment("Handle errors");
        b.l("if (!response.ok) {");
        b.i()
          .l(
            "const error = await response.json().catch(() => ({ error: { message: response.statusText } }));",
          )
          .l(
            "throw new Error(error.error?.message || `RPC call failed: ${response.statusText}`);",
          );
        b.u().l("}").n();

        b.comment("Parse response");
        b.l("const result = await response.json();");
        b.comment("Handle JSON-RPC response format");
        b.l("if (result.error) {");
        b.i().l("throw new Error(result.error.message || result.error);");
        b.u().l("}");
        b.l("const data = result.result;").n();

        b.comment("Validate output if enabled");
        b.l("if (config.validateOutputs && options?.outputSchema) {");
        b.i().l("return options.outputSchema.parse(data);");
        b.u().l("}").n();

        b.l("return data;");
      },
    );
  }

  private generateEndpointFunction(endpoint: Endpoint, w: TsBuilder): void {
    const functionName = this.getFunctionName(endpoint);
    const inputType = this.getTypeName(endpoint, "Input");
    const outputType = this.getTypeName(endpoint, "Output");
    const inputSchema = this.getSchemaName(endpoint, "input");
    const outputSchema = this.getSchemaName(endpoint, "output");

    w.comment(`Type-safe wrapper for ${endpoint.fullName}`);
    w.l(`/** @xrpcEndpoint ${endpoint.fullName} */`);
    w.n();
    w.asyncFunction(
      `${functionName}(config: XRpcClientConfig, input: ${inputType}, options?: { signal?: AbortSignal })`,
      (b) => {
        b.l(`return callRpc<${outputType}>(`);
        b.i()
          .l("config,")
          .l(`'${endpoint.fullName}',`)
          .l("input,")
          .l("{")
          .i()
          .l(`inputSchema: ${inputSchema},`)
          .l(`outputSchema: ${outputSchema},`)
          .l("signal: options?.signal,")
          .u()
          .l("}")
          .u()
          .l(");");
      },
    );
  }

  private getFunctionName(endpoint: Endpoint): string {
    const { groupName, endpointName } = this.getEndpointNameParts(endpoint);
    if (!groupName) {
      return this.toCamelCase(endpointName);
    }

    return `${this.toCamelCase(groupName)}${this.toPascalCase(endpointName)}`;
  }

  private getSchemaName(
    endpoint: Endpoint,
    suffix: "input" | "output",
  ): string {
    const { groupName, endpointName } = this.getEndpointNameParts(endpoint);
    if (!groupName) {
      return `${this.toCamelCase(endpointName)}${this.toPascalCase(suffix)}Schema`;
    }

    return `${this.toCamelCase(groupName)}${this.toPascalCase(endpointName)}${this.toPascalCase(suffix)}Schema`;
  }

  private getTypeName(endpoint: Endpoint, suffix: "Input" | "Output"): string {
    const { groupName, endpointName } = this.getEndpointNameParts(endpoint);
    if (!groupName) {
      return `${this.toPascalCase(endpointName)}${suffix}`;
    }

    return `${this.toPascalCase(groupName)}${this.toPascalCase(endpointName)}${suffix}`;
  }

  private getEndpointNameParts(endpoint: Endpoint): {
    groupName?: string;
    endpointName: string;
  } {
    if (endpoint.groupName) {
      return { groupName: endpoint.groupName, endpointName: endpoint.name };
    }

    if (endpoint.name && endpoint.name === endpoint.fullName) {
      return { endpointName: endpoint.name };
    }

    const separator = endpoint.fullName.indexOf(".");
    if (separator === -1) {
      return { endpointName: endpoint.name || endpoint.fullName };
    }

    return {
      groupName: endpoint.fullName.slice(0, separator),
      endpointName: endpoint.name || endpoint.fullName.slice(separator + 1),
    };
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
