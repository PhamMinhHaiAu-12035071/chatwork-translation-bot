# Docker Compose One-Command Dev Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 5 manual terminal steps with a single `bun run dev` command that starts all local services via Docker Compose.

**Architecture:** Two separate Docker Compose files — `docker-compose.yml` (production: build from Dockerfiles) and `docker-compose.dev.yml` (standalone dev: volume-mounted hot-reload + localtunnel auto-restart + optional cursor-proxy via profiles). Services communicate via Docker internal network `chatwork-net` using service names.

**Tech Stack:** Docker Compose v3.9 · oven/bun:1.1-alpine (dev) · oven/bun:1.1-distroless (prod) · node:20-alpine (tunnel/cursor-proxy) · localtunnel (npm package, pinned via npx)

---

## Context Map

| File                     | Role                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `Dockerfile`             | Translator production image — distroless, multi-stage — **DO NOT MODIFY**     |
| `Dockerfile.logger`      | **CREATE** — mirror of Dockerfile for webhook-logger                          |
| `docker-compose.yml`     | **UPDATE** — add webhook-logger service + chatwork-net network                |
| `docker-compose.dev.yml` | **CREATE** — standalone dev file, no override merge                           |
| `package.json`           | **UPDATE** — replace `dev` script + add dev:cursor, dev:down, dev:logs, start |
| `.env.example`           | **UPDATE** — document Docker networking + COMPOSE_PROFILES                    |

### Key Env Var Differences: Native vs Docker

| Variable         | Native (current)           | Docker (new)                  |
| ---------------- | -------------------------- | ----------------------------- |
| `TRANSLATOR_URL` | `http://localhost:3000`    | `http://translator:3000`      |
| `CURSOR_API_URL` | `http://localhost:8765/v1` | `http://cursor-proxy:8765/v1` |

The dev Compose file injects these overrides via `environment:` — no `.env` edit needed from the user.

---

## Task 1: Create `Dockerfile.logger`

**Files:**

- Create: `Dockerfile.logger`

This is a mirror of `Dockerfile` targeting `webhook-logger` instead of `translator`. The app reads `LOGGER_PORT` (not `PORT`).

**Step 1: Create the file**

```dockerfile
# Stage 1: Builder
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy workspace config files
COPY package.json bun.lock* ./
COPY tsconfig.base.json ./

# Copy packages
COPY packages/core/package.json ./packages/core/
COPY packages/webhook-logger/package.json ./packages/webhook-logger/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/core/src ./packages/core/src
COPY packages/webhook-logger/src ./packages/webhook-logger/src

# Build the webhook-logger
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

**Step 2: Verify the build**

```bash
docker build -f Dockerfile.logger -t test-logger .
```

Expected: `Successfully built <hash>` — no errors. The build may take 1-2 minutes on first run.

**Step 3: Commit**

```bash
git add Dockerfile.logger
git commit -m "feat(docker): add Dockerfile.logger for webhook-logger production image"
```

---

## Task 2: Update `docker-compose.yml` (Production)

**Files:**

- Modify: `docker-compose.yml`

**Step 1: Replace the file**

Replace the entire `docker-compose.yml` with:

```yaml
version: '3.9'

services:
  translator:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    ports:
      - '${PORT:-3000}:3000'
    restart: unless-stopped
    networks: [chatwork-net]
    # Use bun --eval instead of wget: oven/bun:1.1-distroless has no shell/wget
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
    env_file:
      - .env
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

**Step 2: Validate the Compose file**

```bash
docker compose -f docker-compose.yml config
```

Expected: YAML output showing merged config with no errors. Both services appear, network `chatwork-net` appears.

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add webhook-logger to production compose + chatwork-net network"
```

---

## Task 3: Create `docker-compose.dev.yml`

**Files:**

- Create: `docker-compose.dev.yml`

This is a **standalone** dev file (not a Compose override). It replaces build with volume-mounted source + hot-reload, adds localtunnel auto-restart loop, and conditionally adds cursor-proxy via profiles.

**Step 1: Create the file**

```yaml
version: '3.9'

