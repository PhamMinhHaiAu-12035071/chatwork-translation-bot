# Design: Migrate Localtunnel → zrok (Phase A)

**Date**: 2026-03-10
**Status**: Approved
**Scope**: Dev environment only — no application logic changes

## Context

The current dev setup uses localtunnel (`node:22-alpine` image + `scripts/run-localtunnel.sh`) to expose
`webhook-logger:3001` to the public internet so Chatwork can reach it.

Localtunnel issues:

- Unstable connections requiring custom retry loop and fallback host logic
- URL changes on every restart, requiring Chatwork webhook reconfiguration each time
- External service reliability dependency (localtunnel.me / loca.lt)

## Architecture

```
Chatwork → HTTPS (reserved zrok URL — fixed across restarts)
         → zrok cloud relay (zrok.io hosted)
         → zrok container (openziti/zrok image, Docker internal)
         → webhook-logger:3001 (Docker internal, chatwork-net)
         → [fire-and-forget fetch]
         → translator:3000 (Docker internal, chatwork-net)
```

zrok is an infrastructure layer only — no application code changes.

## Decisions

| Decision          | Choice                           | Rationale                                                              |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------- | -------------- | --------------------------------- |
| Environment       | Dev only                         | Production has no tunnel service; deploy to real server with public IP |
| zrok mode         | Hosted zrok.io                   | No self-hosting complexity; free tier sufficient                       |
| Share type        | Reserved share                   | Fixed subdomain across restarts; configure Chatwork webhook once       |
| Compose structure | Inline in docker-compose.dev.yml | Consistent with existing tunnel pattern                                |
| Restart strategy  | Docker `restart: unless-stopped` | zrok has internal reconnect; no custom retry script needed             |
| Secrets           | `.env` file                      | Consistent with existing CHATWORK_API_TOKEN, GOOGLE_API_KEY pattern    |
| Port exposure     | Keep `${LOGGER_PORT:-3001}:3001` | Dev debugging convenience; no security concern in dev                  |
| Documentation     | `docs/operations/zrok.md`        | Separate ops doc, keep README clean                                    |
| Init strategy     | Inline command with `            |                                                                        | true` fallback | KISS; no extra script file needed |

## Files Changed

### Modified

| File                     | Change                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `docker-compose.dev.yml` | Remove `tunnel` service, add `zrok` service                            |
| `.env.example`           | Remove localtunnel vars, add `ZROK_ENABLE_TOKEN`, `ZROK_UNIQUE_NAME`   |
| `ai_rules/commands.md`   | Update "localtunnel" → "zrok" in comment strings                       |
| `ai_rules/security.md`   | Add `ZROK_ENABLE_TOKEN`, `ZROK_UNIQUE_NAME` to Optional env vars table |

### Created

| File                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `docs/operations/zrok.md` | One-time setup and daily operation guide |

### Deleted

| File                         | Reason           |
| ---------------------------- | ---------------- |
| `scripts/run-localtunnel.sh` | No longer needed |

## Service Definition

```yaml
# docker-compose.dev.yml — service zrok
zrok:
  image: openziti/zrok
  restart: unless-stopped
  networks: [chatwork-net]
  environment:
    - ZROK_ENABLE_TOKEN=${ZROK_ENABLE_TOKEN}
    - ZROK_UNIQUE_NAME=${ZROK_UNIQUE_NAME}
  command:
    - sh
    - -c
    - |
      zrok enable ${ZROK_ENABLE_TOKEN} 2>/dev/null || true
      zrok share reserved ${ZROK_UNIQUE_NAME} \
        --override-endpoint http://webhook-logger:3001 \
        --headless
  depends_on:
    webhook-logger:
      condition: service_healthy
```

No healthcheck — zrok does not expose an internal HTTP endpoint.
Docker restart policy handles crash recovery.

## Environment Variables

```bash
# .env.example addition — Ingress / Tunnel (Docker dev only)
ZROK_ENABLE_TOKEN=your_zrok_enable_token_here
ZROK_UNIQUE_NAME=your-reserved-share-name
```

## One-Time Setup (outside Docker)

1. Register at zrok.io, get enable token
2. Install zrok CLI locally
3. `zrok enable <token>`
4. `zrok reserve public http://localhost:3001 --unique-name <name>`
5. Note the reserved URL → configure as Chatwork webhook URL with path `/webhook`

After this, Docker handles everything automatically on each `bun run dev`.

## What Does NOT Change

- `webhook-logger` source code (fire-and-forget pattern unchanged)
- `translator` source code
- Production `docker-compose.yml`
- All `packages/` application logic
- `ai_rules/architecture-patterns.md` (no tunnel mention)
- `ai_rules/project-structure.md` (no tunnel mention)
- `README.md` (no localtunnel mention)

## Out of Scope (Phase B — future)

- Durable ingest: upgrading webhook-logger from fire-and-forget to retry/queue
- Redis queue adapter with `IWebhookDispatchQueue` interface
- Correlation IDs and structured logging for webhook events
