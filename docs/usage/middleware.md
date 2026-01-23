---
layout: default
title: Middleware
description: Cross-cutting concerns with xRPC middleware
---

# Middleware

Middleware in xRPC allows you to handle cross-cutting concerns like authentication, logging, request ID injection, and cookie parsing. Middleware executes before your handlers and can extend the request context with typed data.

## What is Middleware?

Middleware functions intercept requests before they reach your handlers. They can:

- **Authenticate** requests and attach user information to the context
- **Log** requests and responses for debugging and monitoring
- **Parse cookies** and session data
- **Inject request IDs** for distributed tracing
- **Short-circuit** requests that fail validation

Each middleware receives the current context and can either pass it along (optionally modified) or short-circuit the request with an error or custom response.

## Defining Middleware in Contract

You can define middleware directly in your API contract. This ensures type safety across all generated targets:

```typescript
// api.ts
import { z } from 'zod';
import { createRouter, createEndpoint, query, middleware } from '@xrpc/core';

// Define what your middleware adds to context
const authMiddleware = middleware({
  name: 'auth',
  context: z.object({
    userId: z.string().uuid(),
    role: z.enum(['user', 'admin']),
  }),
});

const loggingMiddleware = middleware({
  name: 'logging',
  context: z.object({
    requestId: z.string(),
  }),
});

const user = createEndpoint({
  getProfile: query({
    input: z.object({ id: z.string().uuid() }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
  }),
});

export const router = createRouter({
  middleware: [authMiddleware, loggingMiddleware],
  user,
});
```

The middleware definition specifies the shape of data it adds to the context. Generated code in each target language will provide type-safe access to this data.

## TypeScript Express Middleware

### Implementation

In TypeScript/Express, implement middleware as functions that modify the context:

```typescript
import { createMiddleware } from './generated/server';

// Authentication middleware
export const authMiddleware = createMiddleware('auth', async (req, ctx) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Missing authorization header');
  }

  const payload = await verifyJWT(token);

  return {
    ...ctx,
    userId: payload.sub,
    role: payload.role,
  };
});

// Logging middleware
export const loggingMiddleware = createMiddleware('logging', async (req, ctx) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  console.log(`[${requestId}] ${req.method} ${req.url}`);

  return {
    ...ctx,
    requestId,
  };
});
```

### Using Context in Handlers

Handlers receive the enriched context with full type safety:

```typescript
import { createHandler } from './generated/server';

export const getProfile = createHandler('user.getProfile', async (input, ctx) => {
  // ctx.userId and ctx.role are fully typed
  console.log(`User ${ctx.userId} requesting profile ${input.id}`);

  // Check authorization
  if (ctx.role !== 'admin' && ctx.userId !== input.id) {
    throw new Error('Not authorized to view this profile');
  }

  const user = await db.users.findById(input.id);
  return user;
});
```

### Error Handling

Middleware can throw errors to short-circuit the request:

```typescript
export const authMiddleware = createMiddleware('auth', async (req, ctx) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    // This stops the request and returns an error response
    throw new UnauthorizedError('Missing authorization header');
  }

  try {
    const payload = await verifyJWT(token);
    return { ...ctx, userId: payload.sub, role: payload.role };
  } catch (err) {
    throw new UnauthorizedError('Invalid token');
  }
});
```

## Go Middleware

Go middleware follows the same pattern with Go-specific conventions:

### Implementation

```go
package main

import (
    "fmt"
    "net/http"
    "github.com/yourorg/xrpc-go/server"
)

// Authentication middleware
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")
    if token == "" {
        return server.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }

    // Strip "Bearer " prefix
    if len(token) > 7 && token[:7] == "Bearer " {
        token = token[7:]
    }

    userId, role, err := validateToken(token)
    if err != nil {
        return server.NewMiddlewareError(fmt.Errorf("invalid token: %w", err))
    }

    // Extend context with user data
    ctx.Data["userId"] = userId
    ctx.Data["role"] = role
    return server.NewMiddlewareResult(ctx)
}

// Logging middleware with request ID
func loggingMiddleware(ctx *server.Context) *server.MiddlewareResult {
    requestId := ctx.Request.Header.Get("X-Request-ID")
    if requestId == "" {
        requestId = generateUUID()
    }

    ctx.Data["requestId"] = requestId
    log.Printf("[%s] %s %s", requestId, ctx.Request.Method, ctx.Request.URL.Path)

    return server.NewMiddlewareResult(ctx)
}
```

### Context Helpers

The generated code includes type-safe helper functions for accessing context data:

