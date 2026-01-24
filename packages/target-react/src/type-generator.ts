import { ReactBuilder } from './react-builder';
import type { ContractDefinition, Endpoint } from '@xrpc/parser';
import { relative, dirname } from 'node:path';

export class ReactTypeGenerator {
  private w: ReactBuilder;
  private contractPath: string;
  private outputDir: string;

  constructor(contractPath: string, outputDir: string) {
    this.w = new ReactBuilder();
    this.contractPath = contractPath;
    this.outputDir = outputDir;
  }

  generateTypes(contract: ContractDefinition): string {
    const w = this.w.reset();

    // Calculate relative path from output directory to contract file
    const relativePath = this.calculateRelativePath(this.contractPath, this.outputDir);

    // Import router from original contract file
    w.import(relativePath, ['router']);
    w.import('@xrpc/core', ['type InferInput', 'type InferOutput']);
    w.n();

    // Generate schema exports and type aliases for each endpoint
    for (const endpoint of contract.endpoints) {
      this.generateEndpointTypes(endpoint, w);
    }

    return w.toString();
  }

  private generateEndpointTypes(endpoint: Endpoint, w: ReactBuilder): void {
    const inputSchemaName = this.getSchemaName(endpoint, 'input');
    const outputSchemaName = this.getSchemaName(endpoint, 'output');
    const inputTypeName = this.getTypeName(endpoint, 'Input');
    const outputTypeName = this.getTypeName(endpoint, 'Output');

    // Extract group and endpoint names from fullName (e.g., "greeting.greet")
    const [groupName, endpointName] = endpoint.fullName.split('.');

    const routerPath = `router.${groupName}.${endpointName}`;

    // Export input schema
    w.const(inputSchemaName, `${routerPath}.input`, true);

    // Export output schema
    w.const(outputSchemaName, `${routerPath}.output`, true);

    // Generate type aliases using utility types
    w.type(inputTypeName, `InferInput<typeof ${routerPath}>`);
    w.type(outputTypeName, `InferOutput<typeof ${routerPath}>`);
    w.n();
  }

  private getSchemaName(endpoint: Endpoint, suffix: 'input' | 'output'): string {
    const parts = endpoint.fullName.split('.');
    const groupName = this.toCamelCase(parts[0]);
    const endpointName = this.toCamelCase(parts[1]);
    return `${groupName}${this.toPascalCase(endpointName)}${this.toPascalCase(suffix)}Schema`;
  }

  private getTypeName(endpoint: Endpoint, suffix: 'Input' | 'Output'): string {
    const parts = endpoint.fullName.split('.');
    const groupName = this.toPascalCase(parts[0]);
    const endpointName = this.toPascalCase(parts[1]);
    return `${groupName}${endpointName}${suffix}`;
  }

  private calculateRelativePath(contractPath: string, outputDir: string): string {
    // Remove .ts extension and calculate relative path
    const contractPathWithoutExt = contractPath.replace(/\.ts$/, '');
    const contractDir = dirname(contractPathWithoutExt);
    const contractFile = contractPathWithoutExt.split('/').pop() || 'api';
    
    // Calculate relative path from output directory to contract directory
    const relativePath = relative(outputDir, contractDir);
    
    // Handle same directory case
    if (relativePath === '' || relativePath === '.') {
      return `./${contractFile}`;
    }
    
    // Construct import path - ensure it starts with ./
    const normalizedPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    return `${normalizedPath}/${contractFile}`;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}
