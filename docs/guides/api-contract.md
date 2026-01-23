
# API Contract Definition

This guide shows how to define your xRPC API contract using TypeScript and Zod schemas. The API contract is a **pure DSL** - it defines schemas and endpoints only, with no implementation details. Handlers are implemented separately in server files.

## Core Concepts

An xRPC API contract uses a hierarchical structure:

- **Router**: Primary grouping mechanism that exports all endpoints (single export per contract)
- **Endpoints**: Collections of related endpoints (like protobuf services)
- **Endpoints**: Individual RPC methods (queries and mutations) with input/output schemas
- **Types**: Shared data schemas defined with Zod (like protobuf messages)

The hierarchy is: **Router → Endpoints → Endpoints**

## Simple Example

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

// Types: Shared data schemas
const GreetingInput = z.object({ name: z.string() });
const GreetingOutput = z.object({ message: z.string() });

// Endpoint: Collection of related endpoints
const greeting = createEndpoint({
  // Endpoint: Individual RPC method (query)
  greet: query({
    input: GreetingInput,
    output: GreetingOutput,
  }),
  // Endpoint: Individual RPC method (mutation)
  setGreeting: mutation({
    input: z.object({ name: z.string(), greeting: z.string() }),
    output: GreetingOutput,
  }),
});

// Router: Primary grouping mechanism (single export)
export const router = createRouter({
  greeting,  // Endpoint
});
```

## Multiple Endpoints

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

// User endpoint
const user = createEndpoint({
  getUser: query({
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),
  updateUser: mutation({
    input: z.object({ id: z.string(), name: z.string().optional(), email: z.string().optional() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),
});

// Product endpoint
const product = createEndpoint({
  listProducts: query({
    input: z.object({ limit: z.number().optional(), offset: z.number().optional() }),
    output: z.array(z.object({ id: z.string(), name: z.string(), price: z.number() })),
  }),
  createProduct: mutation({
    input: z.object({ name: z.string(), price: z.number() }),
    output: z.object({ id: z.string(), name: z.string(), price: z.number() }),
  }),
});

// Router: Primary grouping mechanism (single export)
export const router = createRouter({
  user,      // Endpoint
  product,   // Endpoint
});
```

## Inline Types

For simple cases, define types inline:

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

export const router = createRouter({
  user: createEndpoint({
    getUser: query({
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), name: z.string() }),
    }),
    updateUser: mutation({
      input: z.object({ id: z.string(), name: z.string() }),
      output: z.object({ id: z.string(), name: z.string() }),
    }),
  }),
});
```

## Shared Types

For reusable types, define them separately:

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

// Shared types
const UserId = z.string();
const User = z.object({ id: UserId, name: z.string(), email: z.string() });
const UserUpdate = z.object({ name: z.string().optional(), email: z.string().optional() });

export const router = createRouter({
  user: createEndpoint({
    getUser: query({
      input: z.object({ id: UserId }),
      output: User,
    }),
    updateUser: mutation({
      input: z.object({ id: UserId }).merge(UserUpdate),
      output: User,
    }),
  }),
});
```

## Query vs Mutation

Endpoints can be either queries or mutations:

- **Query**: Read operations that don't modify state
- **Mutation**: Write operations that modify state

Both use the same structure with `input` and `output` properties. **No handlers in the contract** - those are implemented separately in server files (see `go-server.md`, `typescript-server.md`, or `kotlin-springboot-server.md`).

## Code Generation

After defining your contract, generate code for your target frameworks:

```bash
# Generate for specific framework targets
xrpc generate --targets go,typescript-express,kotlin-spring-boot
```

**Note**: The xRPC CLI and code generation run on **Bun runtime**. The generated code is self-contained and runs on native runtimes for each target language (Go runtime, Node.js/Bun, etc.).
