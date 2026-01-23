---
layout: default
title: Go Server
description: How to implement an xRPC server in Go
---

# Go Server

This guide shows how to implement an xRPC server in Go.

## Prerequisites

1. Define your API contract (see `api-contract.md`)
2. Generate Go code: `xrpc generate --targets go`
3. Implement your handlers using the generated code

**Note**: The xRPC CLI and code generation run on **Bun runtime**, but the generated Go code runs on the **Go runtime**. The generated code is self-contained and uses Go's standard `net/http` package. It implements the `http.Handler` interface, making it compatible with any Go HTTP framework (Gin, Echo, standard library, etc.).

## Generated Code Structure

Code generation produces files in `generated/go/server/`:
- `types.go`: Input/output structs matching your Zod schemas
- `router.go`: `http.Handler` implementation with `NewRouter()` function

The generated code is **self-contained** - it includes all HTTP handling, validation, and routing. No separate runtime libraries are needed. It uses only standard Go libraries (`net/http`) that are part of the Go standard library.

## Basic Server Setup

The generated code provides an `http.Handler` that can be used with Go's standard library or any HTTP framework:

```go
package main

import (
    "net/http"
    "github.com/yourorg/xrpc-go/server"  // Generated code (from generated/go/server)
)

// Implement the greet query handler
func greetHandler(ctx context.Context, input server.GreetInput) (*server.GreetOutput, error) {
    return &server.GreetOutput{
        Message: "Hello, " + input.Name + "!",
    }, nil
}

// Implement the setGreeting mutation handler
func setGreetingHandler(ctx context.Context, input server.SetGreetingInput) (*server.SetGreetingOutput, error) {
    return &server.SetGreetingOutput{
        Message: input.Greeting + ", " + input.Name + "!",
    }, nil
}

func main() {
    // Create router
    router := server.NewRouter()
    
    // Register handlers
    router.Query("greet", greetHandler)
    router.Mutation("setGreeting", setGreetingHandler)

    // Use with standard library
    http.Handle("/api", router)
    http.ListenAndServe(":8080", nil)
}
```

## Integration with Gin

The generated code implements Go's standard `http.Handler` interface, so you can easily integrate it into any Go HTTP framework:

```go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/yourorg/xrpc-go/server"  // Generated code (from generated/go/server)
)

// Implement the greet query handler
func greetHandler(ctx *server.Context, input server.GreetInput) (*server.GreetOutput, error) {
    return &server.GreetOutput{
        Message: "Hello, " + input.Name + "!",
    }, nil
}

// Implement the setGreeting mutation handler
func setGreetingHandler(ctx *server.Context, input server.SetGreetingInput) (*server.SetGreetingOutput, error) {
    return &server.SetGreetingOutput{
        Message: input.Greeting + ", " + input.Name + "!",
    }, nil
}

func main() {
    r := gin.Default()
    
    // Create xRPC router and register handlers
    xrpcRouter := server.NewRouter()
    xrpcRouter.Query("greet", greetHandler)
    xrpcRouter.Mutation("setGreeting", setGreetingHandler)
    
    // Mount xRPC handler in your Gin server
    r.POST("/api", gin.WrapH(xrpcRouter))
    
    // Your other Gin routes work as normal
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })
    
    r.Run(":8080")
}
```

You can also add Gin middleware to the xRPC endpoint:

```go
// Add middleware to xRPC endpoint
api := r.Group("/api")
api.Use(authMiddleware(), loggingMiddleware())
api.POST("", gin.WrapH(xrpcRouter))
```

## Generated Code Structure

The generated code in `generated/go/server/` includes:

**Types** (`types.go`): Type-safe input and output structs matching your Zod schemas:

```go
// Generated input types
type GreetInput struct {
    Name string `json:"name"`
}

type SetGreetingInput struct {
    Name     string `json:"name"`
    Greeting string `json:"greeting"`
}

// Generated output types
type GreetOutput struct {
    Message string `json:"message"`
}

type SetGreetingOutput struct {
    Message string `json:"message"`
}
```

**Router** (`router.go`): HTTP handler implementation:
- `NewRouter()`: Creates a new router instance
- `router.Query(name, handler)`: Registers a query endpoint handler
- `router.Mutation(name, handler)`: Registers a mutation endpoint handler
- Implements `http.Handler` interface for framework integration

