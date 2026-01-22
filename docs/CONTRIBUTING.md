# Contributing to xRpc

Thank you for your interest in contributing to xRpc! This document provides guidelines and instructions for contributing.

## 🎯 Our Vision

Before contributing, please read our [Vision & Mission](./VISION.md) document to understand the project's goals and principles.

## 🤝 How to Contribute

### Reporting Bugs

- Use the GitHub issue tracker
- Include a clear title and description
- Provide steps to reproduce
- Include environment details (OS, Node version, etc.)
- Add code examples or screenshots if applicable

### Suggesting Features

- Check existing issues first
- Open a new issue with the "enhancement" label
- Describe the use case and benefits
- Consider cross-platform implications

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow our coding standards
4. **Write tests**: Ensure all tests pass
5. **Update documentation**: Keep docs in sync with changes
6. **Commit your changes**: Use clear, descriptive commit messages
7. **Push to your fork**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**: Provide a clear description

## 📋 Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/x-rpc.git
cd x-rpc

# Install dependencies
npm install

# Run tests
bun test
# Or run tests for a specific package
bun test packages/parser/src

# Run linter
npm run lint

# Build the project
bun run build
```

## 🎨 Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow the existing code style

### Code Generation

- Generated code must be idiomatic for the target language
- All generated code should pass language-specific linters
- Include comments explaining generated patterns
- Ensure consistent formatting

### Testing

- Write tests for all new features
- Maintain or improve test coverage
- Test across different target languages
- Include integration tests for code generation

## 📝 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(generator): add Python client generation
fix(runtime): handle null values in validation
docs(readme): update quick start guide
```

## 🔍 Code Review Process

1. All PRs require at least one approval
2. CI must pass (tests, linting, build)
3. Code must follow our standards
4. Documentation must be updated
5. Breaking changes require discussion

## 🌍 Cross-Platform Considerations

When contributing, remember:

- **Language Idioms**: Generated code should feel native
- **Type Safety**: Maintain type safety across all targets
- **Runtime Validation**: Ensure validation works in all languages
- **Error Handling**: Consistent error handling across platforms
- **Testing**: Test generated code in target languages

## 📚 Documentation

- Update relevant documentation with your changes
- Add examples for new features
- Keep API documentation current
- Update migration guides for breaking changes

## 🐛 Bug Fixes

- Include a test that reproduces the bug
- Fix the bug with minimal changes
- Ensure the fix doesn't break existing functionality
- Update documentation if behavior changes

## ✨ New Features

- Discuss major features in an issue first
- Consider impact on all target languages
- Maintain backward compatibility when possible
- Add comprehensive tests and documentation

## 🎓 Learning Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Code Generation Patterns](https://github.com/your-org/x-rpc/wiki/Code-Generation)

## 💬 Getting Help

- Check existing issues and discussions
- Join our community discussions
- Ask questions in GitHub Discussions
- Reach out to maintainers

## 🙏 Thank You

Your contributions make xRpc better for everyone. Thank you for taking the time to contribute!

---

*"Type safety shouldn't stop at language boundaries."*
