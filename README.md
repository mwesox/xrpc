# xRpc

> Type-safe, cross-platform RPC framework with fantastic developer experience

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

xRpc is a modern RPC framework that enables type-safe communication across any platform and language. Built on TypeScript and Zod schemas, it combines the simplicity of tRPC with the cross-platform capabilities of gRPC, providing a developer-friendly alternative to OpenAPI.

## ✨ Features

- **🌍 Cross-Platform**: Generate type-safe clients and servers for TypeScript, Python, Go, Rust, Java, Swift, Kotlin, and more
- **📝 Schema-First**: Define your API once with Zod schemas, generate everything else
- **🔒 Type-Safe**: End-to-end type safety from schema to runtime, across all languages
- **🚀 Developer Experience**: Zero configuration, instant autocomplete, clear error messages
- **🔄 Protocol Flexible**: HTTP/JSON-RPC by default, extensible to WebSocket and custom transports
- **🎯 Idiomatic**: Generated code feels native to each target language

## 🎯 Use Cases

- **Monorepo Type Sharing**: Share types between frontend and backend seamlessly
- **Microservices**: Type-safe communication between services in different languages
- **Full-Stack Apps**: Build type-safe applications with shared API contracts
- **Public API SDKs**: Generate idiomatic SDKs for multiple languages
- **Cross-Platform Mobile**: Share API contracts between web, iOS, and Android

## 🚀 Quick Start

```bash
# Install xRpc CLI
npm install -g @xrpc/cli

# Initialize a new project
xrpc init

# Define your API schema
# src/api.ts
import { z } from 'zod';
import { createRouter, procedure } from '@xrpc/core';

export const router = createRouter({
  getUser: procedure
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(async ({ input }) => {
      return { id: input.id, name: 'John Doe' };
    }),
});

# Generate clients for all targets
xrpc generate --targets typescript,python,go,rust
```

## 📚 Documentation

- [Vision & Mission](./VISION.md) - Project vision, principles, and goals
- [Getting Started](./docs/getting-started.md) - Installation and setup guide
- [Schema Guide](./docs/schema-guide.md) - Defining APIs with Zod
- [Code Generation](./docs/code-generation.md) - Generating clients and servers
- [Runtime Guide](./docs/runtime-guide.md) - Using generated code
- [Examples](./examples/) - Example projects and use cases

## 🏗️ Architecture

xRpc follows a schema-first architecture:

1. **Define** your API with Zod schemas
2. **Generate** type-safe clients and servers for any language
3. **Use** generated code with full IntelliSense and type safety

See [VISION.md](./VISION.md) for detailed architecture and design principles.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/CONTRIBUTING.md) for details.

Before contributing, please review our [Code of Conduct](./CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## 🔒 Security

For security vulnerabilities, please see our [Security Policy](./SECURITY.md) for responsible disclosure guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

xRpc is inspired by:
- [tRPC](https://trpc.io/) - For developer experience excellence
- [oRPC](https://orpc.dev/) - For type-safe RPC patterns
- [gRPC](https://grpc.io/) - For cross-platform RPC concepts
- [Zod](https://zod.dev/) - For schema validation and type inference

---

**"Type safety shouldn't stop at language boundaries."**

Made with ❤️ by the xRpc community
