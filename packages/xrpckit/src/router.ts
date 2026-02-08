import type { z } from "zod";
import type { EndpointDefinition } from "./endpoint";

export interface EndpointGroup {
  [endpointName: string]: EndpointDefinition<z.ZodTypeAny, z.ZodTypeAny>;
}

export type EndpointEntry = EndpointDefinition<z.ZodTypeAny, z.ZodTypeAny>;
export type RouterEntry = EndpointGroup | EndpointEntry;

export interface RouterDefinition {
  [entryName: string]: RouterEntry;
}

export const GROUP_NAME = Symbol.for("xrpc.groupName");

// WeakMap to store middleware separately from router definition
const routerMiddleware = new WeakMap<RouterDefinition, Middleware[]>();

/**
 * Get middleware associated with a router definition
 * Used by parser to extract middleware metadata
 */
export function getRouterMiddleware(
  router: RouterDefinition,
): Middleware[] | undefined {
  return routerMiddleware.get(router);
}

/**
 * Middleware function type for extending context
 * Middleware receives the request and current context, and returns updated context
 * Note: In generated code, middleware is implemented per-target (Go, TypeScript, etc.)
 * This type is for documentation and type checking in the contract definition
 */
export type Middleware<TContext = Record<string, unknown>> = (
  req: Request,
  context: TContext,
) => Promise<TContext | Response>;

/**
 * Router configuration with optional middleware
 */
export interface RouterConfig {
  middleware?: Middleware[];
  [entryName: string]: RouterEntry | Middleware[] | undefined;
}

/**
 * Type guard to check if a value is a RouterConfig
 */
function isRouterConfig(
  value: RouterDefinition | RouterConfig,
): value is RouterConfig {
  return (
    value &&
    typeof value === "object" &&
    "middleware" in value &&
    Array.isArray(value.middleware)
  );
}

/**
 * Creates an endpoint group with an explicit, canonical group name.
 * The explicit group name is used for API method names during parsing/generation.
 *
 * @param name - Explicit group name (source of truth)
 * @param endpoints - Group endpoints (query/mutation definitions)
 * @returns Endpoint group with attached group metadata
 */
export function group<T extends EndpointGroup>(
  name: string,
  endpoints: T,
): T & { [GROUP_NAME]: string } {
  const groupName = name.trim();
  if (!groupName) {
    throw new Error(
      'group(name, endpoints) requires a non-empty "name" argument.',
    );
  }

  Object.defineProperty(endpoints, GROUP_NAME, {
    value: groupName,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return endpoints as T & { [GROUP_NAME]: string };
}

/**
 * @deprecated Use `group("name", { ... })` for explicit endpoint groups.
 */
export function createEndpoint<T extends EndpointGroup>(endpoints: T): T {
  return endpoints;
}

/**
 * Creates a router with optional middleware support
 *
 * @example
 * // Without middleware
 * const router = createRouter({
 *   greeting: group("greeting", { ... })
 * });
 *
 * @example
 * // Flat endpoints (no groups)
 * const router = createRouter({
 *   ping: query({ ... })
 * });
 *
 * @example
 * // With middleware
 * const router = createRouter({
 *   middleware: [
 *     async (req, ctx) => ({ ...ctx, userId: extractUserId(req) })
 *   ],
 *   greeting: group("greeting", { ... })
 * });
 */
export function createRouter<T extends RouterConfig | RouterDefinition>(
  config: T,
): T extends RouterConfig ? Omit<T, "middleware"> : T {
  // If it's a RouterConfig with middleware, extract the endpoints
  if (isRouterConfig(config)) {
    const { middleware, ...endpoints } = config;
    const routerDef = endpoints as RouterDefinition;

    // Store middleware in WeakMap instead of property
    if (middleware && middleware.length > 0) {
      routerMiddleware.set(routerDef, middleware);
    }
    return routerDef as T extends RouterConfig ? Omit<T, "middleware"> : T;
  }

  // Otherwise, it's a plain RouterDefinition
  return config as T extends RouterConfig ? Omit<T, "middleware"> : T;
}
