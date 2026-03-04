# Design: ElysiaJS Refactor — Idiomatic Elysia (Approach B)

**Date:** 2026-03-04
**Status:** Approved
**Scope:** packages/core, packages/webhook-logger, packages/translator

---

## Summary

Refactor the Bun monorepo's HTTP layer from raw `Bun.serve()` to ElysiaJS, using idiomatic Elysia patterns throughout. `packages/core` migrates from TypeScript interfaces to `@sinclair/typebox` schemas for runtime validation. Both HTTP services adopt Elysia's lifecycle hooks, typed errors, and Swagger UI (dev-only).

---

## Motivation

- **DX / Ergonomics**: Elysia's routing DSL is more expressive than manual `if/switch` routing.
- **Type safety**: `t.*` schemas validate at both compile-time and runtime from a single source of truth.
- **Ecosystem**: Plugin system, OpenAPI auto-generation, future Eden compatibility.
- **SOLID alignment**: Existing separation of concerns is preserved (core = domain logic, services = HTTP transport).

---

## Architecture Overview

```
BEFORE:
  packages/core          → TypeScript interfaces (zero deps)
  packages/translator    → Bun.serve() native, manual routing
  packages/webhook-logger → Bun.serve() native, manual routing

AFTER:
  packages/core          → @sinclair/typebox schemas (runtime validation, no HTTP dep)
  packages/translator    → Elysia app (typed errors, t.Object validation, Swagger dev)
  packages/webhook-logger → Elysia app (typed errors, t.Object validation, Swagger dev)
```

### Microservice Isolation Model

```
COMPILE TIME (code sharing via monorepo):
  packages/core TypeScript source
        ↓ bun build          ↓ bun build
  webhook-logger bundle    translator bundle
  (core code bundled IN)   (core code bundled IN)

RUNTIME (complete process isolation):
  ┌──────────────────────────┐   HTTP POST   ┌────────────────────────┐
  │ webhook-logger (port 3000)│ ────────────→ │ translator (port 3001) │
  │ Elysia instance (own)    │               │ Elysia instance (own)  │
  │ Docker container 1       │               │ Docker container 2     │
  └──────────────────────────┘               └────────────────────────┘
```

- Services communicate **only via HTTP** (fire-and-forget pattern preserved)
- No shared memory, no shared runtime state
- `packages/core` provides shared TypeScript/TypeBox schemas at build time only

---

## packages/core Changes

### New Dependency

```json
{
  "dependencies": {
    "@sinclair/typebox": "latest"
  }
}
```

> **Note:** `@sinclair/typebox` is the standalone schema library. Elysia's `t.*` re-exports TypeBox internally. Core does NOT depend on `elysia`.

### TypeScript Interfaces → TypeBox Schemas

**Before:**

```typescript
export interface ChatworkWebhookEvent {
  webhook_setting_id: string
  webhook_event_type: string
  webhook_event_time: number
  webhook_event: ChatworkMessageEvent | ChatworkMentionEvent
}
```

**After:**

```typescript
import { Type as t, type Static } from '@sinclair/typebox'

export const ChatworkWebhookEventSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.Union([
    t.Literal('message_created'),
    t.Literal('mention_to_me'),
    t.Literal('message_updated'),
  ]),
  webhook_event_time: t.Number(),
  webhook_event: t.Union([ChatworkMessageEventSchema, ChatworkMentionEventSchema]),
})

export type ChatworkWebhookEvent = Static<typeof ChatworkWebhookEventSchema>
```

**Benefits:**

- Runtime validation available via `Value.Check(ChatworkWebhookEventSchema, data)`
- OpenAPI-compatible schema exported from core
- Eliminates dangerous `as ChatworkWebhookEvent` type assertions

### Files to Migrate

| File                | Change                                    |
| ------------------- | ----------------------------------------- |
| `types/chatwork.ts` | Convert all interfaces to TypeBox schemas |
| `types/command.ts`  | Convert to TypeBox schemas                |
| `index.ts`          | Export schemas + Static types             |
| All other files     | No change (logic unchanged)               |

