import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  type ContractDefinition,
  type Diagnostic,
  parseContract,
} from "@xrpckit/sdk";
import {
  type ModuleConfig,
  type XrpcConfig,
  extractModules,
  extractTargets,
  isMultiModule,
  loadConfig,
} from "../config";
import { getGenerator, listTargets } from "../registry";
import {
  createSeparator,
  formatBoxFooter,
  formatBoxHeader,
  formatBoxLine,
  formatError,
  formatInfo,
  formatPath,
  formatSecondary,
  formatSuccess,
  formatTarget,
  formatWarning,
} from "../utils/tui";
import {
  generateTomlTemplate,
  type TargetConfig as TomlTargetConfig,
} from "../utils/templates";

// Minimal types for prompt and spinner functions
type PromptFunction = (
  message: string,
  options?: { default?: string },
) => Promise<string>;
type PromptSelectFunction = {
  select: (
    message: string,
    options: { options: string[]; multiple?: boolean },
  ) => Promise<string | string[]>;
};
type SpinnerInstance = {
  start: () => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
};
type SpinnerFunction = (message: string) => SpinnerInstance;

export interface GenerateOptions {
  input?: string;
  output?: string;
  targets?: string;
  /** Module name to generate (for multi-module configs) */
  module?: string;
  prompt?: PromptFunction & PromptSelectFunction;
  spinner?: SpinnerFunction;
}

/**
 * Validates that a path is within the project directory to prevent path traversal attacks.
 * @param path - The path to validate
 * @param baseDir - The base directory to validate against (defaults to current working directory)
 * @returns The resolved absolute path if valid
 * @throws Error if the path is outside the base directory
 */
function validatePath(path: string, baseDir: string = process.cwd()): string {
  const base = resolve(baseDir);
  const resolved = resolve(baseDir, path);
  const rel = relative(base, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path must be within project directory: ${path}`);
  }
  return resolved;
}

function resolveSafeOutputPath(baseDir: string, filePath: string): string {
  if (isAbsolute(filePath)) {
    throw new Error(`Generated path must be relative: ${filePath}`);
  }
  const resolved = resolve(baseDir, filePath);
  const rel = relative(baseDir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Generated path escapes output directory: ${filePath}`);
  }
  return resolved;
}

function normalizeTomlPath(baseDir: string, filePath: string): string {
  const resolved = resolve(baseDir, filePath);
  const rel = relative(baseDir, resolved);
  if (!rel || rel === ".") {
    return ".";
  }
  if (rel.startsWith(".")) {
    return rel;
  }
  return `./${rel}`;
}

async function writeTomlConfig(
  contractPath: string,
  targets: TomlTargetConfig[],
): Promise<void> {
  const configPath = join(process.cwd(), "xrpc.toml");
  if (existsSync(configPath)) {
    return;
  }

  const content = generateTomlTemplate({
    contractPath: normalizeTomlPath(process.cwd(), contractPath),
    targets,
  });

  await writeFile(configPath, content);
}

export async function generateCommand(
  options: GenerateOptions = {},
): Promise<void> {
  const { prompt, spinner: createSpinner } = options;

  // Load config file if present
  const config = await loadConfig();

  // Check if we're in multi-module mode
  if (config && isMultiModule(config)) {
    await generateMultiModule(config, options);
    return;
  }

  // Single contract mode (original behavior)
  await generateSingleContract(config, options);
}

/**
 * Generate code for a multi-module config.
 */
async function generateMultiModule(
  config: XrpcConfig,
  options: GenerateOptions,
): Promise<void> {
  const {
    prompt,
    spinner: createSpinner,
    module: requestedModule,
    targets: targetFilter,
  } = options;

  const modules = extractModules(config);
  const moduleNames = Object.keys(modules);

  if (moduleNames.length === 0) {
    throw new Error(
      'No valid modules found in xrpc.toml. Each module must have a "contract" field.',
    );
  }

  // Filter to specific module if requested
  let modulesToGenerate: string[];
  if (requestedModule) {
    if (!modules[requestedModule]) {
      throw new Error(
        `Module "${requestedModule}" not found in xrpc.toml. Available modules: ${moduleNames.join(", ")}`,
      );
    }
    modulesToGenerate = [requestedModule];
  } else {
    modulesToGenerate = moduleNames;
  }

  console.log(
    formatInfo(
      `Generating ${modulesToGenerate.length} module${modulesToGenerate.length !== 1 ? "s" : ""}...`,
    ),
  );
  console.log();

  for (const moduleName of modulesToGenerate) {
    const moduleConfig = modules[moduleName];
    console.log(formatBoxHeader(`Module: ${moduleName}`));

    try {
      await generateModule(
        moduleName,
        moduleConfig,
        targetFilter,
        createSpinner,
        options.output,
      );
      console.log(formatBoxFooter());
    } catch (error) {
      console.error(
        formatError(error instanceof Error ? error.message : String(error)),
      );
      throw error;
    }
  }

  console.log();
  console.log(createSeparator());
  console.log();
  console.log(formatSuccess("Generation complete!"));
  console.log();
}

