import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpckit/core';

const greeting = createEndpoint({
  greet: query({
    input: z.object({ 
      name: z.string().min(1).max(100),
      email: z.string().email().optional(),
    }),
    output: z.object({ message: z.string() }),
  }),
  createUser: mutation({
    input: z.object({
      name: z.string().min(3).max(50),
      email: z.string().email(),
      age: z.number().min(18).max(120).int(),
      tags: z.array(z.string()).min(1).max(10),
    }),
    output: z.object({ id: z.string(), name: z.string() }),
  }),
});

export const router = createRouter({
  greeting,
});
