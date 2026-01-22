import type { NormalizedContract } from '@xrpc/parser';
import type { GeneratorConfig, GeneratedFiles } from '@xrpc/generator-core';
import { GoCodeGenerator } from '@xrpc/target-go';
import { ReactCodeGenerator } from '@xrpc/target-react';

export type TargetGenerator = {
  name: string;
  generate: (contract: NormalizedContract, config: GeneratorConfig) => GeneratedFiles;
};

const generators: Record<string, TargetGenerator> = {
  go: {
    name: 'go',
    generate: (contract, config) => {
      const generator = new GoCodeGenerator(config);
      return generator.generate(contract);
    },
  },
  react: {
    name: 'react',
    generate: (contract, config) => {
      const generator = new ReactCodeGenerator(config);
      return generator.generate(contract);
    },
  },
  // Future targets can be added here:
  // 'typescript-express': { ... },
  // 'kotlin-spring-boot': { ... },
};

export function getGenerator(target: string): TargetGenerator | undefined {
  return generators[target];
}

export function listTargets(): string[] {
  return Object.keys(generators);
}

export { type GeneratorConfig, type GeneratedFiles } from '@xrpc/generator-core';
