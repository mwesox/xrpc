---
layout: default
title: TypeScript Client
description: How to use an xRPC client in TypeScript
---

# TypeScript Client

This guide shows how to use an xRPC client in TypeScript.

## Prerequisites

1. Define your API contract (see `api-contract.md`)
2. Generate TypeScript Express code: `xrpc generate --targets typescript-express`
3. Use the generated client in your application

**Note**: The xRPC CLI and code generation run on **Bun runtime**, but the generated TypeScript code runs on **Node.js or Bun** (your choice). The generated client is self-contained and uses standard HTTP libraries (fetch API). No separate runtime libraries are needed.

**Framework-Specific Target**: The `typescript-express` target generates code tailored specifically for Express. The client code is generated alongside server code in `generated/typescript-express/`.

## Generated Code Structure

The client code is generated in `generated/typescript-express/client.ts`:
- Type-safe client implementation using fetch API
- Request serialization (to JSON)
- Response deserialization (from JSON)
- Error handling
- Type-safe method wrappers for each endpoint

## Basic Usage

```typescript
import { createClient } from './generated/typescript-express/client';  // Generated code
import type { Router } from './generated/typescript-express/types';    // Generated types

const client = createClient<Router>('http://localhost:3000/api');

// Call a query
const result = await client.greet({ name: 'World' });
console.log(result.message); // "Hello, World!"

// Call a mutation
const greeting = await client.setGreeting({
  name: 'Alice',
  greeting: 'Hi',
});
console.log(greeting.message); // "Hi, Alice!"
```

## Type Safety

All API calls are fully type-safe with autocomplete:

```typescript
// TypeScript knows the input type
const result = await client.greet({ 
  name: 'World'  // ✅ Type-checked
});

// TypeScript knows the output type
console.log(result.message); // ✅ Type-checked
```

## Error Handling

```typescript
try {
  const result = await client.greet({ name: 'World' });
  console.log(result.message);
} catch (error) {
  console.error('API call failed:', error);
}
```
