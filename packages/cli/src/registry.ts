import type { ContractDefinition } from '@xrpckit/parser';
import type { GeneratorConfig, GeneratedFiles } from '@xrpckit/codegen';
import { GoCodeGenerator } from '@xrpckit/target-go-server';
import { ReactCodeGenerator } from '@xrpckit/target-react-client';

export type TargetGenerator = {
  name: string;
  generate: (contract: ContractDefinition, config: GeneratorConfig) => GeneratedFiles;
};

const generators: Record<string, TargetGenerator> = {
  'go-server': {
    name: 'go-server',
    generate: (contract, config) => {
      const generator = new GoCodeGenerator(config);
      return generator.generate(contract);
    },
  },
  'react-client': {
    name: 'react-client',
    generate: (contract, config) => {
      const generator = new ReactCodeGenerator(config);
      return generator.generate(contract);
    },
  },
  // Future targets can be added here:
  // 'go-client': { ... },
  // 'python-server': { ... },
  // 'swift-client': { ... },
};

/**
 * Gets a code generator for the specified target language/platform.
 *
 * @param target - The target language/platform (e.g., 'go-server', 'react-client')
 * @returns The generator for the target, or undefined if not found
 *
 * @example
 * ```typescript
 * const generator = getGenerator('go-server');
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
