import { dirname, relative } from "node:path";
import type { ContractDefinition, Endpoint } from "@xrpckit/sdk";
import { TsBuilder } from "./ts-builder";

export class TsTypeGenerator {
  private w: TsBuilder;
  private contractPath: string;
  private outputDir: string;

  constructor(contractPath: string, outputDir: string) {
    this.w = new TsBuilder();
    this.contractPath = contractPath;
    this.outputDir = outputDir;
  }

  generateTypes(contract: ContractDefinition): string {
    const w = this.w.reset();

    // Calculate relative path from output directory to contract file
    const relativePath = this.calculateRelativePath(
      this.contractPath,
      this.outputDir,
    );

    // Import router from original contract file
    w.import(relativePath, ["router"]);
    w.import("xrpckit", ["type InferInput", "type InferOutput"]);
    w.n();

    // Generate schema exports and type aliases for each endpoint
    for (const endpoint of contract.endpoints) {
      this.generateEndpointTypes(endpoint, w);
    }

    return w.toString();
  }

  private generateEndpointTypes(endpoint: Endpoint, w: TsBuilder): void {
    const inputSchemaName = this.getSchemaName(endpoint, "input");
    const outputSchemaName = this.getSchemaName(endpoint, "output");
    const inputTypeName = this.getTypeName(endpoint, "Input");
    const outputTypeName = this.getTypeName(endpoint, "Output");
    const routerPath = this.getRouterPath(endpoint);

    // Export schemas and types for this endpoint (grouped together)
    w.const(inputSchemaName, `${routerPath}.input`, true);
    w.const(outputSchemaName, `${routerPath}.output`, true);
    w.type(inputTypeName, `InferInput<typeof ${routerPath}>`);
    w.type(outputTypeName, `InferOutput<typeof ${routerPath}>`);
    w.n();
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

  private getRouterPath(endpoint: Endpoint): string {
    const sourcePath = endpoint.sourcePath ?? endpoint.fullName;
    return `router${this.toPropertyAccess(sourcePath)}`;
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

  private toPropertyAccess(path: string): string {
    return path
      .split(".")
      .filter((segment) => segment.length > 0)
      .map((segment) =>
        this.isValidIdentifier(segment)
          ? `.${segment}`
          : `[${JSON.stringify(segment)}]`,
      )
      .join("");
  }

  private isValidIdentifier(value: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(value);
  }

  private calculateRelativePath(
    contractPath: string,
    outputDir: string,
  ): string {
    // Remove .ts extension and calculate relative path
    const contractPathWithoutExt = contractPath.replace(/\.ts$/, "");
    const contractDir = dirname(contractPathWithoutExt);
    const contractFile = contractPathWithoutExt.split("/").pop() || "api";

    // Calculate relative path from output directory to contract directory
    const relativePath = relative(outputDir, contractDir);

    // Handle same directory case
    if (relativePath === "" || relativePath === ".") {
      return `./${contractFile}`;
    }

    // Construct import path - ensure it starts with ./
    const normalizedPath = relativePath.startsWith(".")
      ? relativePath
      : `./${relativePath}`;
    return `${normalizedPath}/${contractFile}`;
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
