# Design: Docker Compose One-Command Dev Workflow

**Date**: 2026-03-09
**Status**: Approved
**Author**: Claude Code (brainstorming session)

---

## Problem

Current local dev requires 5 manual steps across multiple terminals:

1. `bun run cursor-proxy` — start Cursor API proxy (if using cursor provider)
2. `bun run logger` — start webhook-logger on port 3001
3. `cloudflared tunnel --url http://localhost:3001` — create public HTTPS tunnel (random URL each time)
4. Go to Chatwork → Account Integrations → update webhook URL manually
5. `bun run dev` — start translator on port 3000

**Root issues:**

- No single entrypoint to orchestrate all services
- `cloudflared` generates random URLs → must update Chatwork webhook URL on every restart
- No isolation between local dev and production

---

## Solution: Approach A — Dev Image + Production Build Targets

### Architecture Overview

```
docker-compose.yml          ← Production only (translator + webhook-logger, build from Dockerfiles)
docker-compose.dev.yml      ← Standalone dev file (volume-mount + hot-reload + tunnel + cursor-proxy)
Dockerfile                  ← Translator production image (existing, unchanged)
Dockerfile.logger           ← Webhook-logger production image (new)
```

> **Model**: `docker-compose.dev.yml` là file **độc lập** (không phải override ghép với base).
> Dev dùng `docker compose -f docker-compose.dev.yml up`, prod dùng `docker compose up`.

### Services

| Service          | Dev                                | Prod                         | Profile  | Port |
| ---------------- | ---------------------------------- | ---------------------------- | -------- | ---- |
| `translator`     | oven/bun:1.1-alpine + volume mount | build from Dockerfile        | —        | 3000 |
| `webhook-logger` | oven/bun:1.1-alpine + volume mount | build from Dockerfile.logger | —        | 3001 |
| `tunnel`         | node:20-alpine (localtunnel loop)  | ❌ not included              | —        | —    |
| `cursor-proxy`   | node:20-alpine + ~/.cursor mount   | ❌ not included              | `cursor` | 8765 |

### Internal Network

All services communicate via Docker internal network `chatwork-net`.
`TRANSLATOR_URL` must be `http://translator:3000` (not `localhost`) when running in Docker.

---

## Files to Create / Modify

### 1. `docker-compose.yml` (Update — Production Base)

> **Healthcheck note**: `oven/bun:1.1-distroless` không có shell hay `wget`. Dùng `bun --eval` với native fetch API — chỉ cần `bun` binary (luôn có trong distroless image).

```yaml
version: '3.9'

services:
  translator:
    build:
      context: .
      dockerfile: Dockerfile
    env_file: [.env]
    ports:
      - '${PORT:-3000}:3000'
    restart: unless-stopped
    networks: [chatwork-net]
    healthcheck:
      test:
        - 'CMD'
        - 'bun'
        - '--eval'
        - "const r = await fetch('http://localhost:3000/health'); if (!r.ok) process.exit(1)"
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  webhook-logger:
    build:
      context: .
      dockerfile: Dockerfile.logger
    env_file: [.env]
    ports:
      - '${LOGGER_PORT:-3001}:3001'
    restart: unless-stopped
    networks: [chatwork-net]
    depends_on:
      translator:
        condition: service_healthy

networks:
  chatwork-net:
    driver: bridge
```

### 2. `docker-compose.dev.yml` (New — Standalone Dev File)

File độc lập, không merge với `docker-compose.yml`. Dùng base image trực tiếp thay vì build.

```yaml
version: '3.9'

services:
  translator:
    image: oven/bun:1.1-alpine
    command: bun --hot packages/translator/src/index.ts
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules # anonymous volume — giữ container's node_modules
    env_file: [.env]
    environment:
      - CURSOR_API_URL=http://cursor-proxy:8765/v1 # Docker internal networking
    ports:
      - '${PORT:-3000}:3000'
    restart: unless-stopped
    networks: [chatwork-net]
    healthcheck:
      test:
        - 'CMD'
        - 'bun'
        - '--eval'
        - "const r = await fetch('http://localhost:3000/health'); if (!r.ok) process.exit(1)"
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  webhook-logger:
    image: oven/bun:1.1-alpine
    command: bun --hot packages/webhook-logger/src/index.ts
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    env_file: [.env]
    environment:
      - TRANSLATOR_URL=http://translator:3000 # Docker internal networking
    ports:
      - '${LOGGER_PORT:-3001}:3001'
    restart: unless-stopped
    networks: [chatwork-net]
    depends_on:
      translator:
        condition: service_healthy

  # Localtunnel auto-restart — URL cố định https://chatwork-logger.loca.lt
  tunnel:
    image: node:20-alpine
    restart: always
    networks: [chatwork-net]
    command: >
      sh -c "while true; do
        npx --yes localtunnel@2
          --port 3001
          --subdomain chatwork-logger
          --local-host webhook-logger;
        echo '[tunnel] Disconnected. Reconnecting in 3s...';
        sleep 3;
      done"
    depends_on: [webhook-logger]

  # Cursor API proxy — chỉ khởi động khi COMPOSE_PROFILES=cursor
  cursor-proxy:
    profiles: [cursor]
    image: node:20-alpine
    restart: unless-stopped
    networks: [chatwork-net]
    ports:
      - '8765:8765'
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
      - ${HOME}/.cursor:/root/.cursor:ro # mount Cursor credentials từ host
    command: node node_modules/cursor-api-proxy/dist/cli.js

networks:
  chatwork-net:
    driver: bridge
```

