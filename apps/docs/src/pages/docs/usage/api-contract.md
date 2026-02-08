---
layout: ../../../layouts/SiteLayout.astro
title: API Contract Definition
description: How to define your xRPC API contract using TypeScript and Zod schemas
showSidebar: true
---


# API Contract Definition

This guide shows how to define your xRPC API contract using TypeScript and Zod schemas. The API contract is a **pure DSL** - it defines schemas and endpoints only, with no implementation details. Handlers are implemented separately in server files.

**Important**: Your contract file must export `router`:
```typescript
export const router = createRouter({ ... });
```

## Core Concepts

An xRPC API contract uses a hierarchical structure:

- **Router**: Primary grouping mechanism that exports all endpoints (single export per contract)
- **Endpoint Groups**: Named API namespaces (like `greeting`, `user`, `product`)
- **Queries & Mutations**: Individual RPC methods within a group
- **Types**: Shared data schemas defined with Zod (like protobuf messages)

The hierarchy is: **Router → Endpoint Groups → Queries/Mutations**

## Simple Example

```typescript
import { z } from 'zod';
import { createRouter, group, query, mutation } from 'xrpckit';

// Types: Shared data schemas
const GreetingInput = z.object({ name: z.string() });
const GreetingOutput = z.object({ message: z.string() });

// Endpoint group: Named API namespace
const greeting = group("greeting", {
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
export const router = createRouter({
  greeting,  // Endpoint group
});
```

## Multiple Endpoints

```typescript
import { z } from 'zod';
import { createRouter, group, query, mutation } from 'xrpckit';

// User group
const user = group("user", {
  getUser: query({
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),
  updateUser: mutation({
    input: z.object({ id: z.string(), name: z.string().optional(), email: z.string().optional() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),
});

// Product group
const product = group("product", {
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
  user,      // Endpoint group
  product,   // Endpoint group
});
```

## Inline Types

For simple cases, define types inline:

```typescript
import { z } from 'zod';
import { createRouter, group, query, mutation } from 'xrpckit';

export const router = createRouter({
  user: group("user", {
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
import { createRouter, group, query, mutation } from 'xrpckit';

// Shared types
const UserId = z.string();
const User = z.object({ id: UserId, name: z.string(), email: z.string() });
const UserUpdate = z.object({ name: z.string().optional(), email: z.string().optional() });

export const router = createRouter({
  user: group("user", {
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

Each method within a group is either a query or mutation:

- **Query**: Read operations that don't modify state
- **Mutation**: Write operations that modify state

Both use the same structure with `input` and `output` properties. **No handlers in the contract** - those are implemented separately in server files (see [Go Server](../go-server/), [TypeScript Server](../typescript-server/), or [Kotlin Server](../kotlin-spring-boot-server/)).

## Flat Endpoints (No Groups)

For small contracts, you can define endpoints directly at the router root:

```typescript
import { z } from 'zod';
import { createRouter, query, mutation } from 'xrpckit';

export const router = createRouter({
  ping: query({
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
  }),
  setStatus: mutation({
    input: z.object({ status: z.string() }),
    output: z.object({ success: z.boolean() }),
  }),
});
```

This produces method names like `ping` and `setStatus` (without a group prefix).

## Code Generation

After defining your contract, generate code for your target frameworks:

```bash
# Generate for specific framework targets
xrpc generate --targets go-server,ts-client
```

**Planned targets**: `go-client` is not yet available in the CLI.

**Note**: The xRPC CLI runs on **Node.js** (>= 18). Generated code runs on native runtimes for each target language (Go runtime, Node.js/Bun, etc.).