**Validation**: Runtime validators generated from Zod schemas validate inputs before handler execution and outputs before response serialization.

## Handler Signature

All handlers follow this pattern:

```go
func handlerName(ctx *server.Context, input InputType) (*OutputType, error)
```

- `ctx`: Extended context with middleware data (replaces `context.Context`)
- `input`: Validated input matching your Zod schema
- Returns: Output struct and error

## Middleware Support

xRPC supports middleware for authentication, logging, cookie parsing, and other cross-cutting concerns. Middleware executes before handlers and can extend the context with typed data.

### Defining Middleware in Contract

You can define middleware in your API contract:

```typescript
// api.ts
import { z } from 'zod';
import { createRouter, createEndpoint, query } from '@xrpc/core';

const greeting = createEndpoint({
  greet: query({
    input: z.object({ name: z.string() }),
    output: z.object({ message: z.string() }),
  }),
});

export const router = createRouter({
  middleware: [
    async (req, ctx) => {
      // Extract auth token
      const token = req.headers.get('authorization');
      return { ...ctx, userId: extractUserId(token) };
    },
  ],
  greeting,
});
```

### Using Middleware in Go

The generated code includes middleware support. Register middleware using `router.Use()`:

```go
package main

import (
    "net/http"
    "github.com/yourorg/xrpc-go/server"  // Generated code
)

// Authentication middleware
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")
    if token == "" {
        return server.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }
    
    userId := validateToken(token)
    if userId == "" {
        return server.NewMiddlewareError(fmt.Errorf("invalid token"))
    }
    
    // Extend context with user ID
    ctx.Data["userId"] = userId
    return server.NewMiddlewareResult(ctx)
}

// Cookie parsing middleware
func cookieMiddleware(ctx *server.Context) *server.MiddlewareResult {
    cookies := parseCookies(ctx.Request.Header.Get("Cookie"))
    if sessionId, ok := cookies["sessionId"]; ok {
        ctx.Data["sessionId"] = sessionId
    }
    return server.NewMiddlewareResult(ctx)
}

// Handler using context data
func greetHandler(ctx *server.Context, input server.GreetInput) (*server.GreetOutput, error) {
    // Access middleware data using helper functions
    userId, _ := server.GetUserId(ctx)
    
    return &server.GreetOutput{
        Message: fmt.Sprintf("Hello %s! (User: %s)", input.Name, userId),
    }, nil
}

func main() {
    router := server.NewRouter()
    
    // Register middleware (executes in order)
    router.Use(authMiddleware)
    router.Use(cookieMiddleware)
    
    // Register handlers
    router.Query("greeting.greet", greetHandler)
    
    http.Handle("/api", router)
    http.ListenAndServe(":8080", nil)
}
```

### Context Helper Functions

The generated code includes helper functions for type-safe context access:

```go
// Get user ID set by middleware
userId, ok := server.GetUserId(ctx)
if !ok {
    // User ID not set
}

// Get session ID set by middleware
sessionId, ok := server.GetSessionId(ctx)
if !ok {
    // Session ID not set
}

// Access any custom data
if customData, ok := ctx.Data["customKey"].(string); ok {
    // Use custom data
}
```

### Middleware Short-Circuiting

Middleware can short-circuit the request by returning an error or response:

```go
func authMiddleware(ctx *server.Context) *server.MiddlewareResult {
    token := ctx.Request.Header.Get("Authorization")
    if token == "" {
        // Return error - request stops here
        return server.NewMiddlewareError(fmt.Errorf("unauthorized"))
    }
    
    // Or return a custom HTTP response
    // resp := &http.Response{...}
    // return server.NewMiddlewareResponse(resp)
    
    ctx.Data["userId"] = extractUserId(token)
    return server.NewMiddlewareResult(ctx)
}
```

### Generated Context Type

The generated `Context` type includes:

```go
type Context struct {
    Request        *http.Request
    ResponseWriter http.ResponseWriter
    Data           map[string]interface{}  // Extensible data map
}
```

This replaces `context.Context` in handler signatures, providing access to both the HTTP request/response and middleware-extended data.
