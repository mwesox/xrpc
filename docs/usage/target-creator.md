---
layout: default
title: Target Creator
description: Creating custom code generation targets for xRPC
---

# Target Creator

A **target** is a code generator that transforms xRPC contracts into language-specific code. Targets generate servers, clients, types, and validation logic for any language or framework.

## SDK Package

The `@xrpckit/sdk` package provides utilities for both parsing contracts and generating code:

```bash
npm install @xrpckit/sdk
```

## Key Components

### parseContract()

Parses TypeScript contract files into a `ContractDefinition` structure:

```typescript
import { parseContract } from '@xrpckit/sdk';

const contract = await parseContract('./contract.ts');
// contract contains routers, endpoints, types, middleware definitions
```

### BaseCodeGenerator

Abstract class to extend for custom targets:

```typescript
import { BaseCodeGenerator, ContractDefinition, GeneratedFiles } from '@xrpckit/sdk';

class MyTarget extends BaseCodeGenerator {
  generate(contract: ContractDefinition): GeneratedFiles {
    // Transform contract into generated code
    return {
      'output.ts': this.generateCode(contract),
    };
  }
}
```

### CodeWriter

Fluent DSL for building code strings with proper indentation:

```typescript
import { CodeWriter } from '@xrpckit/sdk';

const writer = new CodeWriter();
writer
  .writeLine('function hello() {')
  .indent()
  .writeLine('return "world";')
  .dedent()
  .writeLine('}');
```

## Basic Pattern

1. **Extend** `BaseCodeGenerator`
2. **Implement** `generate(contract: ContractDefinition): GeneratedFiles`
3. **Use** `CodeWriter` or language-specific builders to construct output
4. **Return** a map of file paths to generated code strings

## Existing Targets

Refer to these existing targets for current implementation patterns:

- `@xrpckit/target-go-server` - Go server generation
- `@xrpckit/target-ts-client` - Vanilla TypeScript client

CLI target names currently exposed: `go-server`, `ts-client`.

Planned targets (not yet in the CLI):

- `@xrpckit/target-ts-express` - TypeScript Express server
- `@xrpckit/target-go-client` - Go client
- `@xrpckit/target-kotlin-springboot-server` - Kotlin Spring Boot server

## Note

The target API is still evolving. Check the existing target implementations for the most current patterns and best practices.

## Next Steps

- [API Contract](/docs/usage/api-contract.html) - Define your schema
- [Configuration](/docs/usage/configuration.html) - Configure code generation