/**
 * Generate code for a single module in multi-module mode.
 */
async function generateModule(
  moduleName: string,
  moduleConfig: ModuleConfig,
  targetFilter: string | undefined,
  createSpinner?: SpinnerFunction,
  outputOverride?: string,
): Promise<void> {
  const input = validatePath(moduleConfig.contract);
  if (!existsSync(input)) {
    throw new Error(`Contract file not found: ${input}`);
  }

  const genSpinner = createSpinner
    ? createSpinner("Parsing contract...")
    : null;
  if (genSpinner && "start" in genSpinner) genSpinner.start();

  const contract = await parseContract(input);
  if (genSpinner && "succeed" in genSpinner) {
    genSpinner.succeed(
      `Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? "s" : ""}`,
    );
  } else {
    console.log(
      `Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? "s" : ""}`,
    );
  }

  // Get targets from module config
  const moduleTargets = extractTargets(moduleConfig);

  // Filter targets if requested
  let targets: string[];
  if (targetFilter) {
    targets = targetFilter.split(",").map((t) => t.trim());
    // Validate that requested targets exist in module config
    for (const target of targets) {
      if (!moduleTargets[target]) {
        throw new Error(
          `Target "${target}" not configured for module "${moduleName}"`,
        );
      }
    }
  } else {
    targets = Object.keys(moduleTargets);
  }

  if (targets.length === 0) {
    console.log(
      formatWarning(`No targets configured for module "${moduleName}"`),
    );
    return;
  }

  // Validate targets against available generators
  const availableTargets = listTargets();
  const invalidTargets = targets.filter((t) => !availableTargets.includes(t));
  if (invalidTargets.length > 0) {
    throw new Error(
      `Unknown targets: ${invalidTargets.join(", ")}. Available targets: ${availableTargets.join(", ")}`,
    );
  }

  for (const target of targets) {
    const targetSpinner = createSpinner
      ? createSpinner(`Generating ${formatTarget(target)} code...`)
      : null;
    if (targetSpinner && "start" in targetSpinner) targetSpinner.start();

    const targetBaseDir = outputOverride || moduleTargets[target];

    try {
      await generateForTarget(
        target,
        contract,
        targetBaseDir,
        input,
        createSpinner,
        moduleName,
      );
      if (targetSpinner && "succeed" in targetSpinner) {
        targetSpinner.succeed(`Generated ${formatTarget(target)} code`);
      }
    } catch (error) {
      if (targetSpinner && "fail" in targetSpinner) {
        targetSpinner.fail(`Failed to generate ${formatTarget(target)} code`);
      }
      throw error;
    }
  }
}

/**
 * Generate code for a single contract config (original behavior).
 */
