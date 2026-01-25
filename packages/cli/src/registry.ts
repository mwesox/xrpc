import type { Target } from "@xrpckit/sdk";
import { goTarget } from "@xrpckit/target-go-server";
import { tsClientTarget } from "@xrpckit/target-ts-client";

const generators: Record<string, Target> = {
  "go-server": goTarget,
  "ts-client": tsClientTarget,
  // Future targets can be added here:
  // 'go-client': { ... },
  // 'python-server': { ... },
  // 'swift-client': { ... },
};

/**
 * Gets a code generator for the specified target language/platform.
 *
 * @param target - The target language/platform (e.g., 'go-server', 'ts-client')
 * @returns The generator for the target, or undefined if not found
 *
 * @example
 * ```typescript
 * const generator = getGenerator('go-server');
 * if (generator) {
 *   const result = generator.generate({ contract, outputDir });
 * }
 * ```
 */
export function getGenerator(target: string): Target | undefined {
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
