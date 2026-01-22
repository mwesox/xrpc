import type { EndpointDefinition } from './endpoint';

export interface EndpointGroup {
  [endpointName: string]: EndpointDefinition;
}

export interface RouterDefinition {
  [groupName: string]: EndpointGroup;
}

/**
 * Middleware function type for extending context
 * Middleware receives the request and current context, and returns updated context
 * Note: In generated code, middleware is implemented per-target (Go, TypeScript, etc.)
 * This type is for documentation and type checking in the contract definition
 */
export type Middleware<TContext = Record<string, unknown>> = (
  req: Request,
  context: TContext
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
function isRouterConfig(value: RouterDefinition | RouterConfig): value is RouterConfig {
  return value && typeof value === 'object' && 'middleware' in value && Array.isArray(value.middleware);
}

export function createEndpoint(
  endpoints: EndpointGroup
): EndpointGroup {
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
export function createRouter(
  config: RouterConfig | RouterDefinition
): RouterDefinition {
  // If it's a RouterConfig with middleware, extract the endpoints
  if (isRouterConfig(config)) {
    const { middleware, ...endpoints } = config;
    // Store middleware metadata on the router definition for parser extraction
    const routerDef = endpoints as RouterDefinition;
    // Attach middleware to router definition as metadata (non-enumerable)
    if (middleware && middleware.length > 0) {
      Object.defineProperty(routerDef, '__middleware', {
        value: middleware,
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }
    return routerDef;
  }
  
  // Otherwise, it's a plain RouterDefinition
  return config;
}
