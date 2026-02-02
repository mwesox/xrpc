#!/usr/bin/env node

import { checkbox, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { createRequire } from "node:module";
import { generateCommand } from "./commands/generate";
import { showHelp } from "./commands/help";
import { initCommand } from "./commands/init";
import { showMenu } from "./commands/menu";
import { validateCommand } from "./commands/validate";
import { formatError } from "./utils/tui";

// Custom theme for xRPC prompts - fancier selection style
const xrpcTheme = {
  prefix: { idle: "", done: "" }, // Remove "?" prefix
  icon: {
    cursor: chalk.cyan("▶"), // Fancy cyan arrow instead of ❯
  },
  style: {
    message: (text: string) => chalk.cyan.bold(text), // Cyan + bold for prominent questions
    highlight: (text: string) => chalk.cyan.bold(text), // Cyan highlight for selected item
    help: () => "", // Hide help text for cleaner look
  },
};

// Wrapper for ora spinner to match expected interface
function createSpinner(message: string) {
  const spinnerInstance = ora(message);
  return {
    start: () => spinnerInstance.start(),
    succeed: (msg?: string) => spinnerInstance.succeed(msg),
    fail: (msg?: string) => spinnerInstance.fail(msg),
  };
}

// Wrapper for inquirer prompts to match expected interface
async function prompt(
  message: string,
  options?: { default?: string },
): Promise<string> {
  return input({
    message,
    default: options?.default,
    theme: xrpcTheme,
  });
}

// Add select method to prompt function
prompt.select = async (
  message: string,
  options: { options: string[]; multiple?: boolean },
): Promise<string | string[]> => {
  if (options.multiple) {
    return checkbox({
      message,
      choices: options.options.map((opt) => ({ name: opt, value: opt })),
      theme: xrpcTheme,
    });
  }
  return select({
    message,
    choices: options.options.map((opt) => ({ name: opt, value: opt })),
    theme: xrpcTheme,
  });
};

// Simple argument parser
function parseArgs(args: string[]): {
  command?: string;
  flags: Record<string, string>;
  positional: string[];
} {
  const result: {
    command?: string;
    flags: Record<string, string>;
    positional: string[];
  } = { flags: {}, positional: [] };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        result.flags[key] = value;
        i += 2;
      } else {
        result.flags[key] = "true";
        i += 1;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        result.flags[key] = value;
        i += 2;
      } else {
        result.flags[key] = "true";
        i += 1;
      }
    } else if (!result.command) {
      result.command = arg;
      i += 1;
    } else {
      result.positional.push(arg);
      i += 1;
    }
  }

  return result;
}

// Run CLI
const args = process.argv.slice(2);
const parsed = parseArgs(args);
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version?: string };

// If no arguments, show menu
if (
  args.length === 0 ||
  (!parsed.command && !parsed.flags.help && !parsed.flags.version)
) {
  await showMenu();
  process.exit(0);
}

// Handle help flag
if (parsed.flags.help || parsed.flags.h || parsed.command === "help") {
  await showHelp(
    parsed.flags.command || parsed.flags.c || parsed.positional[0],
  );
  process.exit(0);
}

// Handle version flag
if (parsed.flags.version || parsed.flags.v) {
  console.log(pkg.version ?? "unknown");
  process.exit(0);
}

// Route commands
try {
  switch (parsed.command) {
    case "generate":
      await generateCommand({
        input: parsed.flags.input || parsed.flags.i,
        output: parsed.flags.output || parsed.flags.o,
        targets: parsed.flags.targets || parsed.flags.t,
        module: parsed.positional[0], // Module name for multi-module configs
        prompt,
        spinner: createSpinner,
      });
      break;
    case "validate":
      await validateCommand({
        file: parsed.flags.file || parsed.flags.f || parsed.positional[0],
        prompt,
        spinner: createSpinner,
      });
      break;
    case "init":
      await initCommand({
        prompt,
        spinner: createSpinner,
      });
      break;
    case "help":
      await showHelp(parsed.flags.command || parsed.flags.c);
      break;
    default:
      if (parsed.command) {
        console.error(formatError(`Unknown command: ${parsed.command}`));
      }
      await showHelp();
      process.exit(1);
  }
} catch (error) {
  console.error(
    formatError(error instanceof Error ? error.message : String(error)),
  );
  console.error('\nRun "xrpc --help" for usage information.');
  process.exit(1);
}
