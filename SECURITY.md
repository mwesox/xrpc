# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report (suspected) security vulnerabilities to **[security@mwesox.dev](mailto:security@mwesox.dev)**. You will receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible depending on complexity but historically within a few days.

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Security Best Practices

When using xRpc:

- **Always validate input**: While xRpc uses Zod for validation, ensure your business logic also validates data appropriately
- **Use HTTPS**: Always use HTTPS in production to protect data in transit
- **Keep dependencies updated**: Regularly update xRpc and its dependencies to receive security patches
- **Review generated code**: Review generated code for your specific use case and add additional security measures as needed
- **Implement authentication**: xRpc provides middleware hooks for authentication - ensure you implement proper authentication and authorization
- **Follow principle of least privilege**: Only grant necessary permissions to your services

## Security Considerations

xRpc is a code generation tool and RPC framework. Security considerations include:

- **Input Validation**: Generated code includes Zod validation, but you should review and enhance validation for your specific use cases
- **Authentication/Authorization**: You must implement authentication and authorization in your middleware
- **Transport Security**: Use HTTPS/TLS in production environments
- **Dependency Security**: Keep all dependencies (including xRpc) up to date
- **Generated Code Review**: Review generated code, especially for security-sensitive applications

## Disclosure Policy

When we receive a security bug report, we will assign it to a primary handler. This person will coordinate the fix and release process, involving the following steps:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all releases still in maintenance
4. Publish a security advisory and release the fixes

We credit security researchers who report vulnerabilities responsibly.
