import type { z } from "zod";

/**
 * Infer input type from an endpoint definition
 * @example
 * type CreateInput = InferInput<typeof router.todo.create>;
 */
export type InferInput<T extends { input: z.ZodTypeAny }> = z.infer<T["input"]>;

/**
 * Infer output type from an endpoint definition
 * @example
 * type CreateOutput = InferOutput<typeof router.todo.create>;
 */
export type InferOutput<T extends { output: z.ZodTypeAny }> = z.infer<
  T["output"]
>;
