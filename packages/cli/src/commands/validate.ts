import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import * as ts from 'typescript';
import { parseContract } from '@xrpckit/parser';
import {
  formatSuccess,
  formatError,
  formatWarning,
  formatPath,
  formatInfo,
} from '../utils/tui';

export interface ValidateOptions {
  file?: string;
  prompt?: any;
  spinner?: any;
}

/**
 * Validates an API contract file for type safety and structure
 */
export async function validateCommand(options: ValidateOptions = {}): Promise<void> {
  const { prompt, spinner: createSpinner } = options;

  // Get file path
  let filePath = options.file;
  if (!filePath && prompt) {
    filePath = await prompt('API contract file path:', {
      default: 'src/api.ts',
    });
  } else if (!filePath) {
    throw new Error('File path is required. Use: xrpc validate <file> or run in interactive mode.');
  }

  // Validate file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const validateSpinner = createSpinner ? createSpinner('Validating contract...') : null;
  if (validateSpinner) validateSpinner.start();

  try {
    // Step 1: Basic syntax validation
    const syntaxErrors = await validateSyntax(filePath);
    if (syntaxErrors.length > 0) {
      if (validateSpinner) validateSpinner.fail('Syntax validation failed');
      console.error(formatError('Syntax errors found:'));
      for (const error of syntaxErrors) {
        console.error(`  ${formatError(`Line ${error.line}: ${error.message}`)}`);
      }
      process.exit(1);
    }

    // Step 2: Structure validation (parse contract)
    const structureErrors = await validateStructure(filePath);
    if (structureErrors.length > 0) {
      if (validateSpinner) validateSpinner.fail('Structure validation failed');
      console.error(formatError('Contract structure errors:'));
      for (const error of structureErrors) {
        console.error(`  ${formatError(error)}`);
      }
      process.exit(1);
    }

    if (validateSpinner) validateSpinner.succeed('Contract is valid');
    console.log();
    console.log(formatSuccess('✓ Contract validation passed'));
    console.log(formatInfo(`File: ${formatPath(filePath)}`));
  } catch (error) {
    if (validateSpinner) validateSpinner.fail('Validation failed');
    console.error(formatError(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Validates TypeScript syntax using the TypeScript compiler API
 * Focuses on syntax errors rather than full type checking
 */
async function validateSyntax(filePath: string): Promise<Array<{ line: number; message: string }>> {
  const errors: Array<{ line: number; message: string }> = [];
  const absolutePath = resolve(filePath);

  // Read the source file
  const sourceCode = await Bun.file(absolutePath).text();

  // Create source file and check for syntax errors
  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceCode,
    ts.ScriptTarget.ES2022,
    true
  );

  // Check for parse errors (syntax errors)
  if (sourceFile.parseDiagnostics && sourceFile.parseDiagnostics.length > 0) {
    for (const diagnostic of sourceFile.parseDiagnostics) {
      if (diagnostic.file && diagnostic.file.fileName === absolutePath) {
        const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errors.push({
          line: line + 1, // 1-indexed
          message,
        });
      }
    }
  }

  return errors;
}

/**
 * Validates contract structure by parsing it
 */
async function validateStructure(filePath: string): Promise<string[]> {
  const errors: string[] = [];

  try {
    const contract = await parseContract(filePath);

    // Check for router
    if (!contract.routers || contract.routers.length === 0) {
      errors.push('No router found. Contract must export a router.');
      return errors;
    }

    // Check for endpoints
    if (!contract.endpoints || contract.endpoints.length === 0) {
      errors.push('No endpoints found. Router must contain at least one endpoint.');
      return errors;
    }

    // Validate each endpoint
    for (const endpoint of contract.endpoints) {
      if (!endpoint.name) {
        errors.push(`Endpoint missing name in group "${endpoint.fullName}"`);
      }
      if (!endpoint.type || (endpoint.type !== 'query' && endpoint.type !== 'mutation')) {
        errors.push(`Endpoint "${endpoint.fullName}" has invalid type: ${endpoint.type}. Must be "query" or "mutation".`);
      }
      if (!endpoint.input) {
        errors.push(`Endpoint "${endpoint.fullName}" is missing input schema.`);
      }
      if (!endpoint.output) {
        errors.push(`Endpoint "${endpoint.fullName}" is missing output schema.`);
      }
    }

    // Validate endpoint groups
    for (const router of contract.routers) {
      if (!router.endpointGroups || router.endpointGroups.length === 0) {
        errors.push('Router has no endpoint groups.');
      }
      for (const group of router.endpointGroups) {
        if (!group.name) {
          errors.push('Endpoint group missing name.');
        }
        if (!group.endpoints || group.endpoints.length === 0) {
          errors.push(`Endpoint group "${group.name}" has no endpoints.`);
        }
      }
    }
  } catch (error) {
    // parseContract throws errors that we should surface
    if (error instanceof Error) {
      if (error.message.includes('No router export')) {
        errors.push('Contract must export a router. Example: export const router = createRouter({ ... });');
      } else {
        errors.push(`Parse error: ${error.message}`);
      }
    } else {
      errors.push(`Unknown error: ${String(error)}`);
    }
  }

  return errors;
}
