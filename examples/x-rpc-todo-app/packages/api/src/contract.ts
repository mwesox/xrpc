import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpckit/schema';

// =============================================================================
// ENUMS
// =============================================================================

const Priority = z.enum(['low', 'medium', 'high', 'urgent']);
const TaskStatus = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

// =============================================================================
// NESTED OBJECT SCHEMAS
// =============================================================================

const Assignee = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
});

const Tag = z.object({
  name: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const Subtask = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
});

// =============================================================================
// MAIN TASK SCHEMA
// =============================================================================

const Task = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus,
  priority: Priority,
  dueDate: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional().nullable(),
  assignee: Assignee.optional(),
  tags: z.array(Tag).max(5),
  subtasks: z.array(Subtask).max(20),
  estimatedHours: z.number().positive().max(100).optional(),
  position: z.number().int().min(0),
});

// Summary version for list views (lighter weight)
const TaskSummary = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: TaskStatus,
  priority: Priority,
  dueDate: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional().nullable(),
  tagCount: z.number().int().min(0),
  subtaskCount: z.number().int().min(0),
  subtaskCompletedCount: z.number().int().min(0),
  estimatedHours: z.number().positive().max(100).optional(),
  position: z.number().int().min(0),
});

// =============================================================================
// TASK ENDPOINTS
// =============================================================================

const task = createEndpoint({
  // List tasks with optional filtering
  list: query({
    input: z.object({
      status: TaskStatus.optional(),
      priority: Priority.optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    output: z.object({
      tasks: z.array(TaskSummary),
      total: z.number().int().min(0),
    }),
  }),

  // Get a single task with full details
  get: query({
    input: z.object({
      id: z.string().uuid(),
    }),
    output: Task,
  }),

  // Create a new task
  create: mutation({
    input: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      priority: Priority,
      dueDate: z.string().optional(),
      tags: z.array(Tag).max(5).optional(),
      estimatedHours: z.number().positive().max(100).optional(),
    }),
    output: Task,
  }),

  // Update an existing task
  update: mutation({
    input: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional().nullable(),
      status: TaskStatus.optional(),
      priority: Priority.optional(),
      dueDate: z.string().optional().nullable(),
      estimatedHours: z.number().positive().max(100).optional().nullable(),
    }),
    output: Task,
  }),

  // Delete a task
  delete: mutation({
    input: z.object({
      id: z.string().uuid(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  }),
});

// =============================================================================
// SUBTASK ENDPOINTS
// =============================================================================

const subtask = createEndpoint({
  // Add a subtask to a task
  add: mutation({
    input: z.object({
      taskId: z.string().uuid(),
      title: z.string().min(1).max(200),
    }),
    output: Subtask,
  }),

  // Toggle subtask completion status
  toggle: mutation({
    input: z.object({
      taskId: z.string().uuid(),
      subtaskId: z.string().uuid(),
    }),
    output: Subtask,
  }),

  // Delete a subtask
  delete: mutation({
    input: z.object({
      taskId: z.string().uuid(),
      subtaskId: z.string().uuid(),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  }),
});

// =============================================================================
// TAG ENDPOINTS
// =============================================================================

const tag = createEndpoint({
  // Add a tag to a task
  add: mutation({
    input: z.object({
      taskId: z.string().uuid(),
      name: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }),
    output: Tag,
  }),

  // Remove a tag from a task
  remove: mutation({
    input: z.object({
      taskId: z.string().uuid(),
      tagName: z.string().min(1).max(30),
    }),
    output: z.object({
      success: z.boolean(),
    }),
  }),
});

// =============================================================================
// EXPORT ROUTER
// =============================================================================

export const router = createRouter({
  task,
  subtask,
  tag,
});
