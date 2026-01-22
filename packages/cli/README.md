# xRpc CLI

Command-line interface for xRpc code generation with a beautiful TUI (Terminal User Interface).

## Installation

```bash
bun install
```

## Usage

### Interactive Mode

Run without arguments to see the interactive menu:

```bash
xrpc
```

Or run a command interactively - the CLI will prompt for missing arguments:

```bash
xrpc generate
```

### Command Mode

Provide all arguments directly:

```bash
# Generate code for Go
xrpc generate -i src/api.ts -o generated -t go

# Generate code for multiple targets
xrpc generate --input src/api.ts --output generated --targets go,typescript-express

# Show help
xrpc --help
xrpc help
xrpc help generate
```

## Features

### 🎨 Beautiful TUI

- **Interactive Prompts**: Missing arguments are prompted interactively
- **Progress Indicators**: Spinners show real-time progress during code generation
- **Colorful Output**: Success, error, and info messages are color-coded
- **Rich Formatting**: File paths, targets, and commands are highlighted

### 📋 Commands

#### `generate`

Generate type-safe clients and servers from API contracts.

**Options:**
- `-i, --input <path>`: Path to API contract file (e.g., `src/api.ts`)
- `-o, --output <directory>`: Output directory for generated code (default: `generated`)
- `-t, --targets <targets>`: Comma-separated list of targets (e.g., `go,typescript-express`)

**Examples:**
```bash
# Interactive mode
xrpc generate

# With all arguments
xrpc generate -i src/api.ts -o generated -t go

# Multiple targets
xrpc generate -i api.ts -o out -t go,typescript-express
```

#### `help`

Show comprehensive help and documentation.

**Usage:**
```bash
xrpc help              # Show general help
xrpc help generate     # Show help for generate command
xrpc --help           # Alias for help
```

## CLI Framework: Bunli

This CLI uses [Bunli](https://bunli.dev/) utilities for TUI features, providing:

- ✅ **Zero dependencies** (Bun-native)
- ✅ **Built-in prompts** for interactive input
- ✅ **Progress spinners** for visual feedback
- ✅ **Color utilities** for rich terminal output
- ✅ **Type-safe** with TypeScript

### Architecture

The CLI uses a hybrid approach:
- **Bunli utilities** (`@bunli/utils`) for TUI features (prompts, spinners, colors)
- **Custom argument parser** for command routing
- **Modular command structure** for easy extension

### TUI Components

- **Interactive Prompts**: File path selection, target multi-select
- **Progress Spinners**: Real-time feedback during parsing and generation
- **Color Formatting**: 
  - ✅ Green for success messages
  - ❌ Red for errors
  - ⚠️ Yellow for warnings
  - ℹ️ Blue for info
  - Cyan for file paths
  - Magenta for target names

## Development

```bash
# Run CLI locally
bun run packages/cli/src/index.ts generate -i examples/go-greeting-server/src/api.ts -o generated -t go

# Test interactive mode
bun run packages/cli/src/index.ts generate

# Show menu
bun run packages/cli/src/index.ts
```

## Project Structure

```
packages/cli/
├── src/
│   ├── index.ts              # Main entry point
│   ├── commands/
│   │   ├── generate.ts      # Generate command with TUI
│   │   ├── help.ts          # Help command
│   │   └── menu.ts          # Interactive menu
│   └── utils/
│       └── tui.ts            # TUI utility functions
└── package.json
```

## Examples

### Interactive Generation

```bash
$ xrpc generate
API contract file path: (src/api.ts) examples/go-greeting-server/src/api.ts
Output directory: (generated) 
Select targets to generate: [Use arrow keys, space to select]
  ◯ go
  ◯ typescript-express
```

### Non-Interactive (CI-friendly)

```bash
$ xrpc generate -i src/api.ts -o generated -t go
✅ Found 1 endpoint
✅ Wrote 2 files
  ✓ Generated generated/go/server/types.go
  ✓ Generated generated/go/server/router.go
✅ Generated go code
✓ Generation complete!
ℹ Output directory: generated
```
