import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpckit/schema';

// Shared Todo schema with validation
const Todo = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  createdAt: z.string(),
});

// Todo endpoint group with CRUD operations
// Validation rules are automatically enforced by the generated server
const todo = createEndpoint({
  list: query({
    input: z.object({}),
    output: z.array(Todo),
  }),
  create: mutation({
    input: z.object({
      title: z.string().min(1).max(200), // Title must be 1-200 characters
    }),
    output: Todo,
  }),
  toggle: mutation({
    input: z.object({
      id: z.string().min(1), // ID is required
    }),
    output: Todo,
  }),
  delete: mutation({
    input: z.object({
      id: z.string().min(1), // ID is required
    }),
    output: z.object({ success: z.boolean() }),
  }),
});

// Export the router
export const router = createRouter({ todo });