### 3. `Dockerfile.logger` (New — Webhook-logger Production)

```dockerfile
# Stage 1: Builder
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/webhook-logger/package.json ./packages/webhook-logger/

RUN bun install --frozen-lockfile

COPY packages/core/src ./packages/core/src
COPY packages/webhook-logger/src ./packages/webhook-logger/src

RUN bun build packages/webhook-logger/src/index.ts \
    --outfile dist/logger.js \
    --target bun \
    --minify

# Stage 2: Runtime (distroless)
FROM oven/bun:1.1-distroless AS runtime

WORKDIR /app

COPY --from=builder /app/dist/logger.js ./logger.js

ENV NODE_ENV=production
ENV LOGGER_PORT=3001

EXPOSE 3001

CMD ["bun", "run", "logger.js"]
```

### 4. `package.json` Scripts (Update)

```json
"scripts": {
  "dev": "docker compose -f docker-compose.dev.yml up",
  "dev:cursor": "COMPOSE_PROFILES=cursor docker compose -f docker-compose.dev.yml up",
  "dev:down": "docker compose -f docker-compose.dev.yml down",
  "dev:logs": "docker compose -f docker-compose.dev.yml logs -f",
  "start": "docker compose up",
  "start:down": "docker compose down"
}
```

### 5. `.env.example` (Update)

**Quan trọng**: `.env.example` phải giữ `TRANSLATOR_URL=http://localhost:3000` (native dev default). Docker Compose override giá trị này tự động qua `environment:` trong `docker-compose.dev.yml` — user không cần sửa `.env`.

Chỉ thêm phần documentation:

```bash
# --- Docker Compose ---
# Uncomment when using Cursor provider with Docker dev:
# COMPOSE_PROFILES=cursor

# NOTE: TRANSLATOR_URL below is for native dev (bun run dev outside Docker).
# When using Docker Compose (bun run dev), this value is automatically overridden
# to http://translator:3000 by docker-compose.dev.yml.
# Do NOT set TRANSLATOR_URL=http://translator:3000 here — it will break native dev.
```

---

## Usage After Implementation

### Local Dev (non-cursor provider)

```bash
bun run dev
# → starts: translator + webhook-logger + tunnel (localtunnel auto-restart)
# → hot-reload enabled for both services
# → tunnel URL: https://chatwork-logger.loca.lt (fixed, set once in Chatwork)

# Check tunnel URL:
docker compose -f docker-compose.dev.yml logs tunnel
```

### Local Dev (cursor provider)

```bash
# In .env: set COMPOSE_PROFILES=cursor (or use the script below)
bun run dev:cursor
# → starts all of above + cursor-proxy (port 8765)
```

### Production

```bash
docker compose up
# → translator + webhook-logger only, no tunnel, no cursor-proxy
```

### Stop

```bash
bun run dev:down   # dev
bun run start:down # prod
```

---

## Key Design Decisions

| Decision               | Choice                            | Reason                                     |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| Tunnel stability       | localtunnel + Docker restart loop | Fixed subdomain = Chatwork config once     |
| cursor-proxy isolation | Docker Compose profiles           | Only start when needed                     |
| Dev runtime            | volume mount + native bun --hot   | Fast startup, no image rebuild needed      |
| Prod/dev split         | Separate docker-compose files     | Explicit, no accidental prod contamination |
| Internal networking    | Docker network + service names    | No localhost confusion in containers       |

---

## Tradeoffs & Risks

- **localtunnel subdomain conflict**: Subdomain `chatwork-logger` có thể bị user khác claim trên server public. Mitigation: dùng tên unique hơn (e.g. `cw-bot-<yourname>`). Fallback: nếu subdomain bị chiếm, tunnel container báo lỗi trong logs — chọn subdomain khác và restart.
- **localtunnel instability**: Đây là external free service, không có SLA. Docker `restart: always` + vòng lặp 3s giảm thiểu downtime. Nếu server localtunnel down hoàn toàn, fallback thủ công: `bun run tunnel:logger` (localtunnel native) hoặc dùng cloudflare named tunnel.
- **Volume mount node_modules**: anonymous volume `/app/node_modules` prevents host's node_modules from overriding container's. Must run `bun install` on host for IDE/TS language server support.
- **`~/.cursor` mount path**: Dùng `${HOME}/.cursor` thay vì `~/.cursor` trong compose file để tương thích với Docker variable expansion.
- **cursor-proxy missing credentials**: Nếu `~/.cursor` không tồn tại hoặc credentials hết hạn, cursor-proxy sẽ fail ngay khi start và log lỗi rõ ràng. Service `translator` vẫn chạy bình thường — chỉ request dùng cursor provider bị lỗi.
- **Webhook drop khi tunnel reconnecting**: Trong ~3s reconnect window, webhook từ Chatwork có thể bị drop. Chatwork không retry webhook — behavior này được chấp nhận trong local dev context (không phải production concern).

---

## Verification Commands

```bash
bun test && bun run typecheck && bun run lint
```
