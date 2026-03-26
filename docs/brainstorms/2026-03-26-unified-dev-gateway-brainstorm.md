---
date: 2026-03-26
topic: unified-dev-gateway
---

# Unified Dev Gateway — Single `bun run dev` for Full Stack

## What We're Building

A unified development experience where `bun run dev` starts **everything** — backend
services (translator, webhook-logger), the dashboard UI, and a single public zrok tunnel
that exposes the entire stack through one URL. No more running `bun run dev:dashboard`
separately.

An nginx reverse proxy ("gateway") acts as the single entry point inside Docker, routing
`/webhook` to the webhook-logger and everything else (API + dashboard static files) to
the translator.

## Problem Statement

After Phase 7 (full-workflow integration), local E2E testing requires 2 separate commands:

1. `bun run dev` — starts Docker stack (translator, webhook-logger, zrok)
2. `bun run dev:dashboard` — starts Vite dev server on port 5173

Additionally:

- zrok only exposes webhook-logger:3001, not the full app
- The dashboard API client uses relative `/api` paths via Vite proxy → localhost:3000
- Webhook URL generation returns `http://localhost:3000/webhook` (unusable by Chatwork)
- No way to access the dashboard via a public URL for external testing

## Why This Approach

### Approaches Considered

**A. Run Vite in Docker (HMR inside container)** — Complex, WebSocket tunneling issues,
and user confirmed HMR is not needed for E2E testing. Rejected.

**B. Two zrok tunnels (separate backend/frontend URLs)** — Requires CORS config, API base
URL env vars, dashboard rebuild on URL change. Over-engineered. Rejected.

**C. Single nginx gateway + pre-built dashboard (chosen)** — Simple, no code changes to
dashboard API client, webhook URL auto-correct, one zrok tunnel for everything.

### Why This Approach Wins

- Dashboard already uses relative `/api` paths → no CORS, no base URL config
- Translator already serves dashboard static files (Phase 7 `static.ts`)
- `dev.sh` builds dashboard once before Docker starts → fast, deterministic
- nginx config is ~15 lines → low maintenance burden
- One zrok URL = one public endpoint for Chatwork webhooks AND dashboard access

## Key Decisions

- **[DEC-001] No HMR**: Build dashboard once at dev startup. For UI iteration, user can
  run `bun run dev:dashboard` separately as before. Rationale: E2E testing focus, simplicity.

- **[DEC-002] Single domain via nginx**: One gateway routes `/webhook` → logger, `/*` →
  translator. Rationale: avoids CORS, webhook URL generation works automatically.

- **[DEC-003] Pre-built dashboard**: `dev.sh` runs `bun run build:dashboard` before
  `docker compose up`. Translator serves static files from bind-mounted `packages/dashboard/dist`.

- **[DEC-004] Fix webhook URL generation**: Update `rooms.ts` to respect `X-Forwarded-*`
  headers so webhook URL reflects the public zrok domain, not the internal Docker hostname.

## Architecture

```
                        ┌──────────────────────────────────────────────────┐
                        │         Docker Compose (chatwork-net)             │
                        │                                                   │
  Internet              │   ┌─────────┐    ┌────────────────┐              │
  (Chatwork) ──────────►│   │  zrok   │───►│    gateway     │              │
                        │   │         │    │   (nginx:80)   │              │
  Browser   ──────────► │   └─────────┘    └───────┬────────┘              │
  (via zrok URL)        │                    /webhook│  /*                  │
                        │                    ┌──────┴──────┐               │
                        │                    ▼             ▼               │
                        │           ┌──────────────┐ ┌─────────────┐      │
                        │           │webhook-logger│ │ translator  │      │
                        │           │    :3001     │ │   :3000     │      │
                        │           └──────────────┘ │ (API +      │      │
                        │                            │  dashboard  │      │
                        │                            │  static)    │      │
                        │                            └─────────────┘      │
                        └──────────────────────────────────────────────────┘
```

**Request routing:**

- `https://<name>.share.zrok.io/webhook` → gateway → webhook-logger:3001
- `https://<name>.share.zrok.io/api/*` → gateway → translator:3000
- `https://<name>.share.zrok.io/` → gateway → translator:3000 → dashboard index.html
- `https://<name>.share.zrok.io/assets/*` → gateway → translator:3000 → static files

## Open Questions

None — all material decisions resolved through interview.

## Next Steps

→ Proceed to implementation plan
