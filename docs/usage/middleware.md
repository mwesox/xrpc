---
layout: default
title: Middleware
description: Cross-cutting concerns with xRPC middleware
---

# Middleware

Middleware in xRPC intercepts requests before they reach your handlers, allowing you to handle authentication, logging, request ID injection, and other cross-cutting concerns. Middleware can extend the request context with typed data.

> **Note**: TypeScript middleware hooks are planned for the `ts-express` target. Go middleware is available today.

## Is Middleware Required?

**No.** xRPC middleware is optional. Your framework's native middleware works perfectly fine.

| Use framework middleware (Express, Gin, etc.) for: | Use xRPC middleware when you need: |
|---------------------------------------------------|-----------------------------------|
| CORS, compression, rate limiting | **Typed context** passed to handlers |
| Standard request logging | Planned: contract-defined context schema |
| Static file serving | Planned: cross-language type generation |

If you just need standard middleware features, use what your framework provides. Contract-defined context schemas and cross-language context generation are planned; today, middleware is defined as functions in your contract and handled per target.

## Defining Middleware in Contract

Define middleware in your contract. Cross-language typed context is planned; today, each target handles context differently.

```typescript
import { createRouter, type Middleware } from 'xrpckit';

type AuthContext = {
  userId: string;
  role: 'user' | 'admin';
};

const authMiddleware: Middleware<AuthContext> = async (req, ctx) => {
  const token = req.headers.get('authorization');
  return { ...ctx, userId: extractUserId(token), role: 'user' };
};

export const router = createRouter({
  middleware: [authMiddleware],
  // ... endpoints
});
```

## TypeScript Implementation

**Planned (`ts-express`)**: The API below is a draft and may change. It illustrates the intended flow.

```typescript
import { createMiddleware, createHandler } from './xrpc/server';

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
func authMiddleware(ctx *xrpc.Context) *xrpc.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")
    if token == "" {
        return xrpc.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }

    userId, role, err := validateToken(strings.TrimPrefix(token, "Bearer "))
    if err != nil {
        return xrpc.NewMiddlewareError(err)
    }

    ctx.Data["userId"] = userId
    ctx.Data["role"] = role
    return xrpc.NewMiddlewareResult(ctx)
}

// Handler: access context data from the map
func getProfileHandler(ctx *xrpc.Context, input xrpc.GetProfileInput) (xrpc.GetProfileOutput, error) {
    userId, _ := ctx.Data["userId"].(string)
    role, _ := ctx.Data["role"].(string)

    if role != "admin" && userId != input.Id {
        return nil, fmt.Errorf("not authorized")
    }
    return db.FindUser(input.Id)
}
```

Return `xrpc.NewMiddlewareError()` to short-circuit with an error, or `xrpc.NewMiddlewareResponse()` for a custom HTTP response.

## Context Helpers

xRPC context access by language:

| Language | Store context | Retrieve context |
|----------|--------------|------------------|
| **TypeScript** | `return { ...ctx, userId }` | `ctx.userId` (directly typed) |
| **Go** | `ctx.Data["userId"] = value` | `ctx.Data["userId"].(string)` |

Go access uses type assertions to handle missing context gracefully. TypeScript context typing is planned for `ts-express`.

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

- [TypeScript Server](/docs/usage/typescript-server.html) - Planned TypeScript server setup
- [Go Server](/docs/usage/go-server.html) - Full Go server setup
- [API Contract](/docs/usage/api-contract.html) - Define your schema
