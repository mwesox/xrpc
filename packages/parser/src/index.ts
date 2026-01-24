import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { extractTypeInfo, generateTypeName } from './zod-extractor';
import type { ContractDefinition, Router, EndpointGroup, Endpoint, TypeDefinition } from './contract';
import type { RouterDefinition, EndpointGroup as CoreEndpointGroup, EndpointDefinition } from '@xrpckit/core';
import { getRouterMiddleware } from '@xrpckit/core';

// Re-export types for convenience
export type { ContractDefinition, Router, EndpointGroup, Endpoint, TypeDefinition, Property, ValidationRules, TypeReference, MiddlewareDefinition } from './contract';

/**
 * Import a module with a timeout to detect circular dependencies or slow initialization
 */
async function importWithTimeout(path: string, timeout = 5000): Promise<any> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Import timeout after ${timeout}ms`)), timeout)
  );
  return Promise.race([import(path), timeoutPromise]);
}

/**
 * Checks if a package.json exists near the file
 */
function hasPackageJson(filePath: string): boolean {
  const dir = dirname(resolve(filePath));
  let currentDir = dir;
  
  // Check current directory and parent directories (up to 5 levels)
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(currentDir, 'package.json'))) {
      return true;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // Reached root
    currentDir = parent;
  }
  
  return false;
}

/**
 * Parses a contract file and returns a normalized contract definition.
 * 
 * The contract file must export a router created with `createRouter()`.
 * This function imports the file and extracts type information from Zod schemas.
 * 
 * @param filePath - Path to the TypeScript file containing the router definition
 * @returns A promise that resolves to a ContractDefinition containing all routers, endpoints, and types
 * @throws Error if the file cannot be imported, doesn't export a router, or has invalid structure
 * 
 * @example
 * ```typescript
 * const contract = await parseContract('src/api.ts');
 * console.log(`Found ${contract.endpoints.length} endpoints`);
 * ```
 */
export async function parseContract(filePath: string): Promise<ContractDefinition> {
  // Import the actual router to get real Zod schemas
  // Resolve to absolute path for import
  const absolutePath = resolve(filePath);
  
  // Try current approach first (works for 95% of cases with package.json)
  // For edge cases without package.json, we could fall back to AST parsing
  // but for now, we'll use the import approach which works for most cases
  
  let routerModule;
  try {
    routerModule = await importWithTimeout(absolutePath);
  } catch (error) {
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('timeout')) {
        throw new Error(
          `Contract file import timed out: ${filePath}\n` +
          `This may indicate circular dependencies or slow initialization.\n` +
          `Ensure the file exports a router synchronously.`
        );
      }
      if (error.message.includes('Cannot find module')) {
        throw new Error(
          `Failed to import contract file: ${filePath}\n` +
          `Error: ${error.message}\n` +
          `Make sure the file exists and all dependencies are installed.`
        );
      }
      if (error.message.includes('Unexpected token') || error.message.includes('SyntaxError')) {
        throw new Error(
          `Syntax error in contract file: ${filePath}\n` +
          `Error: ${error.message}\n` +
          `Please check the file for syntax errors.`
        );
      }
      throw new Error(
        `Failed to parse contract file: ${filePath}\n` +
        `Error: ${error.message}`
      );
    }
    throw error;
  }
  
  // Check if router exists before type assertion
  if (!routerModule.router) {
    // Check if router exists but is not exported correctly
    if ('router' in routerModule) {
      throw new Error(
        `Invalid router export in ${filePath}.\n` +
        `The router export exists but is not a valid RouterDefinition.\n` +
        `Make sure you're using: export const router = createRouter({ ... });`
      );
    }
    
    // Check for common mistakes
    const exports = Object.keys(routerModule);
    if (exports.length === 0) {
      throw new Error(
        `No exports found in ${filePath}.\n` +
        `The contract file must export a router. Example:\n` +
        `  export const router = createRouter({ ... });`
      );
    }
    
    // Suggest what might be wrong
    const possibleExports = exports.filter(e => e.toLowerCase().includes('router'));
    if (possibleExports.length > 0) {
      throw new Error(
        `No router export found in ${filePath}.\n` +
        `Found exports: ${exports.join(', ')}\n` +
        `Did you mean to export one of these? Make sure to use: export const router = createRouter({ ... });`
      );
    }
    
    throw new Error(
      `No router export found in ${filePath}.\n` +
      `The contract file must export a router. Example:\n` +
      `  export const router = createRouter({ ... });\n` +
      `Found exports: ${exports.length > 0 ? exports.join(', ') : 'none'}`
    );
  }

  const routerDef = routerModule.router as RouterDefinition;

  try {
    return buildContractDefinition(routerDef);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to build contract from router definition: ${error.message}\n` +
        `File: ${filePath}`
      );
    }
    throw error;
  }
}

function buildContractDefinition(
  routerDef: RouterDefinition
): ContractDefinition {
  const routers: Router[] = [];
  const endpoints: Endpoint[] = [];
  const typeMap = new Map<string, TypeDefinition>();

  // Validate router structure
  if (!routerDef || typeof routerDef !== 'object') {
    throw new Error('Router definition must be an object. Use: createRouter({ ... })');
  }

  // Extract middleware if present (stored in WeakMap)
  const middleware = getRouterMiddleware(routerDef);
  const middlewareDefinitions = middleware?.map((_, index) => ({
    name: `middleware_${index}`,
  })) || [];

  // Process router
  const router: Router = {
    name: 'router',
    endpointGroups: [],
    middleware: middlewareDefinitions.length > 0 ? middlewareDefinitions : undefined,
  };

  for (const [groupName, groupDef] of Object.entries(routerDef)) {
    if (!groupDef || typeof groupDef !== 'object') {
      throw new Error(
        `Invalid endpoint group "${groupName}". ` +
        `Endpoint groups must be created with createEndpoint({ ... }).`
      );
    }

    const endpointGroup: EndpointGroup = {
      name: groupName,
      endpoints: [],
    };

    for (const [endpointName, endpointDef] of Object.entries(groupDef)) {
      const fullName = `${groupName}.${endpointName}`;
      const epDef = endpointDef as EndpointDefinition;

      // Validate endpoint definition
      if (!epDef || typeof epDef !== 'object') {
        throw new Error(
          `Invalid endpoint "${fullName}". ` +
          `Endpoints must be created with query({ ... }) or mutation({ ... }).`
        );
      }

      if (!epDef.type || (epDef.type !== 'query' && epDef.type !== 'mutation')) {
        throw new Error(
          `Invalid endpoint type for "${fullName}". ` +
          `Type must be "query" or "mutation", got: ${epDef.type}`
        );
      }

      if (!epDef.input) {
        throw new Error(
          `Endpoint "${fullName}" is missing input schema. ` +
          `Use: ${epDef.type}({ input: z.object({ ... }), output: z.object({ ... }) })`
        );
      }

      if (!epDef.output) {
        throw new Error(
          `Endpoint "${fullName}" is missing output schema. ` +
          `Use: ${epDef.type}({ input: z.object({ ... }), output: z.object({ ... }) })`
        );
      }

      try {
        // Extract input type from actual Zod schema
        const inputType = extractTypeInfo(epDef.input);
        const inputTypeName = generateTypeName(groupName, endpointName) + 'Input';
        addTypeDefinition(typeMap, inputTypeName, inputType);

        // Extract output type from actual Zod schema
        const outputType = extractTypeInfo(epDef.output);
        const outputTypeName = generateTypeName(groupName, endpointName) + 'Output';
        addTypeDefinition(typeMap, outputTypeName, outputType);

        const endpoint: Endpoint = {
          name: endpointName,
          type: epDef.type,
          input: { name: inputTypeName, ...inputType },
          output: { name: outputTypeName, ...outputType },
          fullName,
        };

        endpointGroup.endpoints.push(endpoint);
        endpoints.push(endpoint);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(
            `Failed to extract type information for endpoint "${fullName}": ${error.message}`
          );
        }
        throw error;
      }
    }

    if (endpointGroup.endpoints.length === 0) {
      throw new Error(
        `Endpoint group "${groupName}" has no endpoints. ` +
        `Add endpoints using: createEndpoint({ endpointName: query({ ... }) })`
      );
    }

    router.endpointGroups.push(endpointGroup);
  }

  if (router.endpointGroups.length === 0) {
    throw new Error(
      'Router has no endpoint groups. ' +
      'Add endpoint groups using: createRouter({ groupName: createEndpoint({ ... }) })'
    );
  }

  routers.push(router);

  return {
    routers,
    types: Array.from(typeMap.values()),
    endpoints,
    middleware: middlewareDefinitions.length > 0 ? middlewareDefinitions : undefined,
  };
}

function addTypeDefinition(
  typeMap: Map<string, TypeDefinition>,
  name: string,
  typeRef: any
): void {
  if (typeMap.has(name)) {
    return;
  }

  const typeDef: TypeDefinition = {
    name,
    kind: typeRef.kind,
    properties: typeRef.properties,
    elementType: typeRef.elementType,
    baseType: typeRef.baseType,
  };

  typeMap.set(name, typeDef);

  // Recursively add nested types
  if (typeRef.properties) {
    for (const prop of typeRef.properties) {
      if (prop.type.name && !typeMap.has(prop.type.name)) {
        addTypeDefinition(typeMap, prop.type.name, prop.type);
      }
    }
  }

  if (typeRef.elementType && typeRef.elementType.name && !typeMap.has(typeRef.elementType.name)) {
    addTypeDefinition(typeMap, typeRef.elementType.name, typeRef.elementType);
  }
}
