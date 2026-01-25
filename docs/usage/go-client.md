---
layout: default
title: Go Client
description: How to use an xRPC client in Go
---

# Go Client

This guide shows how to use an xRPC client in Go.

> **Planned**: The `go-client` target is not available in the CLI yet. This page is a preview and the API may change.

## Prerequisites

1. Define your API contract (see [API Contract](api-contract.html)) and export `router`
2. Generate Go code: `xrpc generate --targets go-client` (planned)
3. Use the generated client in your application

**Note**: The xRPC CLI runs on **Node.js** (>= 18), but the generated Go code runs on the **Go runtime**. The generated client is expected to use Go's standard HTTP libraries (`net/http`).

## Generated Code Structure

Code generation is planned to produce client code in `<output>/xrpc/`:
- Type-safe client implementation using standard `net/http`
- Request serialization (to JSON)
- Response deserialization (from JSON)
- Error handling
- Type-safe method wrappers for each endpoint

## Basic Usage

```go
package main

import (
    "context"
    "fmt"
    "your-module/xrpc"  // Generated code (planned)
)

func main() {
    ctx := context.Background()
    c := xrpc.NewClient("http://localhost:3000/api") // planned API

    // Call a query
    result, err := c.Greet(ctx, xrpc.GreetInput{
        Name: "World",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(result.Message) // "Hello, World!"

    // Call a mutation
    greeting, err := c.SetGreeting(ctx, xrpc.SetGreetingInput{
        Name:     "Alice",
        Greeting: "Hi",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(greeting.Message) // "Hi, Alice!"
}
```

## Type Safety

All API calls are type-safe with generated types:

```go
// Input is type-checked
result, err := c.Greet(ctx, xrpc.GreetInput{
    Name: "World", // ✅ Type-checked
})

// Output is type-checked
fmt.Println(result.Message) // ✅ Type-checked
```

## Error Handling

```go
result, err := c.Greet(ctx, xrpc.GreetInput{Name: "World"})
if err != nil {
    // Handle error (network, validation, server error, etc.)
    log.Printf("Error: %v", err)
    return
}
// Use result
fmt.Println(result.Message)
```