services:
  translator:
    image: oven/bun:1.1-alpine
    command: bun --hot packages/translator/src/index.ts
    working_dir: /app
    volumes:
      - .:/app
      # Anonymous volume prevents host node_modules from overriding container's
      - /app/node_modules
    env_file:
      - .env
    environment:
      # Override for Docker internal networking
      - CURSOR_API_URL=http://cursor-proxy:8765/v1
    ports:
      - '${PORT:-3000}:3000'
    restart: unless-stopped
    networks: [chatwork-net]
    # bun:1.1-alpine has wget, but use bun --eval for consistency with production
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
    env_file:
      - .env
    environment:
      # Override localhost → Docker service name
      - TRANSLATOR_URL=http://translator:3000
    ports:
      - '${LOGGER_PORT:-3001}:3001'
    restart: unless-stopped
    networks: [chatwork-net]
    depends_on:
      translator:
        condition: service_healthy

  # Localtunnel with auto-restart loop — keeps reconnecting if disconnected
  # URL is always https://chatwork-logger.loca.lt (set once in Chatwork)
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

  # Cursor API proxy — only starts when COMPOSE_PROFILES=cursor
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
      # Mount Cursor credentials from host (read-only)
      - ${HOME}/.cursor:/root/.cursor:ro
    command: node node_modules/cursor-api-proxy/dist/cli.js

networks:
  chatwork-net:
    driver: bridge
```

**Step 2: Validate the Compose file**

```bash
docker compose -f docker-compose.dev.yml config
```

Expected: YAML output with 3 services (translator, webhook-logger, tunnel). `cursor-proxy` only appears in profiles. No errors.

**Step 3: Validate with cursor profile**

```bash
COMPOSE_PROFILES=cursor docker compose -f docker-compose.dev.yml config
```

Expected: 4 services now visible including `cursor-proxy`.

**Step 4: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat(docker): add dev compose with hot-reload, localtunnel, cursor-proxy profile"
```

---

## Task 4: Update `package.json` Scripts

**Files:**

- Modify: `package.json`

**Step 1: Replace the `dev` script and add new scripts**

In the `"scripts"` object, replace the `dev` line and add the new scripts:

Old `dev` (line 9):

```json
"dev": "NODE_ENV=development bun run packages/translator/src/index.ts",
```

New block to replace it with (add after `dev`, keep all other scripts intact):

```json
"dev": "docker compose -f docker-compose.dev.yml up",
"dev:cursor": "COMPOSE_PROFILES=cursor docker compose -f docker-compose.dev.yml up",
"dev:down": "docker compose -f docker-compose.dev.yml down",
"dev:logs": "docker compose -f docker-compose.dev.yml logs -f",
"start": "docker compose up",
"start:down": "docker compose down",
```

Full updated `scripts` block for reference:

```json
"scripts": {
  "dev": "docker compose -f docker-compose.dev.yml up",
  "dev:cursor": "COMPOSE_PROFILES=cursor docker compose -f docker-compose.dev.yml up",
  "dev:down": "docker compose -f docker-compose.dev.yml down",
  "dev:logs": "docker compose -f docker-compose.dev.yml logs -f",
  "start": "docker compose up",
  "start:down": "docker compose down",
  "build": "bun build packages/translator/src/index.ts --outfile dist/server.js --target bun --minify",
  "logger": "bun run --hot packages/webhook-logger/src/index.ts",
  "tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger",
  "lint": "bun run --workspaces --if-present --sequential lint",
  "lint:fix": "bun run --workspaces --if-present --sequential lint:fix",
  "format": "bun run --workspaces --if-present --sequential format && prettier --write \"*.{json,md,yml,yaml}\" \"docs/**/*.md\"",
  "typecheck": "tsc --noEmit -p tsconfig.root.json && bun run --workspaces --if-present --sequential typecheck",
  "test": "bun test",
  "quality": "bun run lint && bun run typecheck && bun run test",
  "quality:ci": "bun run quality && bunx prettier --check \"*.{json,md,yml,yaml}\" \"docs/**/*.md\"",
  "verify:standards": "bun run scripts/verify-standards.ts",
  "cursor-proxy": "node \"$(realpath node_modules/cursor-api-proxy/dist/cli.js)\"",
  "prepare": "husky"
}
```

**Step 2: Verify scripts are valid JSON**

```bash
bun run --help 2>&1 | head -5
cat package.json | bun -e "const j = require('/dev/stdin'); console.log(Object.keys(j.scripts).join(', '))"
```

Expected: Lists of script names including `dev`, `dev:cursor`, `dev:down`, `dev:logs`, `start`, `start:down`.

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(scripts): replace dev with docker compose, add dev:cursor, start commands"
```

---

## Task 5: Update `.env.example`

**Files:**

- Modify: `.env.example`

**Step 1: Update the cursor provider section and add Docker section**

Replace the existing cursor section (lines 25–29):

Old:

```bash
# --- Cursor provider (local dev only) ---
# Start cursor proxy first: bun run cursor-proxy
# Then set:
# AI_PROVIDER=cursor
# CURSOR_API_URL=http://localhost:8765/v1
```

New:

```bash
# --- Cursor provider (local dev only) ---
# Via Docker Compose (recommended): set COMPOSE_PROFILES=cursor then run:
#   bun run dev:cursor
# Then set in .env:
# AI_PROVIDER=cursor
# CURSOR_API_URL=http://cursor-proxy:8765/v1   ← Docker internal network
# (if running native outside Docker: CURSOR_API_URL=http://localhost:8765/v1)
```

Then append at the end of the file:

```bash
# --- Docker Compose ---
# Uncomment when using Cursor provider with Docker dev:
# COMPOSE_PROFILES=cursor

