---
layout: default
title: Home
description: Type-safe, cross-platform RPC framework with fantastic developer experience
---

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

- **[Vision & Mission]({{ '/docs/VISION.html' | relative_url }})** - Project vision, principles, and goals
- **[Architecture]({{ '/docs/ARCHITECTURE.html' | relative_url }})** - System architecture and building blocks
- **[Detailed Architecture]({{ '/docs/DETAILED-ARCHITECTURE.html' | relative_url }})** - Technical specification and implementation details

### Usage Guides

- **[API Contract Definition]({{ '/docs/usage/api-contract.html' | relative_url }})** - Defining APIs with Zod schemas
- **[TypeScript Server]({{ '/docs/usage/typescript-server.html' | relative_url }})** - Implementing TypeScript/Express servers
- **[TypeScript Client]({{ '/docs/usage/typescript-client.html' | relative_url }})** - Using TypeScript clients
- **[Go Server]({{ '/docs/usage/go-server.html' | relative_url }})** - Implementing Go servers
- **[Go Client]({{ '/docs/usage/go-client.html' | relative_url }})** - Using Go clients
- **[Kotlin Spring Boot Server]({{ '/docs/usage/kotlin-springboot-server.html' | relative_url }})** - Implementing Kotlin/Spring Boot servers

### Contributing

- **[Contributing Guide]({{ '/docs/CONTRIBUTING.html' | relative_url }})** - How to contribute to xRpc

## 🏗️ Architecture

xRpc follows a schema-first architecture:

1. **Define** your API with Zod schemas
2. **Generate** type-safe clients and servers for any language
3. **Use** generated code with full IntelliSense and type safety

See the [Vision & Mission]({{ '/docs/VISION.html' | relative_url }}) document for detailed architecture and design principles.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide]({{ '/docs/CONTRIBUTING.html' | relative_url }}) for details.

## 🔒 Security

For security vulnerabilities, please see our [Security Policy](https://github.com/matthiaswesolowski/x-rpc/blob/main/SECURITY.md) for responsible disclosure guidelines.

## 📄 License

MIT License - see [LICENSE](https://github.com/matthiaswesolowski/x-rpc/blob/main/LICENSE) file for details.

## 🙏 Acknowledgments

xRpc is inspired by:
- [tRPC](https://trpc.io/) - For developer experience excellence
- [oRPC](https://orpc.dev/) - For type-safe RPC patterns
- [gRPC](https://grpc.io/) - For cross-platform RPC concepts
- [Zod](https://zod.dev/) - For schema validation and type inference

---

**"Type safety shouldn't stop at language boundaries."**

Made with ❤️ by the xRpc community
