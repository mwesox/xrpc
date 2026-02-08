---
layout: ../../../layouts/SiteLayout.astro
title: TypeScript Plugin
description: Optional tsserver plugin for better xRPC navigation
showSidebar: true
---

# TypeScript Plugin (`@xrpckit/ts-plugin`)

This plugin improves editor navigation by resolving generated xRPC call-sites back to contract endpoints.

## What it does

Go-to-definition from generated usage such as:

- `api.group.method(...)` from `ts-client`
- handler keys like `"group.method"` from `ts-server`

It jumps to the corresponding endpoint field in your `router` contract.

## Install

```bash
bun add -d @xrpckit/ts-plugin
```

## Configure `tsconfig.json`

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "@xrpckit/ts-plugin" }
    ]
  }
}
```

## Scope

- Editor/language-service enhancement only.
- No effect on runtime or generated code behavior.
- Works with TypeScript server (tsserver) plugin loading.
