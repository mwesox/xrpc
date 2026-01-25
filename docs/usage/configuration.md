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
contract = "path/to/contract.ts"
go-server = "apps/go-backend"
ts-client = "apps/web"
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `contract` | string | Path to the API contract file |
| `<target-name>` | string | Output directory for a generation target |

Generated code is always written to an `xrpc/` subdirectory inside each target output path.

### Target Names

Available generation targets:

| Target | Status | Description |
|--------|--------|-------------|
| `go-server` | Available | Go HTTP server |
| `ts-client` | Available | Vanilla TypeScript client |
| `ts-express` | Planned | TypeScript Express server |
| `go-client` | Planned | Go HTTP client |
| `kotlin-springboot-server` | Planned | Kotlin Spring Boot server |

Planned targets are listed for clarity but are not yet available in the CLI.

## Full Example

```toml
# xRPC Configuration
contract = "packages/api/contract.ts"

# Go backend server
go-server = "apps/backend"

# TypeScript frontend client
ts-client = "apps/web/src"
```

## CLI Overrides

CLI arguments always take precedence over `xrpc.toml` settings:

```bash
# Uses xrpc.toml settings
xrpc generate

# Overrides contract from xrpc.toml
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
