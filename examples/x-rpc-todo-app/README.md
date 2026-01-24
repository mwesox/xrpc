# x-rpc TODO App

A fullstack TODO app demonstrating x-rpc's cross-language capabilities with a Go backend and React frontend sharing a TypeScript API contract.

## Architecture

```
x-rpc-todo-app/
├── apps/
│   ├── go-backend/          # Go server with SQLite
│   │   ├── main.go          # Server entry + RPC handlers
│   │   └── db.go            # SQLite database layer
│   └── web/                 # Next.js frontend
│       └── app/page.tsx     # TODO list UI
├── packages/
│   ├── api/                 # Shared x-rpc contract
│   │   ├── src/contract.ts  # API definition with Zod schemas
│   │   └── generated/       # Generated Go + React code
│   └── ui/                  # Shared UI components
```

## Features

- **Cross-language type safety**: One TypeScript contract generates both Go server and React client code
- **Go backend**: SQLite persistence with JSON-RPC API
- **React frontend**: Type-safe API calls with generated hooks
- **Turbo monorepo**: Unified development experience

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Go](https://golang.org/) 1.21+

### Install Dependencies

```bash
# From x-rpc-main root
bun install
```

### Generate Code

```bash
# Generate Go + React code from the contract
bun run xrpc generate -i examples/x-rpc-todo-app/packages/api/src/contract.ts -t go,react -o examples/x-rpc-todo-app/packages/api/generated
```

### Run Development Servers

Start the Go backend:

```bash
cd examples/x-rpc-todo-app/apps/go-backend
go run .
# Server running on :8080
```

In a separate terminal, start the Next.js frontend:

```bash
cd examples/x-rpc-todo-app
bun run dev --filter=web
# Frontend running on :3000
```

Open http://localhost:3000 to use the app.

## API Contract

The shared contract defines four TODO operations:

```typescript
// packages/api/src/contract.ts
const todo = createEndpoint({
  list: query({
    input: z.object({}),
    output: z.array(Todo),
  }),
  create: mutation({
    input: z.object({ title: z.string() }),
    output: Todo,
  }),
  toggle: mutation({
    input: z.object({ id: z.string() }),
    output: Todo,
  }),
  delete: mutation({
    input: z.object({ id: z.string() }),
    output: z.object({ success: z.boolean() }),
  }),
});
```

## Generated Code

### Go Server (`packages/api/generated/go/server/`)

- `types.go` - Type definitions and handler signatures
- `router.go` - HTTP router with JSON-RPC handling
- `validation.go` - Input validation

### React Client (`packages/api/generated/react/client/`)

- `types.ts` - TypeScript types inferred from Zod schemas
- `client.ts` - Type-safe API functions and React hooks

## Learn More

- [x-rpc Documentation](https://mwesox.github.io/xrpc/)
- [Go Backend Code](./apps/go-backend/)
- [React Frontend Code](./apps/web/)
