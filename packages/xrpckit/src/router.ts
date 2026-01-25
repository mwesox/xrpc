import type { z } from "zod";
import type { EndpointDefinition } from "./endpoint";

export interface EndpointGroup {
  [endpointName: string]: EndpointDefinition<z.ZodTypeAny, z.ZodTypeAny>;
}

export interface RouterDefinition {
  [groupName: string]: EndpointGroup;
}

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
  [groupName: string]: EndpointGroup | Middleware[] | undefined;
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
 * Creates an endpoint group containing one or more endpoints.
 *
 * @param endpoints - An object mapping endpoint names to their definitions (query or mutation)
 * @returns The endpoint group with preserved types
 *
 * @example
 * ```typescript
 * const greeting = createEndpoint({
 *   greet: query({
 *     input: z.object({ name: z.string() }),
 *     output: z.object({ message: z.string() }),
 *   }),
 * });
 * ```
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
 *   greeting: createEndpoint({ ... })
 * });
 *
 * @example
 * // With middleware
 * const router = createRouter({
 *   middleware: [
 *     async (req, ctx) => ({ ...ctx, userId: extractUserId(req) })
 *   ],
 *   greeting: createEndpoint({ ... })
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
