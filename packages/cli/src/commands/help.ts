import { listTargets } from '@xrpc/generator';
import {
  formatHeader,
  formatCommand,
  formatDescription,
  formatCode,
  formatTarget,
  formatPath,
  createSeparator,
  formatInfo,
} from '../utils/tui';

export async function showHelp(command?: string): Promise<void> {
  if (command) {
    showCommandHelp(command);
  } else {
    showGeneralHelp();
  }
}

function showGeneralHelp(): void {
  console.log(formatHeader('xRPC CLI Help\n'));

  console.log(formatDescription('xRPC is a type-safe, cross-platform RPC framework.\n'));

  console.log(formatHeader('Commands:\n'));

  console.log(formatCommand('generate'));
  console.log(formatDescription('  Generate type-safe clients and servers from API contracts'));
  console.log(formatDescription('  Usage: xrpc generate [options]'));
  console.log(formatDescription('  Options:'));
  console.log(formatDescription('    -i, --input    Path to API contract file'));
  console.log(formatDescription('    -o, --output   Output directory for generated code'));
  console.log(formatDescription('    -t, --targets  Comma-separated list of targets'));
  console.log();

  console.log(formatCommand('validate'));
  console.log(formatDescription('  Validate API contract for type safety and structure'));
  console.log(formatDescription('  Usage: xrpc validate [file]'));
  console.log(formatDescription('  Options:'));
  console.log(formatDescription('    -f, --file     Path to API contract file (or positional argument)'));
  console.log();

  console.log(formatCommand('help'));
  console.log(formatDescription('  Show this help message or help for a specific command'));
  console.log(formatDescription('  Usage: xrpc help [command]'));
  console.log();

  console.log(createSeparator());
  console.log();

  console.log(formatHeader('Available Targets:\n'));
  const targets = listTargets();
  for (const target of targets) {
    console.log(`  ${formatTarget(target)}`);
  }
  console.log();

  console.log(createSeparator());
  console.log();

  console.log(formatHeader('Examples:\n'));

  console.log(formatCode('# Generate Go server code'));
  console.log(formatCode('xrpc generate -i src/api.ts -o generated -t go'));
  console.log();

  console.log(formatCode('# Generate code for multiple targets'));
  console.log(formatCode('xrpc generate --input src/api.ts --output generated --targets go,typescript-express'));
  console.log();

  console.log(formatCode('# Interactive mode (prompts for missing arguments)'));
  console.log(formatCode('xrpc generate'));
  console.log();

  console.log(formatCode('# Validate contract'));
  console.log(formatCode('xrpc validate src/api.ts'));
  console.log();

  console.log(createSeparator());
  console.log();

  console.log(formatInfo('For more information, visit: https://github.com/xrpc/xrpc'));
  console.log();
}

function showCommandHelp(command: string): void {
  switch (command) {
    case 'generate':
      showGenerateHelp();
      break;
    case 'validate':
      showValidateHelp();
      break;
    default:
      console.log(formatDescription(`Unknown command: ${command}`));
      console.log(formatDescription('Run "xrpc help" to see all available commands.'));
  }
}

function showGenerateHelp(): void {
  console.log(formatHeader('Generate Command\n'));

  console.log(formatDescription('Generate type-safe clients and servers from API contracts defined with Zod schemas.\n'));

  console.log(formatHeader('Usage:\n'));
  console.log(formatCode('xrpc generate [options]'));
  console.log();

  console.log(formatHeader('Options:\n'));
  console.log(formatCommand('  -i, --input <path>'));
  console.log(formatDescription('    Path to API contract file (e.g., src/api.ts)'));
  console.log(formatDescription('    Required unless running in interactive mode'));
  console.log();

  console.log(formatCommand('  -o, --output <directory>'));
  console.log(formatDescription('    Output directory for generated code'));
  console.log(formatDescription('    Default: generated'));
  console.log();

  console.log(formatCommand('  -t, --targets <targets>'));
  console.log(formatDescription('    Comma-separated list of targets to generate'));
  console.log(formatDescription('    Available targets:'));
  const targets = listTargets();
  for (const target of targets) {
    console.log(formatDescription(`      - ${formatTarget(target)}`));
  }
  console.log();

  console.log(formatHeader('Examples:\n'));

  console.log(formatCode('# Generate Go server code'));
  console.log(formatCode('xrpc generate -i src/api.ts -o generated -t go'));
  console.log();

  console.log(formatCode('# Generate for multiple targets'));
  console.log(formatCode('xrpc generate -i api.ts -o out -t go,typescript-express'));
  console.log();

  console.log(formatCode('# Interactive mode'));
  console.log(formatCode('xrpc generate'));
  console.log(formatDescription('  Will prompt for input, output, and targets if not provided'));
  console.log();

  console.log(createSeparator());
  console.log();

  console.log(formatInfo('The generate command will:'));
  console.log(formatDescription('  1. Parse your TypeScript/Zod API contract'));
  console.log(formatDescription('  2. Extract endpoints and types'));
  console.log(formatDescription('  3. Generate type-safe code for selected targets'));
  console.log(formatDescription('  4. Write files to the output directory'));
  console.log();
}

function showValidateHelp(): void {
  console.log(formatHeader('Validate Command\n'));

  console.log(formatDescription('Validate an API contract file for type safety, syntax, and structure.\n'));

  console.log(formatHeader('Usage:\n'));
  console.log(formatCode('xrpc validate [file]'));
  console.log(formatCode('xrpc validate -f <file>'));
  console.log(formatCode('xrpc validate --file <file>'));
  console.log();

  console.log(formatHeader('Options:\n'));
  console.log(formatCommand('  -f, --file <path>'));
  console.log(formatDescription('    Path to API contract file (e.g., src/api.ts)'));
  console.log(formatDescription('    Can also be provided as a positional argument'));
  console.log(formatDescription('    Required unless running in interactive mode'));
  console.log();

  console.log(formatHeader('What it validates:\n'));
  console.log(formatDescription('  1. TypeScript syntax errors'));
  console.log(formatDescription('  2. Contract structure (router, endpoints)'));
  console.log(formatDescription('  3. Endpoint definitions (query/mutation types)'));
  console.log(formatDescription('  4. Schema validity (input/output schemas)'));
  console.log();

  console.log(formatHeader('Examples:\n'));

  console.log(formatCode('# Validate contract file'));
  console.log(formatCode('xrpc validate src/api.ts'));
  console.log();

  console.log(formatCode('# Validate with flag'));
  console.log(formatCode('xrpc validate --file api.ts'));
  console.log();

  console.log(formatCode('# Interactive mode'));
  console.log(formatCode('xrpc validate'));
  console.log(formatDescription('  Will prompt for file path if not provided'));
  console.log();

  console.log(createSeparator());
  console.log();

  console.log(formatInfo('The validate command helps catch errors before code generation.'));
  console.log(formatDescription('  Use it in CI/CD pipelines to ensure contract validity.'));
  console.log();
}
