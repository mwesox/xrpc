# AGENTS.md

## Product summary: xRPC
xRPC is a next-generation RPC framework that lets you define API contracts in TypeScript using Zod schemas, then generate idiomatic, dependency-free code for multiple languages. It aims to keep full type safety across language boundaries while avoiding manual SDKs, API drift, and runtime surprises.

## Goal of this repo
This repository is the GitHub Pages documentation site for xRPC. The goal here is to maintain and publish the docs site, not the product source code.

## Working rules
- Work only in this `gh-pages` documentation branch.
- Do not switch this repo to `main` or modify product code here.
- The main xRPC codebase lives in `../xrpc`; read that folder if you want to understand the product's internals.

## Deployment
- This branch is the source for GitHub Pages.
- Deployment is handled by `.github/workflows/jekyll.yml`:
  - Triggers on pushes to `gh-pages` (or manual dispatch).
  - Builds with Ruby + Jekyll and uploads the `_site` artifact.
  - Deploys to GitHub Pages via `actions/deploy-pages`.
- The site is published at https://mwesox.github.io/xrpc (see `_config.yml`).
- Local preview and builds use the Makefile:
  - `make serve` for a local dev server
  - `make build` for a production build
