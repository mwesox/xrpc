import { CodeWriter } from './code-writer';
import type { ContractDefinition } from '../parser';

export interface GeneratorConfig {
  outputDir: string;
  packageName?: string;
  framework?: string;
  options?: Record<string, unknown>;
}

export interface GeneratedFiles {
  types?: string;
  server?: string;
  client?: string;
  validation?: string;
}

export abstract class BaseCodeGenerator {
  protected writer: CodeWriter;
  protected config: GeneratorConfig;

  constructor(config: GeneratorConfig) {
    this.writer = new CodeWriter();
    this.config = config;
  }

  abstract generate(contract: ContractDefinition): GeneratedFiles;

  protected toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  protected toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  protected toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}
