import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parse } from "smol-toml";

/**
 * Module configuration for multi-contract setups.
 */
export interface ModuleConfig {
  /** Path to the contract file */
  contract: string;
  /** Target outputs: key = target name, value = output path */
  [target: string]: string | undefined;
}

/**
 * xRPC configuration with simplified flat structure.
 *
 * Single contract mode:
 * ```toml
 * contract = "./packages/api/src/contract.ts"
 * go-server = "./apps/backend"
 * ts-client = "./apps/web"
 * ```
 *
 * Multi-module mode:
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
export interface XrpcConfig {
  /** Path to the contract file (local path or remote like "npm:@myorg/api") - single contract mode */
  contract?: string;
  /** Target outputs or module configs: key = target name or module name, value = output path or module config */
  [key: string]: string | ModuleConfig | undefined;
}

const CONFIG_FILENAME = "xrpc.toml";

/** Reserved keys that are not target names */
const RESERVED_KEYS = new Set(["contract"]);

/**
 * Extract target configurations from the flat config structure.
 * Any key that's not a reserved key is treated as a target name.
 * Works for both single-contract configs and individual module configs.
 */
export function extractTargets(
  config: XrpcConfig | ModuleConfig,
): Record<string, string> {
  const targets: Record<string, string> = {};

  for (const [key, value] of Object.entries(config)) {
    if (!RESERVED_KEYS.has(key) && typeof value === "string") {
      targets[key] = value;
    }
  }

  return targets;
}

/**
 * Check if the config is in multi-module mode.
 * Multi-module mode is detected when there's no top-level contract
 * and at least one value is an object (section).
 */
export function isMultiModule(config: XrpcConfig): boolean {
  return (
    !config.contract &&
    Object.values(config).some((v) => typeof v === "object" && v !== null)
  );
}

/**
 * Extract modules from the config.
 * In single-contract mode, wraps the config in a 'default' module.
 * In multi-module mode, returns all section objects as modules.
 */
export function extractModules(
  config: XrpcConfig,
): Record<string, ModuleConfig> {
  if (config.contract) {
    // Single-contract mode: wrap in default module
    const targets = extractTargets(config);
    return {
      default: {
        contract: config.contract,
        ...targets,
      },
    };
  }

  // Multi-module mode: extract all object values as modules
  const modules: Record<string, ModuleConfig> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "object" && value !== null) {
      const moduleConfig = value as ModuleConfig;
      if (moduleConfig.contract) {
        modules[key] = moduleConfig;
      }
    }
  }
  return modules;
}

/**
 * Load xrpc.toml configuration file from the current directory.
 * @returns The parsed config, or null if no config file exists.
 */
export async function loadConfig(): Promise<XrpcConfig | null> {
  if (!existsSync(CONFIG_FILENAME)) {
    return null;
  }

  try {
    const content = await readFile(CONFIG_FILENAME, "utf-8");
    return parse(content) as XrpcConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${error.message}`);
    }
    throw error;
  }
}
