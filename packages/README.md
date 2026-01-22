# xRpc Packages

## Package Structure

The xRpc monorepo is organized with individual packages for each component:

### Core Packages

- **`@xrpc/core`** - DSL library for defining API contracts
- **`@xrpc/parser`** - Extracts API contracts from TypeScript/Zod files
- **`@xrpc/generator-core`** - Shared generator utilities (CodeWriter, BaseCodeGenerator)
- **`@xrpc/generator`** - Main generator orchestrator that loads target generators
- **`@xrpc/cli`** - Command-line interface

### Target Generator Packages

Each target language/framework has its own package:

- **`@xrpc/target-go`** - Go server code generator
- **`@xrpc/target-react`** - React client code generator
- **`@xrpc/target-typescript-express`** - (Future) TypeScript/Express generator
- **`@xrpc/target-kotlin-spring-boot`** - (Future) Kotlin/Spring Boot generator
- **`@xrpc/target-python-fastapi`** - (Future) Python/FastAPI generator

## Benefits of Individual Target Packages

1. **Isolation** - Each target can have its own dependencies
2. **Maintainability** - Easier to work on one target without affecting others
3. **Extensibility** - New targets can be added without modifying core code
4. **Tree-shaking** - Only import the generators you need
5. **Versioning** - Each target can be versioned independently

## Adding a New Target

1. Create a new package: `packages/target-<target-name>/`
2. Implement the generator extending `BaseCodeGenerator` from `@xrpc/generator-core`
3. Register it in `@xrpc/generator/src/index.ts`
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