---

## packages/webhook-logger Changes

### New Dependencies

```json
{
  "dependencies": {
    "elysia": "latest",
    "@elysiajs/swagger": "latest"
  }
}
```

### File Structure

```
packages/webhook-logger/src/
  index.ts             → createApp().listen(env.LOGGER_PORT)
  app.ts               → createApp(): Elysia instance (replaces server.ts)
  env.ts               → Zod validation (unchanged)
  routes/
    health.ts          → Elysia plugin: GET /health
    webhook.ts         → Elysia plugin: POST /webhook
```

### app.ts Pattern

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { webhookRoutes } from './routes/webhook'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'webhook-logger' })

  if (env.NODE_ENV === 'development') {
    app.use(swagger({ path: '/docs' }))
  }

  return app
    .use(healthRoutes)
    .use(webhookRoutes)
    .onError(({ code, error }) => {
      console.error(`[app] Error [${code}]:`, error)
    })
}
```

### routes/webhook.ts Pattern

```typescript
import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '../env'

export const webhookRoutes = new Elysia({ name: 'webhook-routes' }).post(
  '/webhook',
  ({ body }) => {
    // Elysia validates body against schema automatically
    // body is fully typed as ChatworkWebhookEvent
    void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: body }),
    }).catch((err: unknown) => {
      console.error('[webhook] Failed to forward to translator:', err)
    })
    return 'OK'
  },
  { body: ChatworkWebhookEventSchema },
)
```

> **Note:** HMAC signature verification is intentionally removed (research project). Any actor knowing the URL can send events. Acceptable for local development.

### routes/health.ts Pattern

```typescript
import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'health-routes' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
```

### index.ts Pattern

```typescript
import { createApp } from './app'
import { env } from './env'

const app = createApp()
app.listen(env.LOGGER_PORT)

console.log(`[webhook-logger] Listening on port ${env.LOGGER_PORT}`)
```

---

## packages/translator Changes

### New Dependencies

```json
{
  "dependencies": {
    "elysia": "latest",
    "@elysiajs/swagger": "latest"
  }
}
```

### File Structure

```
packages/translator/src/
  index.ts              → createApp().listen(env.PORT)
  app.ts                → createApp(): Elysia instance (replaces server.ts)
  env.ts                → Zod validation (unchanged)
  webhook/
    router.ts           → Elysia plugin: POST /internal/translate
    handler.ts          → Refactored: throw error() replaces return Response
  utils/
    output-writer.ts    → (unchanged)
```

### app.ts Pattern

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { translateRoutes } from './webhook/router'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'translator' })

  if (env.NODE_ENV === 'development') {
    app.use(swagger({ path: '/docs' }))
  }

  return app
    .use(healthRoutes)
    .use(translateRoutes)
    .onError(({ code, error }) => {
      console.error(`[app] Error [${code}]:`, error)
    })
}
```

### webhook/router.ts Pattern

```typescript
import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export const translateRoutes = new Elysia({ name: 'translate-routes' }).post(
  '/internal/translate',
  ({ body }) => {
    // body.event is fully typed + validated by Elysia
    void handleTranslateRequest(body.event).catch((err: unknown) => {
      console.error('[router] Background handler error:', err)
    })
    return 'OK'
  },
  {
    body: t.Object({
      event: ChatworkWebhookEventSchema,
    }),
  },
)
```

### handler.ts Changes

Handlers use `throw error(statusCode, message)` instead of `return new Response(...)`. Error propagates to `onError` hook.

---

## Error Handling Strategy

Elysia handles errors centrally via `onError`. Services do NOT manually construct error `Response` objects.