# NOTE: TRANSLATOR_URL below is for native dev (bun run dev outside Docker).
# When using Docker Compose (bun run dev), this value is automatically overridden
# to http://translator:3000 by docker-compose.dev.yml.
# Do NOT change TRANSLATOR_URL to http://translator:3000 here — it will break native dev.
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document Docker networking and COMPOSE_PROFILES for dev workflow"
```

---

## Task 6: Final Validation

**Step 1: Run the quality checks**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All pass. These don't require Docker — they validate TypeScript and test files only.

**Step 2: Validate both Compose files are syntactically correct**

```bash
docker compose -f docker-compose.yml config > /dev/null && echo "prod: OK"
docker compose -f docker-compose.dev.yml config > /dev/null && echo "dev: OK"
```

Expected:

```
prod: OK
dev: OK
```

**Step 3: Smoke test — pull images and dry-run**

```bash
docker compose -f docker-compose.dev.yml pull
```

Expected: Pulls `oven/bun:1.1-alpine` and `node:20-alpine`. No errors.

**Step 4: Commit design doc**

```bash
git add docs/plans/
git commit -m "docs(plans): add Docker Compose dev workflow design and implementation plan"
```

---

## Usage After Implementation

```bash
# Start all local dev services (gemini/openai provider):
bun run dev

# Start with Cursor provider (cursor-proxy enabled):
bun run dev:cursor

# Stop everything:
bun run dev:down

# View tunnel URL (to set in Chatwork webhook once):
docker compose -f docker-compose.dev.yml logs tunnel
# → your url is: https://chatwork-logger.loca.lt

# View all logs live:
bun run dev:logs

# Production:
docker compose up
```

---

## Failure Mode Acceptance Criteria

These are the observable behaviors for critical failure scenarios. Verify manually after implementation.

### Tunnel reconnect after network loss

**Scenario**: Disconnect network for 10 seconds, reconnect.
**Expected**: Within 10 seconds of reconnect, tunnel container logs `your url is: https://chatwork-logger.loca.lt`. No manual intervention needed.
**Verify**: `docker compose -f docker-compose.dev.yml logs -f tunnel`

### Localtunnel subdomain already taken

**Scenario**: Another user has claimed `chatwork-logger` subdomain.
**Expected**: Tunnel container logs error immediately (e.g. `subdomain is not available`), then retries every 3s.
**Resolution**: Change subdomain in `docker-compose.dev.yml` to a unique name (e.g. `cw-bot-<yourname>`), run `bun run dev:down && bun run dev`.

### cursor-proxy missing or expired credentials

**Scenario**: `~/.cursor` missing or auth token expired.
**Expected**: `cursor-proxy` container exits with non-zero code + logs clear auth error. `translator` and `webhook-logger` continue running unaffected. Only requests with `AI_PROVIDER=cursor` fail.
**Verify**: `docker compose -f docker-compose.dev.yml logs cursor-proxy`

### webhook-logger can't reach translator (startup order)

**Scenario**: Translator takes >10s to start (cold Docker pull).
**Expected**: `webhook-logger` waits due to `depends_on: condition: service_healthy`. Does not start until translator passes healthcheck.
**Verify**: `docker compose -f docker-compose.dev.yml ps` — webhook-logger shows `starting` state until translator is `healthy`.

### Webhook drop during tunnel reconnect (~3s window)

**Expected behavior (by design)**: Chatwork webhooks sent during tunnel reconnect are silently dropped. This is acceptable in local dev — Chatwork does not retry failed webhooks.
**Mitigation**: Keep dev sessions stable; avoid restarting `bun run dev` mid-test. For persistent testing, use `bun run tunnel:logger` as manual fallback.

---

## Migration from Native Dev Flow

For developers currently using the native flow (`bun run dev` + `bun run logger` + manual tunnel), the transition is:

| Old command                     | New equivalent                                                 |
| ------------------------------- | -------------------------------------------------------------- |
| `bun run dev` (translator only) | `bun run dev` (now starts everything via Docker)               |
| `bun run logger`                | Included in `bun run dev` — no separate step                   |
| `cloudflared tunnel --url ...`  | Included in `bun run dev` — tunnel auto-starts                 |
| `bun run cursor-proxy`          | `bun run dev:cursor` (includes cursor-proxy)                   |
| Manual Chatwork webhook update  | Done once — URL `https://chatwork-logger.loca.lt` is now fixed |

