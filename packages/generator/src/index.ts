import type { ContractDefinition } from '@xrpc/parser';
import type { GeneratorConfig, GeneratedFiles } from '@xrpc/generator-core';
import { GoCodeGenerator } from '@xrpc/target-go';
import { ReactCodeGenerator } from '@xrpc/target-react';

export type TargetGenerator = {
  name: string;
  generate: (contract: ContractDefinition, config: GeneratorConfig) => GeneratedFiles;
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

/**
 * Gets a code generator for the specified target language/platform.
 * 
 * @param target - The target language/platform (e.g., 'go', 'react')
 * @returns The generator for the target, or undefined if not found
 * 
 * @example
 * ```typescript
 * const generator = getGenerator('go');
 * if (generator) {
 *   const files = generator.generate(contract, config);
 * }
 * ```
 */
export function getGenerator(target: string): TargetGenerator | undefined {
  return generators[target];
}

/**
 * Lists all available code generation targets.
 * 
 * @returns An array of target names that can be used with `getGenerator()`
 * 
 * @example
 * ```typescript
 * const targets = listTargets();
 * console.log(`Available targets: ${targets.join(', ')}`);
 * ```
 */
export function listTargets(): string[] {
  return Object.keys(generators);
}

export { type GeneratorConfig, type GeneratedFiles } from '@xrpc/generator-core';
