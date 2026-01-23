
# Kotlin Spring Boot Server

This guide shows how to implement an xRPC server using Kotlin and Spring Boot.

## Prerequisites

1. Define your API contract (see `api-contract.md`)
2. Generate Kotlin Spring Boot code: `xrpc generate --targets kotlin-spring-boot`
3. Implement your handlers using the generated code

**Note**: The xRPC CLI and code generation run on **Bun runtime**, but the generated Kotlin code runs on the **JVM**. The generated code is self-contained and uses Spring Boot framework APIs. No separate runtime libraries are needed.

**Framework-Specific Target**: xRPC generates code for framework-specific targets. The `kotlin-spring-boot` target generates code tailored specifically for Spring Boot, including Spring `@RestController` integration. This is not a generic Kotlin target - it's optimized for Spring Boot framework patterns.

## Basic Server Setup

First, define your API contract (see `api-contract.md` for contract definition):

```typescript
// contract.ts
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

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

export type Router = typeof router;
```

Then, generate code and implement your server with handlers:

```bash
# Generate Kotlin Spring Boot code (CLI runs on Bun runtime)
xrpc generate --targets kotlin-spring-boot
```

This generates code in `generated/kotlin-spring-boot/`:
- `types.kt`: Data classes for input/output types
- `XrpcController.kt`: Spring Boot `@RestController` implementation
- `XrpcHandlers.kt`: Interface that you implement with your business logic
- `client.kt`: Type-safe client SDK (optional, for client usage)

```kotlin
// Handlers.kt - Implement the generated interface
package com.yourorg.handlers

import com.yourorg.generated.*
import org.springframework.stereotype.Service

@Service
class GreetingHandlers : XrpcHandlers {
    override suspend fun greetingGreet(input: GreetInput): GreetOutput {
        return GreetOutput(message = "Hello, ${input.name}!")
    }

    override suspend fun greetingSetGreeting(input: SetGreetingInput): SetGreetingOutput {
        return SetGreetingOutput(message = "${input.greeting}, ${input.name}!")
    }
}
```

```kotlin
// Application.kt - Spring Boot application
package com.yourorg

import com.yourorg.generated.XrpcController
import com.yourorg.handlers.GreetingHandlers
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean

@SpringBootApplication
class Application {
    @Bean
    fun xrpcController(handlers: GreetingHandlers): XrpcController {
        return XrpcController(handlers)
    }
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
```

## Router, Endpoints, and Endpoints

xRPC uses a hierarchical structure:
- **Router**: Primary grouping mechanism that exports all endpoints
- **Endpoints**: Collections of related endpoints (like `greeting`, `user`, `product`)
- **Endpoints**: Individual RPC methods (queries and mutations) within endpoints

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

export type Router = typeof router;
```

Implement handlers for all endpoints:

```kotlin
// Handlers.kt
package com.yourorg.handlers

import com.yourorg.generated.*
import org.springframework.stereotype.Service

@Service
class AppHandlers : XrpcHandlers {
    // User endpoint handlers
    override suspend fun userGetUser(input: GetUserInput): GetUserOutput {
        return GetUserOutput(
            id = input.id,
            name = "John Doe",
            email = "john@example.com"
        )
    }

    override suspend fun userUpdateUser(input: UpdateUserInput): UpdateUserOutput {
        return UpdateUserOutput(
            id = input.id,
            name = input.name ?: "John Doe",
            email = input.email ?: "john@example.com"
        )
    }

    // Product endpoint handlers
    override suspend fun productListProducts(input: ListProductsInput): ListProductsOutput {
        return ListProductsOutput(
            products = listOf(
                Product(id = "1", name = "Product 1", price = 100.0),
                Product(id = "2", name = "Product 2", price = 200.0)
            )
        )
    }

    override suspend fun productCreateProduct(input: CreateProductInput): CreateProductOutput {
        return CreateProductOutput(
            id = "new-id",
            name = input.name,
            price = input.price
        )
    }
}
```

## Type Safety

xRPC ensures full type safety through generated types. The generated code provides an `XrpcHandlers` interface that matches your API contract exactly.

### Generated Types

After running `xrpc generate --targets kotlin-spring-boot`, the generated code includes:

```kotlin
// generated/kotlin-spring-boot/types.kt
data class GreetInput(
    val name: String
)

data class GreetOutput(
    val message: String
)

data class SetGreetingInput(
    val name: String,
    val greeting: String
)

