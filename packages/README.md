# xRPC Packages

## Package Structure

The xRPC monorepo is organized with individual packages for each component:

### Core Packages

- **`xrpckit`** - DSL library for defining API contracts
- **`@xrpckit/parser`** - Extracts API contracts from TypeScript/Zod files
- **`@xrpckit/codegen`** - Code generation utilities and target registry
- **`@xrpckit/cli`** - Command-line interface

### Target Generator Packages

Each target language/framework has its own package following the naming convention `@xrpckit/target-{language}-{client|server}`:

- **`@xrpckit/target-go-server`** - Go server code generator
- **`@xrpckit/target-ts-client`** - TypeScript client code generator
- **`@xrpckit/target-go-client`** - (Future) Go client generator
- **`@xrpckit/target-python-server`** - (Future) Python/FastAPI server generator
- **`@xrpckit/target-swift-client`** - (Future) Swift/iOS client generator

## Benefits of Individual Target Packages

1. **Isolation** - Each target can have its own dependencies
2. **Maintainability** - Easier to work on one target without affecting others
3. **Extensibility** - New targets can be added without modifying core code
4. **Tree-shaking** - Only import the generators you need
5. **Versioning** - Each target can be versioned independently

## Adding a New Target

1. Create a new package: `packages/target-{language}-{client|server}/`
2. Implement a `Target` from `@xrpckit/sdk` with `name` + `generate()`
3. Register it in `packages/cli/src/registry.ts`
4. Add any target-specific options to `xrpc.toml` templates if needed

Example structure:
```
packages/target-{language}-{server|client}/
├── package.json
└── src/
    ├── index.ts          # Export generator
    ├── generator.ts       # Main generator class
    ├── type-generator.ts  # Type definitions generator
    └── server-generator.ts # Server code generator (for server targets)
    └── client-generator.ts # Client code generator (for client targets)
```