**First-time setup** (one-time only):

```bash
bun install                   # ensure host node_modules for IDE
docker compose -f docker-compose.dev.yml pull  # pre-pull images
bun run dev                   # start everything
docker compose -f docker-compose.dev.yml logs tunnel  # get tunnel URL
# → Set https://chatwork-logger.loca.lt/webhook in Chatwork once
```

---

## Risks & Mitigations

| Risk                                                          | Mitigation                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `wget` healthcheck fails on distroless image                  | Use `bun --eval` + native fetch — no external binary needed                 |
| localtunnel subdomain `chatwork-logger` taken by another user | Use unique name e.g. `cw-bot-<yourname>` in docker-compose.dev.yml          |
| localtunnel service down (no SLA)                             | Docker `restart: always` + 3s retry loop; fallback: `bun run tunnel:logger` |
| `~/.cursor` path missing or expired credentials               | cursor-proxy logs clear error; translator unaffected; refresh Cursor auth   |
| `bun --hot` inside Docker may behave differently than native  | Anonymous `/app/node_modules` volume prevents host/container conflict       |
| `bun install` must be run on host for IDE/TS language server  | Document in README: run `bun install` once after cloning                    |
| Webhook drop during 3s tunnel reconnect window                | Accepted in local dev; Chatwork does not retry — resend manually if needed  |

---

## Task 7: Update `ai_rules/commands.md`

**Files:**

- Modify: `ai_rules/commands.md`

Cập nhật doc để phản ánh workflow mới. `AGENTS.md` và `CLAUDE.md` không cần thay đổi vì cả hai đã delegate sang `ai_rules/commands.md`.

**Step 1: Replace the Development section (lines 4–17)**

Old:

````markdown
## Development

```bash
bun run dev          # Run translator with hot-reload
```
````

### Cursor Provider (local dev)

```bash
# 1. Start the cursor proxy (separate terminal):
bun run cursor-proxy

# 2. Start the translator server:
AI_PROVIDER=cursor CURSOR_API_URL=http://localhost:8765/v1 bun run dev
```

````

New:
```markdown
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
````

### Cursor Provider (local dev)

```bash
# Starts translator + webhook-logger + localtunnel + cursor-proxy:
bun run dev:cursor

# Stop:
bun run dev:down
```

> `bun run dev` starts the full stack via Docker Compose (`docker-compose.dev.yml`).
> Services run with hot-reload via volume mounts. Localtunnel auto-restarts if it drops.

````

**Step 2: Replace the Docker section (lines 46–51)**

Old:
```markdown
## Docker

```bash
docker compose up            # Run on port 3000 with healthcheck
docker compose up --build    # Rebuild image and run
````

````

New:
```markdown
## Docker

### Dev (hot-reload, all services, no build needed)

```bash
bun run dev           # Start: translator + webhook-logger + localtunnel
bun run dev:cursor    # Start with cursor-proxy (COMPOSE_PROFILES=cursor)
bun run dev:down      # Stop all dev services
bun run dev:logs      # Tail logs from all dev services
````

### Production (distroless builds)

```bash
bun run start                  # docker compose up (uses docker-compose.yml)
bun run start:down             # docker compose down
docker compose up --build      # Rebuild production images and start
```

> Dev uses `docker-compose.dev.yml` (standalone file, not an override).
> Prod uses `docker-compose.yml` (distroless images, no volume mounts).

````

**Step 3: Commit**

```bash
git add ai_rules/commands.md
git commit -m "docs(ai-rules): update commands to reflect Docker Compose dev workflow"
````

---

## Task 8: Add Docker networking note to `ai_rules/architecture-patterns.md`

**Files:**

- Modify: `ai_rules/architecture-patterns.md`

**Step 1: Add section after Runtime Endpoints table (after line 88)**

```markdown
## Docker Service Networking (Dev + Prod)

When running via Docker Compose, services communicate over the `chatwork-net` bridge network
using Docker service names — **not** `localhost`:

| From           | To         | URL                      |
| -------------- | ---------- | ------------------------ |
| webhook-logger | translator | `http://translator:3000` |

This is injected automatically via `environment:` in the compose files. The `.env` file
keeps `TRANSLATOR_URL=http://localhost:3000` for native dev (without Docker).
```

**Step 2: Commit**

```bash
git add ai_rules/architecture-patterns.md
git commit -m "docs(ai-rules): add Docker service networking note to architecture patterns"
```
