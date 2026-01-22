import * as ts from 'typescript';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { NormalizedContract, Router, EndpointGroup, Endpoint, TypeDefinition } from './contract';
import { extractTypeInfo, generateTypeName } from './zod-extractor';

/**
 * Optional AST-based parser for contracts without package.json
 * This is a fallback for edge cases where dynamic imports don't work
 */
export async function parseContractAST(filePath: string): Promise<NormalizedContract> {
  const absolutePath = resolve(filePath);
  
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const sourceCode = readFileSync(absolutePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    absolutePath,
    sourceCode,
    ts.ScriptTarget.ES2022,
    true
  );

  // Find router export
  const routerExport = findRouterExport(sourceFile);
  if (!routerExport) {
    throw new Error(
      `No router export found in ${filePath}.\n` +
      `Expected: export const router = createRouter({ ... });`
    );
  }

  // Extract router definition from AST
  const routerDef = extractRouterDefinition(routerExport, sourceFile);
  
  // Build normalized contract (reuse existing logic)
  return buildNormalizedContractFromAST(routerDef);
}

/**
 * Finds the router export statement in the AST
 */
function findRouterExport(sourceFile: ts.SourceFile): ts.VariableStatement | null {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'router' &&
          (ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ||
           statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
        ) {
          return statement;
        }
      }
    }
  }
  return null;
}

/**
 * Extracts router definition from AST
 * This is a simplified version - for full support, we'd need to evaluate the AST
 * For now, this serves as a placeholder that indicates AST parsing is possible
 */
function extractRouterDefinition(
  routerExport: ts.VariableStatement,
  sourceFile: ts.SourceFile
): any {
  // This is a simplified implementation
  // In a full implementation, we would:
  // 1. Traverse the AST to find createRouter call
  // 2. Extract endpoint groups (createEndpoint calls)
  // 3. Extract endpoints (query/mutation calls)
  // 4. Extract Zod schemas from the AST
  
  // For now, we throw an error indicating that AST parsing needs the actual runtime
  // This is because extracting Zod schemas from AST without execution is complex
  throw new Error(
    'AST parsing is not fully implemented. ' +
    'For contracts without package.json, please ensure dependencies are available ' +
    'or use the standard import-based parser.'
  );
}

/**
 * Builds normalized contract from AST-extracted router definition
 */
function buildNormalizedContractFromAST(routerDef: any): NormalizedContract {
  // This would reuse the buildNormalizedContract logic from index.ts
  // For now, it's a placeholder
  throw new Error('AST parsing not fully implemented');
}
