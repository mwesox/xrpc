---
layout: default
title: API Contract Definition
description: How to define your xRPC API contract using TypeScript and Zod schemas
---

# API Contract Definition

This guide shows how to define your xRPC API contract using TypeScript and Zod schemas. The API contract is a **pure DSL** - it defines schemas and endpoints only, with no implementation details. Handlers are implemented separately in server files.

## Core Concepts

An xRPC API contract uses a hierarchical structure:

- **Router**: Primary grouping mechanism that exports all endpoints (single export per contract)
- **Endpoints**: Named API namespaces (like `greeting`, `user`, `product`)
- **Queries & Mutations**: Individual RPC methods within an endpoint
- **Types**: Shared data schemas defined with Zod (like protobuf messages)

The hierarchy is: **Router → Endpoints → Queries/Mutations**

## Simple Example

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

// Types: Shared data schemas
const GreetingInput = z.object({ name: z.string() });
const GreetingOutput = z.object({ message: z.string() });

// Endpoint: Named API namespace
const greeting = createEndpoint({
  // Query: Read operation
  greet: query({
    input: GreetingInput,
    output: GreetingOutput,
  }),
  // Mutation: Write operation
  setGreeting: mutation({
    input: z.object({ name: z.string(), greeting: z.string() }),
    output: GreetingOutput,
  }),
});

// Router: Primary grouping mechanism (single export)
export const api = createRouter({
  greeting,  // Endpoint
});
```

## Multiple Endpoints

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

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
export const api = createRouter({
  user,      // Endpoint
  product,   // Endpoint
});
```

## Inline Types

For simple cases, define types inline:

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

export const api = createRouter({
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
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

// Shared types
const UserId = z.string();
const User = z.object({ id: UserId, name: z.string(), email: z.string() });
const UserUpdate = z.object({ name: z.string().optional(), email: z.string().optional() });

export const api = createRouter({
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

Each method within an endpoint is either a query or mutation:

- **Query**: Read operations that don't modify state
- **Mutation**: Write operations that modify state

Both use the same structure with `input` and `output` properties. **No handlers in the contract** - those are implemented separately in server files (see [Go Server](go-server.html), [TypeScript Server](typescript-server.html), or [Kotlin Server](kotlin-springboot-server.html)).

## Code Generation

After defining your contract, generate code for your target frameworks:

```bash
# Generate for specific framework targets
xrpc generate --targets go,typescript-express,kotlin-spring-boot
```

**Note**: The xRPC CLI and code generation run on **Bun runtime**. The generated code is self-contained and runs on native runtimes for each target language (Go runtime, Node.js/Bun, etc.).
