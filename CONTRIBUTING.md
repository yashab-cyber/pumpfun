# Contributing to Pump.fun Autonomous Trading Agent

Thank you for your interest in contributing!

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template:
   ```bash
   cp .env.example .env
   ```
4. Run in paper trading mode to test:
   ```bash
   npm run paper
   ```

## Code Guidelines
- Write strictly typed TypeScript without `any` wherever possible.
- Ensure all numbers and numerical divisions are guarded against `NaN` and `0`.
- Verify compilation before opening a pull request:
   ```bash
   npm run build
   ```

## Security
- Never commit private keys or API credentials.
- All secrets must be loaded via `.env`.
