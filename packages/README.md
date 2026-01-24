# xRPC Packages

## Package Structure

The xRPC monorepo is organized with individual packages for each component:

### Core Packages

- **`@xrpckit/core`** - DSL library for defining API contracts
- **`@xrpckit/parser`** - Extracts API contracts from TypeScript/Zod files
- **`@xrpckit/generator-core`** - Shared generator utilities (CodeWriter, BaseCodeGenerator)
- **`@xrpckit/generator`** - Main generator orchestrator that loads target generators
- **`@xrpckit/cli`** - Command-line interface

### Target Generator Packages

Each target language/framework has its own package:

- **`@xrpckit/target-go`** - Go server code generator
- **`@xrpckit/target-react`** - React client code generator
- **`@xrpckit/target-typescript-express`** - (Future) TypeScript/Express generator
- **`@xrpckit/target-kotlin-spring-boot`** - (Future) Kotlin/Spring Boot generator
- **`@xrpckit/target-python-fastapi`** - (Future) Python/FastAPI generator

## Benefits of Individual Target Packages

1. **Isolation** - Each target can have its own dependencies
2. **Maintainability** - Easier to work on one target without affecting others
3. **Extensibility** - New targets can be added without modifying core code
4. **Tree-shaking** - Only import the generators you need
5. **Versioning** - Each target can be versioned independently

## Adding a New Target

1. Create a new package: `packages/target-<target-name>/`
2. Implement the generator extending `BaseCodeGenerator` from `@xrpckit/generator-core`
3. Register it in `@xrpckit/generator/src/index.ts`
4. Add it to the CLI validation

Example structure:
```
packages/target-<target>/
├── package.json
└── src/
    ├── index.ts          # Export generator
    ├── generator.ts       # Main generator class
    ├── type-generator.ts  # Type definitions generator
    └── server-generator.ts # Server code generator
```
