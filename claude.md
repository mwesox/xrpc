# xRPC Project Overview

## What is xRPC?

Type-safe, cross-platform RPC framework that generates clients and servers from Zod schemas. Combines tRPC's developer experience with gRPC's cross-platform capabilities.

**Core Concept**: Define API contracts once with Zod schemas → Generate type-safe code for any language (TypeScript, Go, Python, etc.)

## Architecture

**Schema-First Flow**:
1. Define API with Zod schemas using `createRouter`, `createEndpoint`, `query`, `mutation`
2. Parser extracts contract from TypeScript files
3. Generators produce idiomatic code for target languages
4. Generated code is self-contained (no runtime dependencies)

**Key Packages**:
- `xrpckit` - DSL for defining API contracts (router, endpoint, query, mutation)
- `@xrpckit/sdk` - SDK for building target generators (parser + codegen utilities)
- `@xrpckit/target-go-server` - Go server code generator
- `@xrpckit/target-ts-client` - TypeScript client code generator
- `@xrpckit/cli` - Command-line interface

## Commands

```bash
# Install CLI globally
npm install -g @xrpckit/cli

# Generate code for targets
xrpc generate -i src/contract.ts -t go-server,ts-client -o generated

# Or during development (from monorepo root)
bun run xrpc generate -i <file> -t <targets> -o <output>

# Run tests
bun test
bun test packages/sdk/src

# Build packages
bun run build
```

## API Contract Definition

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from 'xrpckit';

const greeting = createEndpoint({
  greet: query({
    input: z.object({ name: z.string().min(1).max(100) }),
    output: z.object({ message: z.string() }),
  }),
});

export const router = createRouter({
  greeting,
});
```

**Structure**: `Router → Endpoint Groups → Endpoints (queries/mutations)`

## Generated Code (Go Example)

**Output files**:
- `types.go` - Struct definitions from Zod schemas
- `router.go` - HTTP handler with routing logic
- `validation.go` - Validation functions with idiomatic Go error handling

**Validation**:
- Extracts validation rules from Zod (min, max, email, url, uuid, etc.)
- Generates Go validation functions using standard library (`net/mail`, `net/url`, `regexp`)
- Returns `ValidationErrors` (implements Go's `error` interface)
- Integrated into router before handler execution

## Implementation Details

**Parser** (`packages/sdk/src/parser/zod-extractor.ts`):
- Extracts type information and validation rules from Zod schemas
- Uses `toJSONSchema()` for reliable validation extraction
- Handles optional/nullable chaining
- Note: When `.int()` is used with `.min()`/`.max()`, Zod v4 resets bounds in JSON schema

**Go Generator** (`packages/target-go-server/src/`):
- `GoBuilder` - Fluent DSL for Go code generation
- `GoTypeGenerator` - Generates struct types
- `GoServerGenerator` - Generates HTTP router/handlers
- `GoValidationGenerator` - Generates validation functions with error types

**Validation Pattern**:
- `ValidationError` struct with `Field` and `Message`
- `ValidationErrors` slice type implementing `error` interface
- JSON error responses: `{"error": "...", "errors": [...]}`
- HTTP 400 Bad Request for validation failures

## Testing

- Tests use Bun's built-in test runner
- Test file: `packages/sdk/src/parser/zod-extractor.test.ts`
- 28 tests covering validation extraction for strings, numbers, arrays, optional/nullable

## Key Principles

1. **Self-contained generated code** - No external dependencies, uses standard libraries
2. **Idiomatic code** - Generated code follows target language conventions
3. **Type safety** - End-to-end type safety from schema to runtime
4. **Validation** - Runtime validation generated from Zod schemas

## File Structure

```
packages/
  schema/            - Contract DSL library (users define contracts)
  sdk/               - SDK for target authors (parser + codegen utilities)
  target-go-server/  - Go server generator
  target-ts-client/ - TypeScript client generator
  cli/               - CLI interface (users generate code)
examples/
  x-rpc-todo-app/    - Full-stack TODO app (Go + React)
```

## Target Naming Convention

Targets follow the pattern `{language}-{client|server}`:
- `go-server` - Go server code generator
- `ts-client` - TypeScript client code generator
- Future: `go-client`, `python-server`, `swift-client`, etc.

## Important Notes

- CLI is Node-compatible (`npm install -g @xrpckit/cli`) - works with npm, pnpm, yarn, or bun
- Zod v4 is used for schema definition
- Generated Go code uses only standard library
- Validation extraction has limitation: `.int()` with custom min/max may not extract bounds correctly (Zod v4 behavior)
- Documentation site at `../xrpc-ghpages` (gh-pages branch) - keep in sync with API changes
