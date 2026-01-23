# xRPC

**Define once. Generate everywhere. Type-safe across every boundary.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

xRPC is a next-generation RPC framework that bridges the gap between type safety and cross-platform development. Write your API contracts in TypeScript with Zod schemas, and generate idiomatic, dependency-free code for any language.

No more hand-writing SDKs. No more API drift. No more runtime surprises.

## Why xRPC?

Traditional API development forces a choice: type safety within a single language (tRPC) or cross-platform reach with verbose tooling (OpenAPI, gRPC). xRPC eliminates this tradeoff.

| Capability | tRPC | gRPC | OpenAPI | xRPC |
|------------|------|------|---------|------|
| Type Safety | Full | Partial | None | Full |
| Schema Language | TypeScript | Protobuf | YAML/JSON | TypeScript + Zod |
| Cross-Platform | No | Yes | Yes | Yes |
| Generated Code Quality | N/A | Verbose | Varies | Idiomatic |
| Runtime Dependencies | Heavy | Heavy | Varies | Zero |
| Learning Curve | Low | High | Medium | Low |

## Get Started

```bash
npm install -g @xrpc/cli
```

Define your API with Zod:

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpc/core';

const users = createEndpoint({
  get: query({
    input: z.object({ id: z.string().uuid() }),
    output: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    }),
  }),
  create: mutation({
    input: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }),
    output: z.object({ id: z.string().uuid() }),
  }),
});

export const router = createRouter({ users });
```

Generate code for your targets:

```bash
xrpc generate --input src/api.ts --targets go,typescript,python
```

That's it. You now have type-safe clients and servers with full validation logic, zero runtime dependencies, and idiomatic code that feels native to each language.

## Generated Code

xRPC generates production-ready code that follows each language's conventions:

**Go** — Structs, HTTP handlers, and validation using only the standard library
**TypeScript** — Full type inference with Zod schemas
**Python** — Pydantic models with FastAPI integration *(coming soon)*
**Rust** — Serde structs with Axum handlers *(coming soon)*

All generated code includes:
- Request/response types derived from your Zod schemas
- Validation logic with detailed error messages
- HTTP routing with proper status codes
- JSON serialization/deserialization

## Design Principles

**Zero Dependencies** — Generated code uses only standard libraries. No vendor lock-in.

**Idiomatic Output** — Code looks like it was written by a native developer, not a machine.

**Schema as Source of Truth** — Your Zod schemas define validation, types, and documentation in one place.

**Compile-Time Safety** — Catch errors before runtime, across language boundaries.

## Use Cases

- **Polyglot Microservices** — Type-safe contracts between services in different languages
- **SDK Generation** — Ship idiomatic client libraries for your public API
- **Full-Stack Apps** — Share types seamlessly between frontend and backend
- **Mobile + Web** — Unified API contracts across iOS, Android, and web clients

## Documentation

- [API Contract Definition](./docs/guides/api-contract.md)
- [Go Server](./docs/guides/go-server.md)
- [TypeScript Server](./docs/guides/typescript-server.md)
- [Examples](./examples/)

## Contributing

Contributions welcome. See [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities via our [Security Policy](./SECURITY.md).

## License

MIT

---

*Type safety shouldn't stop at language boundaries.*
