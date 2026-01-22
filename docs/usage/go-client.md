# Go Client

This guide shows how to use an xRpc client in Go.

## Prerequisites

1. Define your API contract (see `api-contract.md`)
2. Generate Go code: `xrpc generate --targets go`
3. Use the generated client in your application

**Note**: The xRpc CLI and code generation run on **Bun runtime**, but the generated Go code runs on the **Go runtime**. The generated client is self-contained and uses Go's standard HTTP libraries (`net/http`). No separate runtime libraries are needed.

## Generated Code Structure

Code generation produces client code in `generated/go/client/`:
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
    "github.com/yourorg/xrpc-go/client"  // Generated code (from generated/go/client)
)

func main() {
    ctx := context.Background()
    c := client.New("http://localhost:3000/api")

    // Call a query
    result, err := c.Greet(ctx, client.GreetInput{
        Name: "World",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(result.Message) // "Hello, World!"

    // Call a mutation
    greeting, err := c.SetGreeting(ctx, client.SetGreetingInput{
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
result, err := c.Greet(ctx, client.GreetInput{
    Name: "World", // ✅ Type-checked
})

// Output is type-checked
fmt.Println(result.Message) // ✅ Type-checked
```

## Error Handling

```go
result, err := c.Greet(ctx, client.GreetInput{Name: "World"})
if err != nil {
    // Handle error (network, validation, server error, etc.)
    log.Printf("Error: %v", err)
    return
}
// Use result
fmt.Println(result.Message)
```
