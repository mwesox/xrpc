# Contributing to xRPC

## Quick Start

```bash
git clone https://github.com/your-username/x-rpc.git
cd x-rpc
bun install
bun test
```

## Development

```bash
# Run tests
bun test
bun test packages/parser/src

# Build
bun run build

# Generate code
bun run xrpc generate --targets go-server --input examples/x-rpc-todo-app/packages/api/src/contract.ts
```

## Pull Requests

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(generator): add Python support
   fix(parser): handle nullable types
   ```
5. Push and open a PR

## Code Standards

- TypeScript strict mode
- No `any` types
- Tests for new features
- Generated code must be idiomatic for target language

## Adding a New Target

1. Create `packages/target-{language}-{server|client}/`
2. Extend `BaseCodeGenerator` from `@xrpckit/codegen`
3. Implement type mapping and code generation
4. Register in `@xrpckit/codegen/src/registry.ts`
5. Add tests

## Need Help?

- Open a [GitHub Issue](https://github.com/mwesox/x-rpc/issues)
- Check [GitHub Discussions](https://github.com/mwesox/x-rpc/discussions)
