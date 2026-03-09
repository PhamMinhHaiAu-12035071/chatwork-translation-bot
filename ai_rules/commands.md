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

Set `AI_PROVIDER=cursor` trong `.env`. Khi đó `bun run dev` tự phát hiện và khởi động
cursor-proxy natively trên macOS cùng với Docker services (colored logs via `concurrently`):

```bash
# Auto-starts cursor-proxy (native macOS) + all Docker services:
bun run dev

# Stop cursor-proxy + all Docker services:
bun run dev:down
```

> cursor-proxy chạy native, không trong Docker. Translator kết nối đến nó qua
> `http://host.docker.internal:8765/v1` (Docker Desktop for Mac magic hostname).

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
bun run dev           # Start: translator + webhook-logger + localtunnel (+ cursor-proxy if AI_PROVIDER=cursor)
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
