# Commands

## Development

```bash
bun run dev          # Run bot with hot-reload (packages/bot/src/index.ts)
```

## Build

```bash
bun run build        # Bundle to dist/server.js (minified, target bun)
```

## Type Checking

```bash
bun run typecheck    # Checks root + all packages (core, translator, webhook-logger)
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

## Pre-PR Validation

Run this before creating any pull request:

```bash
bun test && bun run typecheck && bun run lint
```

All three must pass with zero errors.
