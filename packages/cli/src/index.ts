#!/usr/bin/env bun

import { prompt, spinner } from '@bunli/utils';
import { showMenu } from './commands/menu';
import { showHelp } from './commands/help';
import { generateCommand } from './commands/generate';
import { validateCommand } from './commands/validate';
import { formatError } from './utils/tui';

// Simple argument parser
function parseArgs(args: string[]): { command?: string; flags: Record<string, string>; positional: string[] } {
  const result: { command?: string; flags: Record<string, string>; positional: string[] } = { flags: {}, positional: [] };
  let i = 0;
  
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        result.flags[key] = value;
        i += 2;
      } else {
        result.flags[key] = 'true';
        i += 1;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        result.flags[key] = value;
        i += 2;
      } else {
        result.flags[key] = 'true';
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

// If no arguments, show menu
if (args.length === 0 || (!parsed.command && !parsed.flags.help && !parsed.flags.version)) {
  await showMenu();
  process.exit(0);
}

// Handle help flag
if (parsed.flags.help || parsed.flags.h || parsed.command === 'help') {
  await showHelp(parsed.flags.command || parsed.flags.c);
  process.exit(0);
}

// Handle version flag
if (parsed.flags.version || parsed.flags.v) {
  console.log('0.1.0');
  process.exit(0);
}

// Route commands
try {
  switch (parsed.command) {
    case 'generate':
      await generateCommand({
        input: parsed.flags.input || parsed.flags.i,
        output: parsed.flags.output || parsed.flags.o,
        targets: parsed.flags.targets || parsed.flags.t,
        prompt,
        spinner,
      });
      break;
    case 'validate':
      await validateCommand({
        file: parsed.flags.file || parsed.flags.f || parsed.positional[0],
        prompt,
        spinner,
      });
      break;
    case 'help':
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
  console.error(formatError(error instanceof Error ? error.message : String(error)));
  console.error('\nRun "xrpc --help" for usage information.');
  process.exit(1);
}
