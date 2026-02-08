# Contributing to xRPC

## Quick Start

```bash
git clone https://github.com/mwesox/xrpc.git
cd xrpc
bun install
bun run check
```

## Development Commands

```bash
# Build packages
bun run build

# Run tests
bun test
bun run test:e2e

# Run CLI in dev mode
bun run dev

# Try generation
bun run xrpc generate --targets go-server --input examples/x-rpc-todo-app/packages/api/src/contract.ts
```

## Pull Requests

1. Create a feature branch from `main`.
2. Make focused changes and add/update tests.
3. If your PR changes publishable package behavior in `packages/*`, add a changeset:

```bash
bunx changeset
```

4. Run checks locally:

```bash
bun run check
```

5. Open a PR with a clear description and test notes.

## Release Process (Manual, No Bots)

Releases are cut manually from `main` using `.github/workflows/release-npm.yml`.

### Release prep

1. Merge feature PRs (with changesets) to `main`.
2. Create a release prep PR that runs:

```bash
bun run release:version
```

3. Merge the release prep PR.

### Publish

1. Trigger workflow `Release NPM` with `dry_run=true`.
2. If dry run passes, trigger again with `dry_run=false`.
3. The workflow publishes changed packages, creates per-package tags, and creates one GitHub Release entry.

### Tag format

- `npm/<pkg-slug>/vX.Y.Z`
- Example: `npm/xrpckit-sdk/v0.0.3`

## Adding a New Target Package

1. Create `packages/target-{language}-{client|server}/`.
2. Implement a `Target` using `@xrpckit/sdk`.
3. Register the target in `packages/cli/src/registry.ts`.
4. Add tests.
5. Publish flow auto-discovers `packages/target-*` packages.

## Code Standards

- TypeScript strict mode, avoid `any`.
- Keep changes small and focused.
- Generated output must remain idiomatic for target language.

## Need Help?

- Open a [GitHub Issue](https://github.com/mwesox/xrpc/issues)
