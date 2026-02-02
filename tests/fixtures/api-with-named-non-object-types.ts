import { z } from 'zod';
import { createRouter, createEndpoint, query } from 'xrpckit';

const demo = createEndpoint({
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
