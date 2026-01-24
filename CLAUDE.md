# CLAUDE.md - AI Assistant Guide for gh-pages Branch

## Branch Context

This is the `gh-pages` branch containing the Jekyll documentation site for xrpc.

**Important**: Never checkout `main` to analyze the xrpc source code. The main codebase is available at `../xrpc` directory. Always stay on this branch when working on documentation.

## Documentation Structure

```
docs/
├── CONTRIBUTING.md          # Contribution guidelines
└── usage/                   # Usage guides
    ├── api-contract.md      # API contract definition
    ├── configuration.md     # Configuration options
    ├── middleware.md        # Middleware concepts
    ├── typescript-server.md # TypeScript server guide
    ├── typescript-client.md # TypeScript client guide
    ├── go-server.md         # Go server guide
    ├── go-client.md         # Go client guide
    └── kotlin-springboot-server.md  # Kotlin Spring Boot guide
```

## Jekyll Site Structure

- `_config.yml` - Jekyll configuration
- `_layouts/` - Page templates (default.html, home.html)
- `_includes/` - Reusable components (header, footer, navigation)
- `assets/css/main.scss` - Main stylesheet
- `index.md` - Homepage
- `Makefile` - Build commands

## Navigation

Navigation is defined in `_includes/navigation.html` and organized by sections:
- Getting Started
- Concepts
- TypeScript
- Go
- Kotlin
- Resources

## Build Commands

```bash
make serve  # Start local development server
make build  # Build the site
```

## Working with the Main Codebase

When you need to reference or analyze the xrpc source code:
1. Navigate to `../xrpc` directory
2. Do NOT checkout `main` branch in this repository
3. The main codebase is a separate directory, not a branch
