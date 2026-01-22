# Greeting Example

This example demonstrates a simple xRpc API with a Go server.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Generate Go code:
```bash
bun run --filter='@xrpc/cli' generate --input src/api.ts --output generated --targets go
```

3. Initialize Go module (if needed):
```bash
cd server
go mod init github.com/example/greeting
go mod tidy
```

4. Run the server:
```bash
cd server
go run main.go
```

5. Test the API:
```bash
curl -X POST http://localhost:8080/api \
  -H "Content-Type: application/json" \
  -d '{"method": "greeting.greet", "params": {"name": "World"}}'
```

Expected response:
```json
{"message": "Hello, World!"}
```
