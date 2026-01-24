import { z } from 'zod';
import type { ZodType } from 'zod';

export interface EndpointDefinition {
  type: 'query' | 'mutation';
  input: ZodType;
  output: ZodType;
}

/**
 * Creates a query endpoint definition.
 * Queries are typically used for read operations that don't modify server state.
 *
 * @param config - Configuration object containing input and output Zod schemas
 * @param config.input - Zod schema for validating the input parameters
 * @param config.output - Zod schema for validating the output response
 * @returns An endpoint definition with type 'query'
 *
 * @example
 * ```typescript
 * const getUser = query({
 *   input: z.object({ id: z.string() }),
 *   output: z.object({ id: z.string(), name: z.string() }),
 * });
 * ```
 */
export function query(config: {
  input: ZodType;
  output: ZodType;
}): EndpointDefinition {
  return {
    type: 'query',
    input: config.input,
    output: config.output,
  };
}

/**
 * Creates a mutation endpoint definition.
 * Mutations are typically used for write operations that modify server state.
 *
 * @param config - Configuration object containing input and output Zod schemas
 * @param config.input - Zod schema for validating the input parameters
 * @param config.output - Zod schema for validating the output response
 * @returns An endpoint definition with type 'mutation'
 *
 * @example
 * ```typescript
 * const createUser = mutation({
 *   input: z.object({ name: z.string(), email: z.string().email() }),
 *   output: z.object({ id: z.string(), name: z.string() }),
 * });
 * ```
 */
export function mutation(config: {
  input: ZodType;
  output: ZodType;
}): EndpointDefinition {
  return {
    type: 'mutation',
    input: config.input,
    output: config.output,
  };
}
