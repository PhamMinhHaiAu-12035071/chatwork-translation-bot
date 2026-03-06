# Commands

## Development

```bash
bun run dev          # Run translator with hot-reload
```

### Cursor Provider (local dev)

```bash
# 1. Start the cursor proxy (separate terminal):
bun run cursor-proxy

# 2. Start the translator server:
AI_PROVIDER=cursor CURSOR_API_URL=http://localhost:8765/v1 bun run dev
```

## Build

```bash
bun run build        # Bundle to dist/server.js (minified, target bun)
```

## Type Checking

```bash
bun run typecheck    # Checks root + all packages
```

## Linting & Formatting

```bash
bun run lint         # ESLint (strict + stylistic)
bun run lint:fix     # ESLint with auto-fix
bun run format       # Prettier (formats .ts, .json, .md, .yml)
```

## Testing

```bash
bun test                                                    # Run all tests
bun test packages/core/src/utils/parse-command.test.ts     # Run single file
```

## Docker

```bash
docker compose up            # Run on port 3000 with healthcheck
docker compose up --build    # Rebuild image and run
```

## Standards Verification

```bash
bun run verify:standards     # Verify all packages have required scripts
```

## Pre-PR Validation

Run this before creating any pull request:

```bash
bun test && bun run typecheck && bun run lint
```

All three must pass with zero errors.
