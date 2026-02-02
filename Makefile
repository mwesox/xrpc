.PHONY: install-cli install-cli-local uninstall-cli build-cli

LOCAL_CLI_PREFIX ?= ./.local

# Build and install CLI globally
install-cli: build-cli
	@echo "Installing xrpc CLI globally..."
	cd packages/cli && npm install -g .
	@echo "Done! Run 'xrpc --help' to verify."

# Build and install CLI locally (no global install)
install-cli-local: build-cli
	@echo "Installing xrpc CLI locally to $(LOCAL_CLI_PREFIX)..."
	cd packages/cli && npm install -g . --prefix "$(LOCAL_CLI_PREFIX)"
	@echo "Done! Add $(LOCAL_CLI_PREFIX)/bin to your PATH or run $(LOCAL_CLI_PREFIX)/bin/xrpc."

# Build CLI package
build-cli:
	@echo "Building CLI..."
	cd packages/cli && bun run build

# Uninstall CLI globally
uninstall-cli:
	@echo "Uninstalling xrpc CLI..."
	npm uninstall -g @xrpckit/cli
	@echo "Done!"

# Rebuild and reinstall (useful during development)
reinstall-cli: uninstall-cli install-cli
