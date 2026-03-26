---
version: '1.0'
date: 2026-03-26
prepared_by: 'AI-assisted'
status: 'draft'
brainstorm: '../brainstorms/2026-03-26-unified-dev-gateway-brainstorm.md'
---

# Implementation Plan: Unified Dev Gateway

## Objective

Make `bun run dev` the **only** command needed for full-stack local development and E2E
testing. One command → backend + dashboard + public tunnel.

## Scope

- Add nginx gateway service to Docker Compose dev stack
- Build dashboard as part of `bun run dev` startup
- Point zrok tunnel through the gateway (instead of directly to webhook-logger)
- Fix webhook URL generation to use forwarded headers behind proxy
- Update documentation

## Non-Goals

- HMR/live-reload for dashboard (out of scope — use `bun run dev:dashboard` for UI iteration)
- Production deployment changes (gateway is dev-only)
- Collapsing webhook-logger into translator

## Success Criteria

- `bun run dev` builds dashboard and starts all services including gateway
- `https://<name>.share.zrok.io/` serves the dashboard UI
- `https://<name>.share.zrok.io/api/rooms` returns rooms list
- `https://<name>.share.zrok.io/webhook` receives Chatwork webhooks
- Webhook URL returned by `POST /api/rooms` reflects the public zrok domain
- `localhost:8080` mirrors the same routing for local testing without zrok
- All existing tests pass
- Docker build (production) unaffected

---

## Task 1: Create nginx gateway config

**File:** `config/nginx/dev.conf` (NEW)

**What:**

- Simple nginx config that listens on port 80
- Routes `/webhook` to `webhook-logger:3001`
- Routes everything else to `translator:3000`
- Passes `X-Forwarded-*` headers for correct origin detection
- Passes `X-Real-IP` for logging

**Config:**

```nginx
server {
    listen 80;
    server_name _;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location = /webhook {
        proxy_pass http://webhook-logger:3001;
    }

    location / {
        proxy_pass http://translator:3000;
    }
}
```

**Verification:** File exists, valid nginx syntax.

---

## Task 2: Add gateway service to docker-compose.dev.yml

**File:** `docker-compose.dev.yml` (MODIFY)

**What:**

- Add `gateway` service using `nginx:1.27-alpine`
- Mount `config/nginx/dev.conf` as nginx config
- Depend on translator (healthy) + webhook-logger (healthy)
- Expose port 80 → host port `${GATEWAY_PORT:-8080}`
- Join `chatwork-net` network
- Add healthcheck via curl to gateway

**Service definition:**

```yaml
gateway:
  image: nginx:1.27-alpine
  volumes:
    - ./config/nginx/dev.conf:/etc/nginx/conf.d/default.conf:ro
  ports:
    - '${GATEWAY_PORT:-8080}:80'
  networks: [chatwork-net]
  depends_on:
    translator:
      condition: service_healthy
    webhook-logger:
      condition: service_healthy
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:80/health']
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
```

**Verification:** `docker compose -f docker-compose.dev.yml config` validates.

---

## Task 3: Retarget zrok to gateway

**File:** `docker-compose.dev.yml` (MODIFY)

**What:**

- Change zrok `reserve_output` target from `http://webhook-logger:3001` to
  `http://gateway:80`
- Change zrok `depends_on` from `webhook-logger` to `gateway`
- Update banner message from "WEBHOOK URL" to "PUBLIC URL" since the URL
  now serves everything (dashboard + API + webhook)

**Changes:**

1. Line ~195: `zrok reserve public http://webhook-logger:3001` → `zrok reserve public http://gateway:80`
2. Line ~287-289: `depends_on.webhook-logger` → `depends_on.gateway`
3. Banner: Add hint that the URL serves dashboard, API, and webhook

**Verification:** zrok creates share pointing to gateway.

---

## Task 4: Build dashboard in dev.sh

**File:** `scripts/dev.sh` (MODIFY)

**What:**

- Before starting Docker Compose, run `bun run build:dashboard`
- Skip build if `packages/dashboard/dist/index.html` exists and is newer than
  source files (optional optimization — can be a simple existence check for v1)
- Print a message about what's happening

**Changes:**

- Insert after `check_duplicate_env_keys` and before `start_docker_only`/`start_proxy_and_docker`:

