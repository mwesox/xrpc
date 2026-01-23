# xRPC Examples

This directory contains example implementations for different target languages and frameworks.

## Available Examples

- **`go-greeting-server/`** - Simple greeting API with Go server implementation
- **`greeting/`** - Minimal example with API contract only (no implementation)

## Naming Convention

Examples follow the pattern: `<target>-<name>-<type>/`

- **target**: Language/framework (e.g., `go`, `typescript-express`, `kotlin-spring-boot`)
- **name**: Example name (e.g., `greeting`, `todo`, `user`)
- **type**: Implementation type (`server` or `client`)

Examples:
- `go-greeting-server/` - Go server implementation
- `go-greeting-client/` - Go client implementation
- `typescript-express-todo-server/` - TypeScript/Express server
- `python-fastapi-user-client/` - Python FastAPI client

## Structure

Each example follows this structure:

```
<target>-<name>-<type>/
├── src/
│   └── api.ts          # API contract definition
├── generated/          # Generated code (created by xrpc generate)
│   └── <target>/
│       └── <type>/     # server/ or client/
├── <type>/             # Server or client implementation
│   └── main.go (or equivalent)
├── package.json        # Node/Bun dependencies
└── README.md          # Example-specific instructions
```

## Running Examples

1. Navigate to the example directory
2. Install dependencies: `bun install`
3. Generate code: `bun run --filter='@xrpc/cli' generate -i src/api.ts -o generated -t <target>`
4. Follow the example-specific README for running the server

## Adding New Examples

To add a new example:

1. Create directory: `examples/<target>-<name>-<type>/` (e.g., `go-todo-server/`)
2. Add API contract in `src/api.ts`
3. Generate code for your target: `bun run --filter='@xrpc/cli' generate -i src/api.ts -o generated -t <target>`
4. Implement server/client code in `<type>/` directory (e.g., `server/main.go`)
5. Add README with instructions

**Note**: The `greeting/` example is a minimal example with just the API contract, useful for testing code generation without a full implementation.