async function generateSingleContract(
  config: XrpcConfig | null,
  options: GenerateOptions,
): Promise<void> {
  const { prompt, spinner: createSpinner } = options;

  // Extract targets from config for later use
  const configTargets = config ? extractTargets(config) : {};

  // Interactive prompts for missing arguments
  let input = options.input;
  if (!input && config?.contract) {
    input = config.contract;
  } else if (!input && prompt) {
    input = await prompt("API contract file path:", {
      default: "src/api.ts",
    });
  } else if (!input) {
    throw new Error(
      "Input file path is required. Use -i/--input, xrpc.toml, or run in interactive mode.",
    );
  }

  // Validate and normalize input path
  input = validatePath(input);
  if (!existsSync(input)) {
    throw new Error(`File not found: ${input}`);
  }

  // Determine targets
  let targets: string[] = [];
  if (options.targets) {
    targets = options.targets.split(",").map((t) => t.trim());
  } else if (Object.keys(configTargets).length > 0) {
    targets = Object.keys(configTargets);
  } else if (prompt) {
    const availableTargets = listTargets();
    const selected = await prompt.select("Select targets to generate:", {
      options: availableTargets,
      multiple: true,
    });
    targets = Array.isArray(selected) ? selected : [selected];
  } else {
    throw new Error(
      "Targets are required. Use -t/--targets, xrpc.toml, or run in interactive mode.",
    );
  }

  // Validate targets
  const availableTargets = listTargets();
  const invalidTargets = targets.filter((t) => !availableTargets.includes(t));

  if (invalidTargets.length > 0) {
    console.error(
      formatError(
        `Unknown targets: ${invalidTargets.join(", ")}. Available targets: ${availableTargets.join(", ")}`,
      ),
    );
    process.exit(1);
  }

  // Start generation with progress tracking
  const genSpinner = createSpinner
    ? createSpinner("Parsing contract...")
    : null;
  if (genSpinner && "start" in genSpinner) genSpinner.start();

  try {
    const contract = await parseContract(input);
    if (genSpinner && "succeed" in genSpinner) {
      genSpinner.succeed(
        `Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? "s" : ""}`,
      );
    } else {
      console.log(
        `Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? "s" : ""}`,
      );
    }

    const targetConfigs: TomlTargetConfig[] = [];

    for (const target of targets) {
      const targetSpinner = createSpinner
        ? createSpinner(`Generating ${formatTarget(target)} code...`)
        : null;
      if (targetSpinner && "start" in targetSpinner) targetSpinner.start();

      // Determine output directory for this target
      // Priority: CLI arg > config file > current directory
      let targetBaseDir: string;
      if (options.output) {
        targetBaseDir = options.output;
      } else if (configTargets[target]) {
        targetBaseDir = configTargets[target];
      } else {
        targetBaseDir = ".";
      }

      targetConfigs.push({
        name: target,
        outputPath: normalizeTomlPath(process.cwd(), targetBaseDir),
      });

      try {
        await generateForTarget(
          target,
          contract,
          targetBaseDir,
          input,
          createSpinner,
        );
        if (targetSpinner && "succeed" in targetSpinner) {
          targetSpinner.succeed(`Generated ${formatTarget(target)} code`);
        }
      } catch (error) {
        if (targetSpinner && "fail" in targetSpinner) {
          targetSpinner.fail(`Failed to generate ${formatTarget(target)} code`);
        }
        console.error(
          formatError(error instanceof Error ? error.message : String(error)),
        );
        throw error;
      }
    }

    console.log();
    console.log(createSeparator());
    console.log();
    console.log(formatSuccess("Generation complete!"));
    console.log();

    if (!config) {
      await writeTomlConfig(input, targetConfigs);
      if (existsSync(join(process.cwd(), "xrpc.toml"))) {
        console.log(formatSuccess("Created xrpc.toml"));
        console.log();
      }
    }
  } catch (error) {
    if (genSpinner && "fail" in genSpinner)
      genSpinner.fail("Generation failed");
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}

async function generateForTarget(
  target: string,
  contract: ContractDefinition,
  outputDir: string,
  inputPath: string,
  createSpinner?: (message: string) => {
    start: () => void;
    succeed: (msg?: string) => void;
    fail: (msg?: string) => void;
  },
  moduleName?: string,
): Promise<void> {
  const generator = getGenerator(target);
  if (!generator) {
    throw new Error(`Generator not found for target: ${target}`);
  }

  // Validate output directory path
  const validatedOutputDir = validatePath(outputDir);

  // All targets output to an 'xrpc' subdirectory
  // In multi-module mode with non-default module, add module name subdirectory
  let targetOutputDir: string;
  if (moduleName && moduleName !== "default") {
    targetOutputDir = join(validatedOutputDir, "xrpc", moduleName);
  } else {
    targetOutputDir = join(validatedOutputDir, "xrpc");
  }
  await mkdir(targetOutputDir, { recursive: true });

  const result = generator.generate({
    contract,
    outputDir: targetOutputDir,
    options: {
      contractPath: inputPath, // Pass contract path for client targets
      packageName: "xrpc",
    },
  });

  const diagnostics = result.diagnostics ?? [];
  const warnings = diagnostics.filter((issue) => issue.severity === "warning");
  for (const warning of warnings) {
    console.warn(formatWarning(`[${target}] ${formatDiagnostic(warning)}`));
  }

  const errors = diagnostics.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Target ${target} cannot generate:\n${errors
        .map(formatDiagnostic)
        .join("\n")}`,
    );
  }

  const files = result.files;

  // Write generated files with progress indication
  const fileSpinner = createSpinner ? createSpinner("Writing files...") : null;
  if (fileSpinner && "start" in fileSpinner) fileSpinner.start();

  const writtenFiles: string[] = [];
  for (const file of files) {
    const outputPath = resolveSafeOutputPath(targetOutputDir, file.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content);
    writtenFiles.push(outputPath);
  }

  if (fileSpinner && "succeed" in fileSpinner) {
    fileSpinner.succeed(
      `Wrote ${writtenFiles.length} file${writtenFiles.length !== 1 ? "s" : ""}`,
    );
  }

  // Show generated files
  for (const file of writtenFiles) {
    console.log(`    ${formatSecondary("→")} ${formatPath(file)}`);
  }
}

function formatDiagnostic(issue: Diagnostic): string {
  let message = issue.message;
  if (issue.path) {
    message += ` (at ${issue.path})`;
  }
  if (issue.hint) {
    message += ` ${issue.hint}`;
  }
  return message;
}
