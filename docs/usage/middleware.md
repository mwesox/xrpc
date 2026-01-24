---
layout: default
title: Middleware
description: Cross-cutting concerns with xRPC middleware
---

# Middleware

Middleware in xRPC intercepts requests before they reach your handlers, allowing you to handle authentication, logging, request ID injection, and other cross-cutting concerns. Middleware can extend the request context with typed data.

## Is Middleware Required?

**No.** xRPC middleware is optional. Your framework's native middleware works perfectly fine.

| Use framework middleware (Express, Gin, etc.) for: | Use xRPC middleware when you need: |
|---------------------------------------------------|-----------------------------------|
| CORS, compression, rate limiting | **Typed context** passed to handlers |
| Standard request logging | Contract-defined context schema |
| Static file serving | Cross-language type generation |

If you just need standard middleware features, use what your framework provides. xRPC middleware is specifically for when you want typed context data that's validated against your contract schema.

## Defining Middleware in Contract

Define middleware in your contract to get type-safe context across all generated targets:

```typescript
import { z } from 'zod';
import { middleware } from '@xrpckit/schema';

// Define what your middleware adds to context
const authMiddleware = middleware({
  name: 'auth',
  context: z.object({
    userId: z.string().uuid(),
    role: z.enum(['user', 'admin']),
  }),
});

export const api = createRouter({
  middleware: [authMiddleware],
  // ... endpoints
});
```

## TypeScript Implementation

Implement middleware as functions that validate and extend the context:

```typescript
import { createMiddleware, createHandler } from './generated/server';

// Middleware: validate token and add typed user data to context
export const authMiddleware = createMiddleware('auth', async (req, ctx) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('Missing token');

  const payload = await verifyJWT(token);
  return { ...ctx, userId: payload.sub, role: payload.role };
});

// Handler: receives fully typed context
export const getProfile = createHandler('user.getProfile', async (input, ctx) => {
  // ctx.userId and ctx.role are typed from contract
  if (ctx.role !== 'admin' && ctx.userId !== input.id) {
    throw new Error('Not authorized');
  }
  return await db.users.findById(input.id);
});
```

Throwing an error in middleware short-circuits the request and returns an error response.

## Go Implementation

Go middleware follows the same pattern using `ctx.Data` for context storage:

```go
// Middleware: validate token and store user data in context
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")
    if token == "" {
        return server.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }

    userId, role, err := validateToken(strings.TrimPrefix(token, "Bearer "))
    if err != nil {
        return server.NewMiddlewareError(err)
    }

    ctx.Data["userId"] = userId
    ctx.Data["role"] = role
    return server.NewMiddlewareResult(ctx)
}

// Handler: use generated helpers to access typed context
func getProfileHandler(ctx *server.Context, input server.GetProfileInput) (*server.GetProfileOutput, error) {
    userId, _ := server.GetUserId(ctx)  // Type-safe helper
    role, _ := server.GetRole(ctx)

    if role != "admin" && userId != input.Id {
        return nil, fmt.Errorf("not authorized")
    }
    return db.FindUser(input.Id)
}
```

Return `server.NewMiddlewareError()` to short-circuit with an error, or `server.NewMiddlewareResponse()` for a custom HTTP response.

## Context Helpers

xRPC generates type-safe helpers for accessing context data:

| Language | Store context | Retrieve context |
|----------|--------------|------------------|
| **TypeScript** | `return { ...ctx, userId }` | `ctx.userId` (directly typed) |
| **Go** | `ctx.Data["userId"] = value` | `server.GetUserId(ctx)` (generated helper) |

Go helpers return `(value, ok)` to handle missing context gracefully. TypeScript context is directly typed from your contract schema.

## Middleware Order

Middleware executes in registration order. Recommended ordering:

1. **Request ID** - Generate/extract ID first for tracing
2. **Logging** - Log incoming requests with ID
3. **Authentication** - Validate tokens, extract user info
4. **Authorization** - Check permissions (or handle per-handler)

```go
router.Use(requestIdMiddleware)  // 1st
router.Use(loggingMiddleware)    // 2nd
router.Use(authMiddleware)       // 3rd
```

## Next Steps

- [TypeScript Server](/docs/usage/typescript-server.html) - Full TypeScript server setup
- [Go Server](/docs/usage/go-server.html) - Full Go server setup
- [API Contract](/docs/usage/api-contract.html) - Define your schema
