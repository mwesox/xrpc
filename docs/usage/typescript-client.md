---
layout: default
title: TypeScript Client
description: How to use an xRPC client in TypeScript
---

# TypeScript Client

This guide shows how to use the **ts-client** target (vanilla TypeScript client).

## Prerequisites

1. Define your API contract (see [API Contract](api-contract.html)) and export `router`
2. Generate client code: `xrpc generate --targets ts-client`
3. Use the generated client in your application

**Note**: The xRPC CLI runs on **Node.js** (>= 18). The generated client runs on **Node.js or Bun** (fetch API). Runtime validation uses `zod`, so make sure `zod` is installed. The generated types import `router` from your contract file and use `xrpckit` type utilities, so keep `xrpckit` in your dev dependencies for type-checking.

Server generation for Express is planned as a separate `ts-express` target.

## Generated Code Structure

Generated files are written to `<output>/xrpc/`:
- `client.ts`: Type-safe client implementation using fetch API
- `types.ts`: Zod schema exports and inferred input/output types

## Basic Usage

```typescript
import { createClient } from './xrpc/client';  // Generated code

const api = createClient({
  baseUrl: 'http://localhost:3000/api',
  validateInputs: true,
  validateOutputs: true,
});

// Call a query
const result = await api.greeting.greet({ name: 'World' });
console.log(result.message); // "Hello, World!"

// Call a mutation
const greeting = await api.greeting.setGreeting({
  name: 'Alice',
  greeting: 'Hi',
});
console.log(greeting.message); // "Hi, Alice!"
```

## Type Safety

All API calls are fully type-safe with autocomplete:

```typescript
// TypeScript knows the input type
const result = await api.greeting.greet({
  name: 'World',  // ✅ Type-checked
});

// TypeScript knows the output type
console.log(result.message); // ✅ Type-checked
```

## Error Handling

```typescript
try {
  const result = await api.greeting.greet({ name: 'World' });
  console.log(result.message);
} catch (error) {
  console.error('API call failed:', error);
}
```
