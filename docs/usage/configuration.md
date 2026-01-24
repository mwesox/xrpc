---
layout: default
title: Configuration
description: Configure xRPC using xrpc.toml files for project-level settings
---

# Configuration

xRPC can be configured using a TOML configuration file, allowing you to define project-level settings that persist across code generation runs.

## Configuration Methods

xRPC supports three configuration methods with the following priority:

1. **CLI arguments** (highest priority) - Override all other settings
2. **xrpc.toml** - Project-level configuration file
3. **Interactive prompts** (lowest priority) - Used when settings are missing

## Configuration File

Create an `xrpc.toml` file in your project's root directory (current working directory):

```toml
# xRPC Configuration
input = "path/to/contract.ts"

[targets.go-server]
output = "apps/go-backend"

[targets.react-client]
output = "apps/web"
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `input` | string | Path to the API contract file |
| `targets.<name>.output` | string | Output directory for a generation target |

### Target Names

Available generation targets:

| Target | Description |
|--------|-------------|
| `go-server` | Go HTTP server |
| `go-client` | Go HTTP client |
| `typescript-server` | TypeScript Express server |
| `typescript-client` | TypeScript fetch client |
| `react-client` | React client with hooks |
| `kotlin-springboot-server` | Kotlin Spring Boot server |

## Full Example

```toml
# xRPC Configuration
input = "packages/api/contract.ts"

# Go backend server
[targets.go-server]
output = "apps/backend/generated"

# Go client for service-to-service communication
[targets.go-client]
output = "services/gateway/client"

# TypeScript server
[targets.typescript-server]
output = "apps/api/generated"

# React frontend client
[targets.react-client]
output = "apps/web/src/api"
```

## CLI Overrides

CLI arguments always take precedence over `xrpc.toml` settings:

```bash
# Uses xrpc.toml settings
xrpc generate

# Overrides input from xrpc.toml
xrpc generate --input ./other-contract.ts

# Overrides specific target output
xrpc generate --targets go-server --output ./custom-output
```

## Usage

With a configured `xrpc.toml`, simply run:

```bash
xrpc generate
```

The CLI will read settings from `xrpc.toml` and generate code for all configured targets.
