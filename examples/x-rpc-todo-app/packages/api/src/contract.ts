import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpckit/core';

// Shared Todo schema
const Todo = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
});

// Todo endpoint group with CRUD operations
const todo = createEndpoint({
  list: query({
    input: z.object({}),
    output: z.array(Todo),
  }),
  create: mutation({
    input: z.object({ title: z.string() }),
    output: Todo,
  }),
  toggle: mutation({
    input: z.object({ id: z.string() }),
    output: Todo,
  }),
  delete: mutation({
    input: z.object({ id: z.string() }),
    output: z.object({ success: z.boolean() }),
  }),
});

// Export the router
export const router = createRouter({ todo });