| Scenario      | Before                                                | After                                        |
| ------------- | ----------------------------------------------------- | -------------------------------------------- |
| Invalid body  | `return new Response('Bad Request', { status: 400 })` | Elysia 422 automatically (schema validation) |
| Not found     | Manual 404 in router                                  | Elysia default 404                           |
| Handler error | `try/catch + return Response`                         | `throw error(500, ...)` + `onError` hook     |
| Unknown error | `error(error)` in Bun.serve                           | `onError` hook                               |

---

## Testing Strategy

### Unit Tests (unchanged pattern)

Handler functions, core utilities, and services continue to be tested as pure functions.

```
packages/core/src/**/*.test.ts        → pure function tests (unchanged)
packages/translator/src/webhook/handler.test.ts → handler logic (unchanged)
```

### Integration Tests (new — Elysia app.handle)

```typescript
// packages/webhook-logger/src/app.test.ts
import { describe, it, expect } from 'bun:test'
import { createApp } from './app'

describe('webhook-logger app', () => {
  const app = createApp()

  it('GET /health returns ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('POST /webhook with invalid body returns 422', async () => {
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      }),
    )
    expect(res.status).toBe(422)
  })

  it('POST /webhook with valid body returns 200', async () => {
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_setting_id: '12345',
          webhook_event_type: 'message_created',
          webhook_event_time: 1498028130,
          webhook_event: {
            /* valid event */
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
  })
})
```

---

## OpenAPI / Swagger

Swagger UI is served at `/docs` **only when `NODE_ENV=development`**.

```
Development:  GET /docs → Swagger UI (auto-generated from TypeBox schemas)
Production:   GET /docs → 404 (plugin not loaded)
```

---

## Migration Order

1. **Phase 1**: `packages/core` — migrate TypeScript interfaces to TypeBox schemas
2. **Phase 2**: `packages/webhook-logger` — Elysia refactor (pilot service, simpler)
3. **Phase 3**: `packages/translator` — Elysia refactor (apply patterns from Phase 2)

Each phase is independently testable before proceeding.

---

## What Elysia Handles Automatically (NOT custom implemented)

| Concern                   | Elysia handles                        |
| ------------------------- | ------------------------------------- |
| Request body parsing      | `body: t.Object(...)` schema          |
| Body validation errors    | 422 Unprocessable Entity              |
| Route not found           | 404 Not Found                         |
| JSON serialization        | Return plain objects                  |
| Content-Type headers      | Inferred from return type             |
| TypeScript type inference | From `t.*` schemas                    |
| OpenAPI documentation     | From `t.*` schemas via swagger plugin |

---

## What Stays Custom

| Concern                 | Where                                                     |
| ----------------------- | --------------------------------------------------------- |
| Env validation          | Zod in each service's `env.ts`                            |
| Business logic          | `packages/core` (ITranslationService, parseCommand, etc.) |
| HMAC verification       | Removed (intentional, research project)                   |
| Fire-and-forget pattern | Preserved in handlers                                     |
| Chatwork API client     | `packages/core/chatwork/client.ts` (unchanged)            |

---

## Deployment (unchanged)

- Docker setup: `oven/bun:1.1-distroless` (no changes required)
- `bun build` bundles Elysia + TypeBox into each service's `dist/server.js`
- `docker-compose.yml` ports and healthchecks unchanged

---

## Verification Commands

```bash
bun test                    # Run all tests (unit + integration)
bun run typecheck           # TypeScript strict mode checks
bun run lint                # ESLint
bun run build               # Verify bundle compiles
docker compose up --build   # End-to-end smoke test
```

---

## Risks and Mitigations

| Risk                                                                | Likelihood | Mitigation                                                |
| ------------------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| TypeBox migration breaks existing type consumers                    | Medium     | Migrate core first, run typecheck before service changes  |
| Elysia version instability                                          | Low        | Pin exact version, verify changelog before upgrading      |
| body: t.Object() validation too strict for actual Chatwork payloads | Medium     | Test with real Chatwork webhook payloads early in Phase 2 |
| Bundle size increase (~200-300KB added)                             | Low        | Acceptable for this project size                          |
