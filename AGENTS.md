# AGENTS.md

## Project Overview
- Name: xRPC
- Purpose: Define API contracts in TypeScript with Zod and generate idiomatic, dependency-free code for multiple languages.

## Getting Started
- Install: `bun install`
- Build: `bun run build`
- Test: `bun test`
- CLI dev: `bun run dev` (runs the CLI package in watch mode)
- CLI install (global): `make install-cli`
- CLI install (local): `make install-cli-local` (adds binary under `.local/bin`)
- CLI via dev dependency: `bun add -d @xrpckit/cli` then run with `bunx xrpc` (no global install)
- Generate (example): `bun run xrpc generate --targets go-server --input examples/x-rpc-todo-app/packages/api/src/contract.ts`

## Repo Layout
- `packages/`: Monorepo packages
- `packages/cli`: CLI entrypoint and target registry
- `packages/xrpckit`: DSL for defining API contracts
- `packages/sdk`: Codegen SDK and shared utilities
- `packages/target-*`: Language-specific generators
- `examples/`: Sample apps and templates
- `tests/`: Unit and e2e tests

## Conventions
- Language: TypeScript (ESM)
- Runtime/Tooling: Bun
- Formatting/Lint: Biome (`bun run lint`, `bun run format`)
- Type safety: strict TS, avoid `any`
- Commits: Conventional Commits preferred for PRs

## Notes For Agents
- Keep changes small and focused.
- Update or add tests when behavior changes.
- Generated output should remain idiomatic for the target language.
- Document assumptions if anything is unclear.
