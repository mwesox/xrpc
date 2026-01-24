# x-rpc TODO App

A hands-on tutorial demonstrating x-rpc's "define once, use everywhere" approach. Build a fullstack TODO app with a Go backend and React frontend that share a single TypeScript API contract.

## What You'll Learn

- How to define an API contract with Zod schemas
- How x-rpc generates type-safe code for Go and React
- How backend and frontend share the same types automatically

---

## The Core Concept: Contract-First Development

**Traditional approach:**
```
Write backend API → Write frontend types → Keep them in sync manually (error-prone)
```

**x-rpc approach:**
```
Define contract once → Generate code for all platforms (always in sync)
```

Here's how it works:

```
     ┌─────────────────────────────────────────────┐
     │       packages/api/src/contract.ts          │
     │          (Single Source of Truth)           │
     └─────────────────────┬───────────────────────┘
                           │
                     xrpc generate
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────────┐         ┌──────────────┐
       │   Go Server  │         │ React Client │
       │  types.go    │         │  types.ts    │
       │  router.go   │         │  client.ts   │
       │  validation  │         │  hooks       │
       └──────────────┘         └──────────────┘
```

The API package is the heart of your application. Everything else is derived from it.

---

## The API Package: Step by Step

Let's walk through `packages/api/src/contract.ts` line by line. This is the most important file in the project.

### Step 1: Imports

```typescript
import { z } from 'zod';
import { createRouter, createEndpoint, query, mutation } from '@xrpckit/schema';
```

Two imports:
- **`z` from Zod** - The schema library that defines your data types with runtime validation
- **x-rpc building blocks** - Four functions that structure your API:
  - `createRouter` - Combines all endpoints into the full API
  - `createEndpoint` - Groups related operations together
  - `query` - Defines read operations (like GET requests)
  - `mutation` - Defines write operations (like POST/PUT/DELETE)

### Step 2: Define Your Data Types

```typescript
const Todo = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
});
```

This defines what a Todo looks like. The power of x-rpc: this single definition becomes:

- A **Go struct**: `type Todo struct { ID string; Title string; ... }`
- A **TypeScript type**: `type Todo = { id: string; title: string; ... }`
- **Validation logic** in both languages

Change it here, and the generated code updates everywhere.

### Step 3: Create an Endpoint Group

```typescript
const todo = createEndpoint({
  // operations go here
});
```

An endpoint group bundles related operations. Think of it like a controller or service that handles all Todo-related API calls.

### Step 4: Define Operations (Queries vs Mutations)

Inside `createEndpoint`, you define your operations:

```typescript
const todo = createEndpoint({
  // QUERIES: Read data (safe, repeatable, like GET requests)
  list: query({
    input: z.object({}),           // No input needed
    output: z.array(Todo),         // Returns array of Todos
  }),

  // MUTATIONS: Modify data (like POST/PUT/DELETE requests)
  create: mutation({
    input: z.object({ title: z.string() }),   // Requires title
    output: Todo,                              // Returns the new Todo
  }),

  toggle: mutation({
    input: z.object({ id: z.string() }),      // Requires Todo ID
    output: Todo,                              // Returns updated Todo
  }),

  delete: mutation({
    input: z.object({ id: z.string() }),      // Requires Todo ID
    output: z.object({ success: z.boolean() }), // Returns success status
  }),
});
```

**Query vs Mutation:**
| | Query | Mutation |
|---|-------|----------|
| Purpose | Read data | Modify data |
| Safe to retry | Yes | No |
| HTTP equivalent | GET | POST/PUT/DELETE |

### Step 5: Build the Router

```typescript
export const router = createRouter({ todo });
```

The router combines all endpoint groups into your complete API. When you run `xrpc generate`, this is what gets parsed.

You can add more endpoint groups as your app grows:

```typescript
export const router = createRouter({
  todo,
  user,      // future endpoint group
  project,   // another future endpoint group
});
```

---

## What Gets Generated

When you run `xrpc generate`, x-rpc creates production-ready code:

### Go Server (`packages/api/generated/go-server/`)

**types.go** - Struct definitions:
```go
type Todo struct {
    ID        string `json:"id"`
    Title     string `json:"title"`
    Completed bool   `json:"completed"`
    CreatedAt string `json:"createdAt"`
}
```

**router.go** - HTTP handler with routing logic

**validation.go** - Input validation functions

### React Client (`packages/api/generated/react-client/`)

**types.ts** - TypeScript types inferred from Zod schemas

**client.ts** - Type-safe hooks for each operation:
```typescript
// In your React component:
const { data: todos } = useTodoList();
const { mutate: createTodo } = useTodoCreate();
const { mutate: toggleTodo } = useTodoToggle();
const { mutate: deleteTodo } = useTodoDelete();
```

---

## Project Structure

```
x-rpc-todo-app/
├── packages/
│   └── api/                      # THE HEART OF YOUR APP
│       ├── src/
│       │   └── contract.ts       # Your API definition (34 lines!)
│       └── generated/            # Generated code (don't edit)
│           ├── go-server/        # Go types, router, validation
│           └── react-client/     # TS types, hooks, client
├── apps/
│   ├── go-backend/               # Go server implementation
│   │   ├── main.go               # Uses generated types
│   │   └── db.go                 # SQLite database layer
│   └── web/                      # Next.js frontend
│       └── app/page.tsx          # Uses generated hooks
```

---

## Running the Example

### Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Go](https://golang.org/) 1.21+

### 1. Install Dependencies

```bash
# From xrpc repository root
bun install
```

### 2. Generate Code from Contract

```bash
cd examples/x-rpc-todo-app
bun run generate
```

This runs the xrpc generator on the contract and outputs Go server and React client code to `packages/api/generated/`.

### 3. Start the Go Backend

```bash
cd apps/go-backend
go run .
# Server running on :8080
```

### 4. Start the React Frontend

In a new terminal (from `examples/x-rpc-todo-app`):

```bash
bun run dev --filter=web
# Frontend running on :3000
```

### 5. Open the App

Visit http://localhost:3000 to use the TODO app.

---

## Next Steps

Try these exercises to deepen your understanding:

1. **Add a field**: Add `priority: z.number()` to the Todo schema, regenerate, and update the UI

2. **Add an operation**: Create an `update` mutation that changes a Todo's title

3. **Add validation**: Use `z.string().min(1).max(100)` for the title and see validation generated in Go

---

## Learn More

- [x-rpc Documentation](https://mwesox.github.io/xrpc/)
- [Go Backend Implementation](./apps/go-backend/)
- [React Frontend Implementation](./apps/web/)
