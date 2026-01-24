.PHONY: install-cli uninstall-cli build-cli

# Build and install CLI globally
install-cli: build-cli
	@echo "Installing xrpc CLI globally..."
	cd packages/cli && npm install -g .
	@echo "Done! Run 'xrpc --help' to verify."

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
