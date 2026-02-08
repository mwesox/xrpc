---
layout: ../../../layouts/SiteLayout.astro
title: Swift Client
description: Use the generated swift-client target
showSidebar: true
---

# Swift Client (`swift-client`)

`swift-client` generates Swift models and an async URLSession-based client.

## Generate

```bash
xrpc generate --input src/contract.ts --targets swift-client
```

Generated files in `xrpc/`:

- `Types.swift`
- `Client.swift`

## Runtime notes

- Uses `Codable` models.
- Uses async request APIs.
- Validation metadata from Zod is preserved where representable in generated types.

## Typical usage

```swift
let client = XRPCClient(baseURL: URL(string: "https://api.example.com/rpc")!)
let output = try await client.userGetUser(.init(id: "123"))
print(output.name)
```
