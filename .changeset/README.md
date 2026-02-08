# Changesets (Manual, No Bots)

xRPC uses Changesets for independent package versioning, but release execution is manual.

## PR rule

Add a changeset when your PR changes publishable package behavior in `packages/*`.

Create one with:

```bash
bunx changeset
```

## Versioning

Use semantic versioning per package:

- `patch`: fixes, internal behavior changes, safe refactors
- `minor`: backward-compatible features
- `major`: breaking API/runtime changes

## Manual release flow

1. Merge feature PRs (with changesets) into `main`.
2. Run versioning in a release prep PR:

```bash
bun run release:version
```

3. Merge release prep PR.
4. Trigger manual workflow: `.github/workflows/release-npm.yml`.

The workflow validates tarballs, publishes changed packages, and creates package tags.
