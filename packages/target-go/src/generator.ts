import { BaseCodeGenerator, type GeneratorConfig, type GeneratedFiles } from '@xrpc/generator-core';
import { GoTypeGenerator } from './type-generator';
import { GoServerGenerator } from './server-generator';
import { GoValidationGenerator } from './validation-generator';
import type { ContractDefinition } from '@xrpc/parser';

export class GoCodeGenerator extends BaseCodeGenerator {
  private typeGenerator: GoTypeGenerator;
  private serverGenerator: GoServerGenerator;
  private validationGenerator: GoValidationGenerator;

  constructor(config: GeneratorConfig) {
    super(config);
    const packageName = config.packageName || 'server';
    this.typeGenerator = new GoTypeGenerator(packageName);
    this.serverGenerator = new GoServerGenerator(packageName);
    this.validationGenerator = new GoValidationGenerator(packageName);
  }

  generate(contract: ContractDefinition): GeneratedFiles {
    return {
      types: this.typeGenerator.generateTypes(contract),
      server: this.serverGenerator.generateServer(contract),
      validation: this.validationGenerator.generateValidation(contract),
    };
  }
}
