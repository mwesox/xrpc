import { z } from 'zod';
import { createRouter, group, query } from 'xrpckit';

const demo = group("demo", {
  unionInput: query({
    input: z.union([z.string(), z.number()]),
    output: z.object({ ok: z.boolean() }),
  }),
  tupleOutput: query({
    input: z.object({ id: z.string() }),
    output: z.tuple([z.string(), z.number()]),
  }),
  enumOutput: query({
    input: z.object({}),
    output: z.enum(['active', 'inactive']),
  }),
});

export const router = createRouter({
  demo,
});
