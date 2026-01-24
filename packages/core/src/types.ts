import type { z, ZodType } from 'zod';

/**
 * Infer input type from an endpoint definition
 * @example
 * type CreateInput = InferInput<typeof router.todo.create>;
 */
export type InferInput<T extends { input: ZodType }> = z.infer<T['input']>;

/**
 * Infer output type from an endpoint definition
 * @example
 * type CreateOutput = InferOutput<typeof router.todo.create>;
 */
export type InferOutput<T extends { output: ZodType }> = z.infer<T['output']>;
