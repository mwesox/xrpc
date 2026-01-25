/**
 * Template generation utilities for the init command.
 * Generates xrpc.toml, contract files, and package.json files.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TargetConfig {
  name: string;
  outputPath: string;
}

export interface TomlConfig {
  contractPath: string;
  targets: TargetConfig[];
}

export interface MultiModuleTomlConfig {
  modules: {
    name: string;
    contractPath: string;
    targets: TargetConfig[];
  }[];
}

export interface PackageJsonConfig {
  name: string;
  isPrivate?: boolean;
}

// =============================================================================
// CONTRACT TEMPLATE
// =============================================================================

/**
 * Generates a sample xRPC contract file.
 */
export function generateContractTemplate(): string {
  return `import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

// =============================================================================
// SAMPLE ENDPOINT
// =============================================================================

const example = createEndpoint({
  // Get a greeting message
  hello: query({
    input: z.object({
      name: z.string().min(1).max(100),
    }),
    output: z.object({
      message: z.string(),
    }),
  }),

  // Echo back the input
  echo: mutation({
    input: z.object({
      text: z.string().max(1000),
    }),
    output: z.object({
      echoed: z.string(),
    }),
  }),
});

// =============================================================================
// EXPORT ROUTER
// =============================================================================

export const router = createRouter({
  example,
});
`;
}

// =============================================================================
// XRPC.TOML TEMPLATE
// =============================================================================

/**
 * Generates an xrpc.toml configuration file with flat structure.
 *
 * Format:
 * ```toml
 * contract = "./path/to/contract.ts"
 * go-server = "./apps/backend"
 * ts-client = "./apps/web"
 * ```
 */
export function generateTomlTemplate(config: TomlConfig): string {
  const lines: string[] = [
    "# xRPC Configuration",
    '# Run "xrpc generate" to generate type-safe code for your targets',
    "",
    `contract = "${config.contractPath}"`,
  ];

  for (const target of config.targets) {
    lines.push(`${target.name} = "${target.outputPath}"`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Generates an xrpc.toml configuration file with multiple modules.
 *
 * Format:
 * ```toml
 * [users]
 * contract = "packages/users-api/contract.ts"
 * go-server = "apps/backend/users"
 *
 * [orders]
 * contract = "packages/orders-api/contract.ts"
 * go-server = "apps/backend/orders"
 * ```
 */
export function generateMultiModuleTomlTemplate(
  config: MultiModuleTomlConfig,
): string {
  const lines: string[] = [
    "# xRPC Configuration",
    '# Run "xrpc generate" to generate all modules',
    '# Run "xrpc generate <module>" to generate a specific module',
    "",
  ];

  for (let i = 0; i < config.modules.length; i++) {
    const module = config.modules[i];

    if (i > 0) {
      lines.push(""); // Blank line between modules
    }

    lines.push(`[${module.name}]`);
    lines.push(`contract = "${module.contractPath}"`);

    for (const target of module.targets) {
      lines.push(`${target.name} = "${target.outputPath}"`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// =============================================================================
// PACKAGE.JSON TEMPLATE
// =============================================================================

/**
 * Generates a package.json for a new API package in a monorepo.
 */
export function generatePackageJsonTemplate(config: PackageJsonConfig): string {
  const pkg = {
    name: config.name,
    version: "0.0.1",
    private: config.isPrivate ?? true,
    type: "module",
    main: "./src/contract.ts",
    exports: {
      ".": "./src/contract.ts",
    },
    dependencies: {
      xrpckit: "^0.0.1",
      zod: "^3.25.42",
    },
  };

  return `${JSON.stringify(pkg, null, 2)}\n`;
}

// =============================================================================
// TSCONFIG TEMPLATE
// =============================================================================

/**
 * Generates a minimal tsconfig.json for an API package.
 */
export function generateTsconfigTemplate(): string {
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      outDir: "./dist",
    },
    include: ["src/**/*"],
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}

// =============================================================================
// FILE STRUCTURE HELPERS
// =============================================================================

export interface FileToCreate {
  path: string;
  content: string;
  description: string;
}

/**
 * Generates the list of files to create for a monorepo API package.
 */
export function generateMonorepoApiPackageFiles(
  packagePath: string,
  packageName: string,
  tomlConfig: TomlConfig,
): FileToCreate[] {
  return [
    {
      path: `${packagePath}/package.json`,
      content: generatePackageJsonTemplate({ name: packageName }),
      description: "Package configuration",
    },
    {
      path: `${packagePath}/tsconfig.json`,
      content: generateTsconfigTemplate(),
      description: "TypeScript configuration",
    },
    {
      path: `${packagePath}/src/contract.ts`,
      content: generateContractTemplate(),
      description: "API contract definition",
    },
    {
      path: "xrpc.toml",
      content: generateTomlTemplate(tomlConfig),
      description: "xRPC configuration",
    },
  ];
}

/**
 * Generates the list of files to create for a single-project setup.
 */
export function generateSingleProjectFiles(
  contractPath: string,
  tomlConfig: TomlConfig,
): FileToCreate[] {
  return [
    {
      path: contractPath,
      content: generateContractTemplate(),
      description: "API contract definition",
    },
    {
      path: "xrpc.toml",
      content: generateTomlTemplate(tomlConfig),
      description: "xRPC configuration",
    },
  ];
}