data class SetGreetingOutput(
    val message: String
)
```

### Generated Interface

The generated `XrpcHandlers` interface enforces type-safe handler implementations:

```kotlin
// generated/kotlin-spring-boot/XrpcHandlers.kt
interface XrpcHandlers {
    suspend fun greetingGreet(input: GreetInput): GreetOutput
    suspend fun greetingSetGreeting(input: SetGreetingInput): SetGreetingOutput
}
```

### Type-Safe Handlers

By implementing `XrpcHandlers`, Kotlin ensures:

- **Structure matches contract**: All endpoints and endpoints must be implemented
- **Input types are correct**: Handler input types match Zod schemas
- **Output types are correct**: Handler return types match Zod schemas
- **Autocomplete**: Full IntelliSense support for handler methods
- **Compile-time errors**: Kotlin catches mismatches before runtime

### Example: Type Errors

Kotlin will catch errors if your handlers don't match the contract:

```kotlin
@Service
class MyHandlers : XrpcHandlers {
    override suspend fun greetingGreet(input: GreetInput): GreetOutput {
        // ❌ Error: Missing required property 'message'
        // Kotlin knows the output must match GreetOutput
        return GreetOutput()  // Compile error
    }
    // ❌ Error: 'greetingSetGreeting' must be overridden
    // Kotlin enforces all endpoints must be implemented
}
```

### Benefits

- **Compile-time safety**: Catch errors before running code
- **Refactoring support**: Rename endpoints/endpoints with confidence
- **Autocomplete**: IDE suggests available endpoints and endpoints
- **Documentation**: Types serve as inline documentation

## Handler Function

The handler function is fully type-safe. Kotlin knows the exact input and output types from your API contract:

```kotlin
@Service
class GreetingHandlers : XrpcHandlers {
    override suspend fun greetingGreet(input: GreetInput): GreetOutput {
        // Kotlin knows input.name is String ✅
        val name = input.name
        
        // Return type is checked - must match GreetOutput: { message: String }
        return GreetOutput(
            message = "Hello, $name!"  // ✅ Type-checked
        )
    }
}
```

### Handler Signature

Each handler:
- Is a `suspend` function (supports coroutines)
- Receives **typed input** matching your Zod schema (e.g., `GreetInput`)
- Returns **typed output** matching your Zod schema (e.g., `GreetOutput`)

### Coroutines Support

All handlers are `suspend` functions, allowing you to use Kotlin coroutines:

```kotlin
@Service
class GreetingHandlers : XrpcHandlers {
    override suspend fun greetingGreet(input: GreetInput): GreetOutput {
        // Use coroutines for async operations
        val result = withContext(Dispatchers.IO) {
            // Database call, API call, etc.
            fetchUserData(input.name)
        }
        
        return GreetOutput(message = "Hello, ${result.name}!")
    }
}
```

## Generated Controller

The generated `XrpcController` is a Spring Boot `@RestController` that:

- Handles HTTP POST requests to `/api` (configurable)
- Parses JSON request bodies
- Validates inputs using generated validators
- Routes to appropriate handler methods
- Validates outputs before serialization
- Returns JSON responses

```kotlin
// generated/kotlin-spring-boot/XrpcController.kt
@RestController
@RequestMapping("/api")
class XrpcController(
    private val handlers: XrpcHandlers
) {
    @PostMapping
    suspend fun handle(@RequestBody request: JsonRpcRequest): ResponseEntity<JsonRpcResponse> {
        // Request parsing, validation, routing, and response handling
        // All implemented in generated code
    }
}
```

## Spring Boot Integration

The generated controller integrates seamlessly with Spring Boot:

- **Dependency Injection**: Handlers are injected via Spring's DI container
- **Spring Annotations**: Uses standard Spring Boot annotations
- **Error Handling**: Integrates with Spring's exception handling
- **Middleware**: Can use Spring interceptors and filters
- **Configuration**: Follows Spring Boot configuration patterns

### Custom Request Mapping

You can customize the request path by configuring the controller:

```kotlin
@SpringBootApplication
class Application {
    @Bean
    fun xrpcController(handlers: GreetingHandlers): XrpcController {
        return XrpcController(handlers, basePath = "/rpc")  // Custom path
    }
}
```

### Adding Middleware

Use Spring interceptors for cross-cutting concerns:

```kotlin
@Component
class AuthInterceptor : HandlerInterceptor {
    override fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any
    ): Boolean {
        // Authentication logic
        return true
    }
}

@Configuration
class WebConfig : WebMvcConfigurer {
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(AuthInterceptor())
            .addPathPatterns("/api/**")
    }
}
```

## Generated Code Structure

The generated code in `generated/kotlin-spring-boot/` includes:

**Types** (`types.kt`): Type-safe data classes matching your Zod schemas:

```kotlin
// Generated input types
data class GreetInput(
    val name: String
)

data class SetGreetingInput(
    val name: String,
    val greeting: String
)

// Generated output types
data class GreetOutput(
    val message: String
)

data class SetGreetingOutput(
    val message: String
)
```

**Handlers Interface** (`XrpcHandlers.kt`): Interface that you implement:

```kotlin
interface XrpcHandlers {
    suspend fun greetingGreet(input: GreetInput): GreetOutput
    suspend fun greetingSetGreeting(input: SetGreetingInput): SetGreetingOutput
}
```

**Controller** (`XrpcController.kt`): Spring Boot `@RestController`:
- `XrpcController(handlers: XrpcHandlers)`: Constructor takes your handler implementation
- Handles HTTP routing, validation, and response serialization

**Validation**: Runtime validators generated from Zod schemas validate inputs before handler execution and outputs before response serialization.

## Handler Naming Convention

Handler method names follow the pattern: `{endpoint}{Endpoint}`

- Endpoint name is camelCase (e.g., `greeting` → `greeting`)
- Endpoint name is PascalCase (e.g., `greet` → `Greet`)
- Combined: `greetingGreet`, `greetingSetGreeting`

For nested endpoints or multiple words, the pattern remains consistent:
- `user` endpoint, `getUser` endpoint → `userGetUser`
- `product` endpoint, `listProducts` endpoint → `productListProducts`

## Error Handling

The generated controller handles errors and returns appropriate HTTP responses:

- **Validation Errors**: Returns 400 Bad Request with error details
- **Handler Errors**: Returns 500 Internal Server Error
- **Not Found**: Returns 404 if endpoint doesn't exist

You can customize error handling by extending the generated controller or using Spring's exception handlers.
