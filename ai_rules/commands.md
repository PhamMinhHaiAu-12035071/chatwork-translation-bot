# Commands

## Development

```bash
# First-time setup (for IDE type-checking only — Docker doesn't need this):
bun install

# Start all services (translator + webhook-logger + localtunnel):
bun run dev

# Stop all services:
bun run dev:down

# Tail logs from all services:
bun run dev:logs
```

### Cursor Provider (local dev)

```bash
# Starts translator + webhook-logger + localtunnel + cursor-proxy:
bun run dev:cursor

# Stop:
bun run dev:down
```

> `bun run dev` starts the full stack via Docker Compose (`docker-compose.dev.yml`).
> Services run with hot-reload via volume mounts. Localtunnel auto-restarts if it drops.

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

### Dev (hot-reload, all services, no build needed)

```bash
bun run dev           # Start: translator + webhook-logger + localtunnel
bun run dev:cursor    # Start with cursor-proxy (COMPOSE_PROFILES=cursor)
bun run dev:down      # Stop all dev services
bun run dev:logs      # Tail logs from all dev services
```

### Production (distroless builds)

```bash
bun run start                  # docker compose up (uses docker-compose.yml)
bun run start:down             # docker compose down
docker compose up --build      # Rebuild production images and start
```

> Dev uses `docker-compose.dev.yml` (standalone file, not an override).
> Prod uses `docker-compose.yml` (distroless images, no volume mounts).

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
