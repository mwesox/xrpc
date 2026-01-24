import { BaseCodeGenerator, type GeneratorConfig, type GeneratedFiles, type ContractDefinition } from '@xrpckit/sdk';
import { ReactTypeGenerator } from './type-generator';
import { ReactClientGenerator } from './client-generator';

export class ReactCodeGenerator extends BaseCodeGenerator {
  private typeGenerator: ReactTypeGenerator;
  private clientGenerator: ReactClientGenerator;
  private contractPath: string;

  constructor(config: GeneratorConfig) {
    super(config);
    
    // Get contract path from config (required for React target)
    const contractPath = (config.options?.contractPath as string) || config.outputDir;
    if (!contractPath) {
      throw new Error('contractPath is required for React target. Pass it via GeneratorConfig.options.contractPath');
    }
    
    this.contractPath = contractPath;
    this.typeGenerator = new ReactTypeGenerator(contractPath, config.outputDir);
    this.clientGenerator = new ReactClientGenerator();
  }

  generate(contract: ContractDefinition): GeneratedFiles {
    return {
      types: this.typeGenerator.generateTypes(contract),
      client: this.clientGenerator.generateClient(contract),
    };
  }
}
