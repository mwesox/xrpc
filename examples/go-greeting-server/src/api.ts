import { z } from 'zod';
import { createRouter, createEndpoint, query } from '@xrpc/core';

const greeting = createEndpoint({
  greet: query({
    input: z.object({ name: z.string() }),
    output: z.object({ message: z.string() }),
  }),
});

export const router = createRouter({
  greeting,
});