```sh
build_dashboard() {
  if [ -f packages/dashboard/dist/index.html ]; then
    echo "[dev] dashboard already built (packages/dashboard/dist/index.html exists)"
    echo "[dev] to rebuild: bun run build:dashboard"
  else
    echo "[dev] building dashboard..."
    bun run build:dashboard || {
      echo "[dev] ERROR: dashboard build failed" >&2
      exit 1
    }
    echo "[dev] dashboard built successfully"
  fi
}
```

- Call `build_dashboard` before the Docker Compose `up` action.

**Verification:** `bun run dev` builds dashboard if not already built, then starts Docker.

---

## Task 5: Fix webhook URL generation with X-Forwarded-\* headers

**File:** `packages/translator/src/routes/rooms.ts` (MODIFY)

**What:**

- When generating webhook URL, check `X-Forwarded-Host` and `X-Forwarded-Proto`
  headers (set by nginx gateway) to reconstruct the public origin
- Fall back to `request.url` origin when headers are absent (direct access)

**Logic:**

```typescript
function resolvePublicOrigin(request: Request): string {
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return `${fwdProto}://${fwdHost}`
  return new URL(request.url).origin
}

const webhookUrl = `${resolvePublicOrigin(request)}/webhook`
```

**Verification:**

- Unit test: with `X-Forwarded-Host: bot.share.zrok.io`, webhook URL is
  `https://bot.share.zrok.io/webhook`
- Unit test: without forwarded headers, falls back to request origin

---

## Task 6: Update .env.example with GATEWAY_PORT

**File:** `.env.example` (MODIFY)

**What:**

- Add `GATEWAY_PORT` with default 8080 in the dev stack section
- Document that gateway is the single entry point for local dev

---

## Task 7: Update documentation

**Files:**

- `docs/operations/zrok.md` (MODIFY) — Update to reflect that zrok now tunnels through
  gateway, URL serves dashboard + API + webhook
- `docs/manual-e2e-test.md` (MODIFY) — Update to reflect single `bun run dev` workflow

---

## Task 8: Fix dashboard webhook URL display (bonus)

**File:** `packages/dashboard/src/pages/room-detail.tsx` (MODIFY)

**What:**

- Current: `${base}/api/webhook?room_id=${roomId}` (wrong path, wrong format)
- Should use the `webhookUrl` returned from the API when creating the room, or
  construct `${base}/webhook` (matching the actual route)

**Note:** This is a pre-existing bug unrelated to the gateway, but it directly affects
the E2E user experience. Fix it while we're here.

---

## Risks & Mitigations

| Risk                              | Mitigation                                                 |
| --------------------------------- | ---------------------------------------------------------- |
| nginx adds latency                | Alpine nginx is lightweight; latency is <1ms intra-Docker  |
| Dashboard build adds startup time | Build only if dist doesn't exist; ~5s for fresh build      |
| zrok reserve token invalidation   | Same token mechanism; only target URL changes              |
| Breaking existing dev workflow    | Gateway is additive; translator/logger still on same ports |

## Acceptance Criteria

- [ ] `bun run dev` (single command) starts full stack with dashboard
- [ ] `localhost:8080/` shows dashboard UI
- [ ] `localhost:8080/api/rooms` returns room list
- [ ] zrok public URL serves dashboard + API + webhook
- [ ] Creating a room returns webhook URL with public domain (not localhost)
- [ ] Chatwork can POST to `<zrok-url>/webhook` successfully
- [ ] `bun test && bun run typecheck && bun run lint` all pass
- [ ] Docker production build unaffected

## File Change Summary

| File                                           | Action | Description                        |
| ---------------------------------------------- | ------ | ---------------------------------- |
| `config/nginx/dev.conf`                        | CREATE | nginx reverse proxy config         |
| `docker-compose.dev.yml`                       | MODIFY | Add gateway service, retarget zrok |
| `scripts/dev.sh`                               | MODIFY | Add dashboard build step           |
| `packages/translator/src/routes/rooms.ts`      | MODIFY | X-Forwarded-\* webhook URL         |
| `.env.example`                                 | MODIFY | Add GATEWAY_PORT                   |
| `docs/operations/zrok.md`                      | MODIFY | Update tunnel documentation        |
| `docs/manual-e2e-test.md`                      | MODIFY | Update E2E workflow                |
| `packages/dashboard/src/pages/room-detail.tsx` | MODIFY | Fix webhook URL display            |