```go
func getProfileHandler(ctx *server.Context, input server.GetProfileInput) (*server.GetProfileOutput, error) {
    // Type-safe context access
    userId, ok := server.GetUserId(ctx)
    if !ok {
        return nil, fmt.Errorf("user ID not in context")
    }

    role, _ := server.GetRole(ctx)
    requestId, _ := server.GetRequestId(ctx)

    log.Printf("[%s] User %s (role: %s) requesting profile %s",
        requestId, userId, role, input.Id)

    // Authorization check
    if role != "admin" && userId != input.Id {
        return nil, fmt.Errorf("not authorized")
    }

    user, err := db.FindUser(input.Id)
    if err != nil {
        return nil, err
    }

    return &server.GetProfileOutput{
        Id:    user.ID,
        Name:  user.Name,
        Email: user.Email,
    }, nil
}
```

### Short-Circuiting

Middleware can stop request processing by returning an error or custom response:

```go
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")

    // Return error - sends 401 response
    if token == "" {
        return server.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }

    // Or return a custom response
    if isRateLimited(ctx.Request) {
        return server.NewMiddlewareResponse(
            http.StatusTooManyRequests,
            map[string]string{"error": "rate limited"},
        )
    }

    ctx.Data["userId"] = extractUserId(token)
    return server.NewMiddlewareResult(ctx)
}
```

### Registering Middleware

Register middleware with `router.Use()`. Middleware executes in registration order:

```go
func main() {
    router := server.NewRouter()

    // Middleware executes in order: logging -> auth
    router.Use(loggingMiddleware)
    router.Use(authMiddleware)

    router.Query("user.getProfile", getProfileHandler)

    http.Handle("/api", router)
    http.ListenAndServe(":8080", nil)
}
```

## Common Patterns

### Authentication

```typescript
// TypeScript
export const authMiddleware = createMiddleware('auth', async (req, ctx) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('Missing token');

  const payload = await verifyJWT(token);
  return { ...ctx, userId: payload.sub, role: payload.role };
});
```

```go
// Go
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := extractBearerToken(ctx.Request)
    if token == "" {
        return server.NewMiddlewareError(fmt.Errorf("missing token"))
    }

    payload, err := verifyJWT(token)
    if err != nil {
        return server.NewMiddlewareError(err)
    }

    ctx.Data["userId"] = payload.Sub
    ctx.Data["role"] = payload.Role
    return server.NewMiddlewareResult(ctx)
}
```

### Request ID Injection

```typescript
// TypeScript
export const requestIdMiddleware = createMiddleware('requestId', async (req, ctx) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  return { ...ctx, requestId };
});
```

```go
// Go
func requestIdMiddleware(ctx *server.Context) *server.MiddlewareResult {
    requestId := ctx.Request.Header.Get("X-Request-ID")
    if requestId == "" {
        requestId = uuid.New().String()
    }
    ctx.Data["requestId"] = requestId
    return server.NewMiddlewareResult(ctx)
}
```

### Cookie Parsing

```typescript
// TypeScript
export const cookieMiddleware = createMiddleware('cookies', async (req, ctx) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return { ...ctx, sessionId: cookies.sessionId };
});
```

```go
// Go
func cookieMiddleware(ctx *server.Context) *server.MiddlewareResult {
    cookie, err := ctx.Request.Cookie("sessionId")
    if err == nil {
        ctx.Data["sessionId"] = cookie.Value
    }
    return server.NewMiddlewareResult(ctx)
}
```

### Logging

```typescript
// TypeScript
export const loggingMiddleware = createMiddleware('logging', async (req, ctx) => {
  const start = Date.now();
  console.log(`[${ctx.requestId}] --> ${req.method} ${req.url}`);

  // Note: For response logging, use Express middleware wrapping
  return ctx;
});
```

```go
// Go
func loggingMiddleware(ctx *server.Context) *server.MiddlewareResult {
    requestId := ctx.Data["requestId"]
    log.Printf("[%s] --> %s %s", requestId, ctx.Request.Method, ctx.Request.URL.Path)
    return server.NewMiddlewareResult(ctx)
}
```

## Middleware Order

Middleware executes in the order it's registered. Consider this order for common patterns:

1. **Request ID** - Generate/extract request ID first for logging
2. **Logging** - Log incoming requests
3. **Authentication** - Validate tokens and extract user info
4. **Authorization** - Check permissions (can be per-handler instead)

```go
router := server.NewRouter()
router.Use(requestIdMiddleware)  // 1st
router.Use(loggingMiddleware)    // 2nd
router.Use(authMiddleware)       // 3rd
```

## Next Steps

- [TypeScript Server](/docs/usage/typescript-server.html) - Full TypeScript server setup
- [Go Server](/docs/usage/go-server.html) - Full Go server setup
- [API Contract](/docs/usage/api-contract.html) - Define your schema
