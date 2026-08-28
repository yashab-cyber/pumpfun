# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 7.x     | :white_check_mark: |
| < 7.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability or potential issue regarding wallet private key exposure:

1. **Do not create a public GitHub issue.**
2. Please disclose responsibly by contacting the maintainers privately.
3. Include details of the vulnerability, affected components, and steps to reproduce.

## Best Practices for Users
- Always test new strategies in **Paper Trading Mode** (`npm run paper`) before committing real capital.
- Use a dedicated sub-wallet with only the intended trading capital rather than your primary savings wallet.
- Keep your `.env` file secured with restricted file permissions (`chmod 600 .env`).
