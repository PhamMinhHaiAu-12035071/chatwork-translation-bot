# Commands

## Development

```bash
# First-time setup (for IDE type-checking only — Docker doesn't need this):
bun install

# Start all services (translator + webhook-logger + zrok + dataset-runner):
bun run dev

# Stop all services:
bun run dev:down

# Tail logs from all services:
bun run dev:logs
```

> `bun run dev` now includes the `dataset-runner` sidecar. It starts idle by default
> (`DATASET_AUTORUN=false`). Set `DATASET_AUTORUN=true` in `.env` to activate.
> Copy seed batches: `cp input/samples/*.jsonl input/pending/`

### Dataset Replay / Reset

Control replay behavior via env vars before running `bun run dev`:

| Variable               | Values                                          | Purpose                                       |
| ---------------------- | ----------------------------------------------- | --------------------------------------------- |
| `DATASET_RESET_MODE`   | `resume` (default) / `from-start` / `from-line` | Resume from checkpoint or replay              |
| `DATASET_RESET_FILE`   | filename (e.g. `001-vfa-*.jsonl`)               | Target file for `from-start` / `from-line`    |
| `DATASET_RESET_LINE`   | integer                                         | Line number to replay from (`from-line` mode) |
| `DATASET_CLEAR_FAILED` | `true` / `false`                                | Delete previous `failed.jsonl` before run     |
| `DATASET_CLEAR_OUTPUT` | `true` / `false`                                | Delete previous output files before run       |

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
>
> `bun run dev` có cơ chế self-heal xung đột port local: nếu proxy trên port hiện tại
> healthy (`/models` OK) thì tái sử dụng; nếu unhealthy thì tự cleanup và khởi động lại.
> `bun run dev:down` cũng cleanup listener local theo `CURSOR_API_URL` để giảm lỗi `EADDRINUSE`.

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
bun run dev           # Start: translator + webhook-logger + zrok (+ cursor-proxy if AI_PROVIDER=cursor)
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
