---
layout: default
title: TypeScript Express Server
description: How to implement an xRPC server using TypeScript and Express
---

# TypeScript Express Server

This guide shows how to implement an xRPC server using TypeScript and Express.

> **Planned**: The `ts-express` target is not available in the CLI yet. This page is a preview and the API may change. Current CLI targets are `go-server` and `ts-client`.

## Prerequisites

1. Define your API contract (see [API Contract](api-contract.html)) and export `router`
2. Generate TypeScript Express code: `xrpc generate --targets ts-express` (planned)
3. Implement your handlers using the generated code

**Note**: The xRPC CLI runs on **Node.js** (>= 18). The generated TypeScript code is expected to run on **Node.js or Bun** and use Express framework APIs.

**Framework-Specific Target**: xRPC generates code for framework-specific targets. The `ts-express` target is planned to generate code tailored specifically for Express, including Express middleware integration.

## Basic Server Setup

First, define your API contract (see [API Contract](api-contract.html) for details):

```typescript
// contract.ts
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

export const router = createRouter({
  greeting: createEndpoint({
    greet: query({
      input: z.object({ name: z.string() }),
      output: z.object({ message: z.string() }),
    }),
    setGreeting: mutation({
      input: z.object({ name: z.string(), greeting: z.string() }),
      output: z.object({ message: z.string() }),
    }),
  }),
});

export type Api = typeof router;
```

Then, generate code and implement your server with handlers:

```bash
# Generate TypeScript Express code (planned target)
xrpc generate --targets ts-express
```

This is planned to generate code in `<output>/xrpc/`:
- `types.ts`: Type definitions including `ServerRouter` type
- `server.ts`: Express middleware factory (`createServer`)

```typescript
// server.ts
import express from 'express';
import { createServer } from './xrpc/server';  // Generated code (planned)
import type { ServerRouter } from './xrpc/types';  // Generated types (planned)

// Implement handlers matching the router structure
// TypeScript enforces that serverRouter matches the contract exactly
const serverRouter: ServerRouter = {
  greeting: {
    greet: {
      handler: async ({ input }) => ({
        message: `Hello, ${input.name}!`,
      }),
    },
    setGreeting: {
      handler: async ({ input }) => ({
        message: `${input.greeting}, ${input.name}!`,
      }),
    },
  },
};

const app = express();
app.use(express.json());
app.use('/api', createServer(serverRouter));  // Generated Express middleware

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Router, Endpoints, and Queries/Mutations

xRPC uses a hierarchical structure:
- **Router**: Primary grouping mechanism that exports all endpoints
- **Endpoints**: Named API namespaces (like `greeting`, `user`, `product`)
- **Queries & Mutations**: Individual RPC methods within an endpoint

## Multiple Endpoints

When working with multiple endpoints in your router:

```typescript
// contract.ts
export const router = createRouter({
  user: createEndpoint({
    getUser: query({ ... }),
    updateUser: mutation({ ... }),
  }),
  product: createEndpoint({
    listProducts: query({ ... }),
    createProduct: mutation({ ... }),
  }),
});

export type Api = typeof router;
```

Implement handlers for all endpoints:

```typescript
// server.ts
import { createServer } from './xrpc/server';  // Generated code (planned)
import type { ServerRouter } from './xrpc/types';  // Generated types (planned)

// Type-safe: TypeScript ensures all endpoints (user, product) and their queries/mutations are implemented
const serverRouter: ServerRouter = {
  user: {
    getUser: {
      handler: async ({ input }) => ({
        id: input.id,
        name: 'John Doe',
        email: 'john@example.com',
      }),
    },
    updateUser: {
      handler: async ({ input }) => ({
        id: input.id,
        name: input.name || 'John Doe',
        email: input.email || 'john@example.com',
      }),
    },
  },
  product: {
    listProducts: {
      handler: async ({ input }) => [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 },
      ],
    },
    createProduct: {
      handler: async ({ input }) => ({
        id: 'new-id',
        name: input.name,
        price: input.price,
      }),
    },
  },
};

app.use('/api', createServer(serverRouter));
```

## Type Safety

xRPC ensures full type safety through generated types. The generated code provides a `ServerRouter` type that matches your API contract exactly.

### Generated Types

After running `xrpc generate --targets ts-express`, the generated code is planned to include:

```typescript
// xrpc/types.ts
export type ServerRouter = {
  greeting: {
    greet: {
      handler: (args: { input: GreetInput; context: Context }) => Promise<GreetOutput>;
    };
    setGreeting: {
      handler: (args: { input: SetGreetingInput; context: Context }) => Promise<SetGreetingOutput>;
    };
  };
};

export type GreetInput = { name: string };
export type GreetOutput = { message: string };
export type SetGreetingInput = { name: string; greeting: string };
export type SetGreetingOutput = { message: string };
```

### Type-Safe Handlers

By typing `serverRouter` with `ServerRouter`, TypeScript ensures:

- **Structure matches contract**: All endpoints and their queries/mutations must be implemented
- **Input types are correct**: Handler input types match Zod schemas
- **Output types are correct**: Handler return types match Zod schemas
- **Autocomplete**: Full IntelliSense support for handler structure
- **Compile-time errors**: TypeScript catches mismatches before runtime

### Example: Type Errors

TypeScript will catch errors if your handlers don't match the contract:

```typescript
const serverRouter: ServerRouter = {
  greeting: {
    greet: {
      handler: async ({ input }) => ({
        // ❌ Error: Property 'message' is missing
        // TypeScript knows the output must match GreetOutput
      }),
    },
    // ❌ Error: Property 'setGreeting' is missing
    // TypeScript enforces all queries/mutations must be implemented
  },
};
```

### Benefits

- **Compile-time safety**: Catch errors before running code
- **Refactoring support**: Rename endpoints and methods with confidence
- **Autocomplete**: IDE suggests available endpoints and their methods
- **Documentation**: Types serve as inline documentation

## Handler Function

The `handler` function is fully type-safe. TypeScript knows the exact input and output types from your API contract:

```typescript
const serverRouter: ServerRouter = {
  greeting: {
    greet: {
      // TypeScript knows input is GreetInput: { name: string }
      // TypeScript knows return type must be Promise<GreetOutput>
      handler: async ({ input, context }) => {
        // input.name is typed as string ✅
        const { name } = input;
        
        // context is typed (can be extended with middleware)
        const userId = context.userId;
        
        // Return type is checked - must match GreetOutput: { message: string }
        return {
          message: `Hello, ${name}!`,  // ✅ Type-checked
        };
      },
    },
  },
};
```

### Handler Signature

Each handler receives:
- `input`: **Typed input** matching your Zod schema (e.g., `GreetInput`)
- `context`: Request context (can be extended with middleware)

Each handler must return:
- **Typed output** matching your Zod schema (e.g., `Promise<GreetOutput>`)

## Related Target

The TypeScript client is generated separately via the **ts-client** target (see [TypeScript Client](typescript-client.html)).

### Type Inference

TypeScript automatically infers types from the `ServerRouter` type:

```typescript
// TypeScript knows the exact types for each handler
const greetHandler = serverRouter.greeting.greet.handler;
// greetHandler: (args: { input: GreetInput; context: Context }) => Promise<GreetOutput>

// Full type safety and autocomplete
const result = await greetHandler({ 
  input: { name: 'World' },  // ✅ Type-checked
  context: {} 
});
// result: Promise<GreetOutput>
```
