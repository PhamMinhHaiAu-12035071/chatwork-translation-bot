# ElysiaJS Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Bun monorepo's HTTP layer from raw `Bun.serve()` to idiomatic ElysiaJS, with TypeBox schemas in `packages/core` for runtime validation.

**Architecture:** Three-phase migration: (1) `packages/core` gains `@sinclair/typebox` schemas for runtime validation; (2) `packages/webhook-logger` becomes an Elysia app (pilot); (3) `packages/translator` becomes an Elysia app applying the same patterns. HMAC signature verification is intentionally removed. Services communicate via HTTP only (fire-and-forget preserved).

**Tech Stack:** Bun 1.1+, TypeScript strict, ElysiaJS (elysia), @elysiajs/swagger, @sinclair/typebox, Zod (env only), Bun test runner.

---

## Reference: Design Document

See [2026-03-04-elysia-refactor-design.md](./2026-03-04-elysia-refactor-design.md) for full architecture decisions.

---

## Verification Commands (run after each phase)

```bash
bun test                   # All tests pass
bun run typecheck          # No TypeScript errors
bun run lint               # No lint errors
```

---

## Phase 1: packages/core — TypeBox Schema Migration

> Goal: Convert TypeScript interfaces → TypeBox schemas so both compile-time types AND runtime validation are possible from a single source.

---

### Task 1.1: Install @sinclair/typebox in packages/core

**Files:**

- Modify: `packages/core/package.json`

**Step 1: Install the dependency**

```bash
cd packages/core
bun add @sinclair/typebox
```

Expected output: `@sinclair/typebox` added to `packages/core/package.json` dependencies.

**Step 2: Verify install**

```bash
bun run typecheck
```

Expected: PASS (no changes to source yet).

**Step 3: Commit**

```bash
git add packages/core/package.json bun.lockb
git commit -m "chore(core): add @sinclair/typebox dependency"
```

---

### Task 1.2: Migrate chatwork types to TypeBox schemas

**Files:**

- Modify: `packages/core/src/types/chatwork.ts`

**Step 1: Write the failing test**

Create `packages/core/src/types/chatwork.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { ChatworkWebhookEventSchema, type ChatworkWebhookEvent } from './chatwork'

describe('ChatworkWebhookEventSchema', () => {
  const validEvent: ChatworkWebhookEvent = {
    webhook_setting_id: '12345',
    webhook_event_type: 'message_created',
    webhook_event_time: 1498028130,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 123456,
      body: 'Hello World',
      send_time: 1498028125,
      update_time: 0,
    },
  }

  it('validates a correct webhook event', () => {
    expect(Value.Check(ChatworkWebhookEventSchema, validEvent)).toBe(true)
  })

  it('rejects event missing webhook_setting_id', () => {
    const invalid = { ...validEvent, webhook_setting_id: undefined }
    expect(Value.Check(ChatworkWebhookEventSchema, invalid)).toBe(false)
  })

  it('rejects event with wrong type for webhook_event_time', () => {
    const invalid = { ...validEvent, webhook_event_time: 'not-a-number' }
    expect(Value.Check(ChatworkWebhookEventSchema, invalid)).toBe(false)
  })

  it('exports ChatworkWebhookEvent as TypeScript type (compile-time check)', () => {
    // This test exists to verify type exports compile correctly
    const event: ChatworkWebhookEvent = validEvent
    expect(typeof event.webhook_setting_id).toBe('string')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/core/src/types/chatwork.test.ts
```

Expected: FAIL — `ChatworkWebhookEventSchema` not found.

**Step 3: Rewrite `packages/core/src/types/chatwork.ts`**

Replace the entire file with:

```typescript
import { Type as t, type Static } from '@sinclair/typebox'

// ─── Webhook Event Schemas ────────────────────────────────────────────────────

/**
 * The inner webhook_event object from Chatwork.
 * Uses additionalProperties: true because different event types include different fields.
 */
export const ChatworkWebhookEventInnerSchema = t.Object(
  {
    message_id: t.Optional(t.String()),
    room_id: t.Optional(t.Number()),
    account_id: t.Optional(t.Number()),
    body: t.Optional(t.String()),
    send_time: t.Optional(t.Number()),
    update_time: t.Optional(t.Number()),
    from_account_id: t.Optional(t.Number()),
    to_account_id: t.Optional(t.Number()),
  },
  { additionalProperties: true },
)

export const ChatworkWebhookEventSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.String(),
  webhook_event_time: t.Number(),
  webhook_event: ChatworkWebhookEventInnerSchema,
})

export type ChatworkWebhookEvent = Static<typeof ChatworkWebhookEventSchema>

// ─── Specific Event: message_created ─────────────────────────────────────────

export const ChatworkMessageEventInnerSchema = t.Object({
  message_id: t.String(),
  room_id: t.Number(),
  account_id: t.Number(),
  body: t.String(),
  send_time: t.Number(),
  update_time: t.Number(),
})

export const ChatworkMessageEventSchema = t.Object({
  webhook_setting_id: t.String(),
  webhook_event_type: t.Literal('message_created'),
  webhook_event_time: t.Number(),
  webhook_event: ChatworkMessageEventInnerSchema,
})

export type ChatworkMessageEvent = Static<typeof ChatworkMessageEventSchema>

// ─── Type Guard ───────────────────────────────────────────────────────────────

export function isChatworkMessageEvent(event: ChatworkWebhookEvent): event is ChatworkMessageEvent {
  return (
    event.webhook_event_type === 'message_created' &&
    typeof event.webhook_event.room_id === 'number' &&
    typeof event.webhook_event.account_id === 'number' &&
    typeof event.webhook_event.body === 'string'
  )
}

// ─── Other API Types (kept as TypeScript interfaces — no runtime validation needed) ──

export interface ChatworkAccount {
  account_id: number
  name: string
  avatar_image_url: string
}

export interface ChatworkRoom {
  room_id: number
}

export interface ChatworkRoomDetail {
  room_id: number
  name: string
  type: string
  icon_path: string
  member_count?: number
}

export interface ChatworkSendMessageResponse {
  message_id: string
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test packages/core/src/types/chatwork.test.ts
```

Expected: PASS — all 4 tests pass.

**Step 5: Run full test suite to verify no regressions**

```bash
bun test
bun run typecheck
```

Expected: PASS — existing tests still pass, TypeScript has no errors.

**Step 6: Commit**

```bash
git add packages/core/src/types/chatwork.ts packages/core/src/types/chatwork.test.ts
git commit -m "feat(core): migrate ChatworkWebhookEvent to TypeBox schemas"
```

---

### Task 1.3: Update packages/core index.ts to export schemas

**Files:**

- Modify: `packages/core/src/index.ts`

**Step 1: Add schema exports**

In `packages/core/src/index.ts`, add these exports alongside the existing type exports:

```typescript
// Types
export type {
  ChatworkWebhookEvent,
  ChatworkMessageEvent,
  ChatworkAccount,
  ChatworkRoom,
  ChatworkRoomDetail,
  ChatworkSendMessageResponse,
} from './types/chatwork'
export {
  isChatworkMessageEvent,
  // Schemas (for use in Elysia routes and runtime validation)
  ChatworkWebhookEventSchema,
  ChatworkWebhookEventInnerSchema,
  ChatworkMessageEventSchema,
  ChatworkMessageEventInnerSchema,
} from './types/chatwork'

// ... rest of exports unchanged
```

**Step 2: Verify exports compile**

```bash
bun run typecheck
bun test
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export TypeBox schemas from index"
```

---

## Phase 2: packages/webhook-logger — Elysia Refactor (Pilot)

> Goal: Replace Bun.serve() with Elysia. Remove HMAC verification. Use Elysia's body schema validation.

---

### Task 2.1: Install Elysia dependencies in webhook-logger

**Files:**

- Modify: `packages/webhook-logger/package.json`

**Step 1: Install dependencies**

```bash
cd packages/webhook-logger
bun add elysia @elysiajs/swagger
```

**Step 2: Verify install**

```bash
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/webhook-logger/package.json bun.lockb
git commit -m "chore(webhook-logger): add elysia and swagger dependencies"
```

---

### Task 2.2: Create health route plugin

**Files:**

- Create: `packages/webhook-logger/src/routes/health.ts`

**Step 1: Write failing test**

Create `packages/webhook-logger/src/routes/health.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { healthRoutes } from './health'
import Elysia from 'elysia'

describe('healthRoutes', () => {
  const app = new Elysia().use(healthRoutes)

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = await res.json<{ status: string; timestamp: string }>()
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/webhook-logger/src/routes/health.test.ts
```

Expected: FAIL — `healthRoutes` not found.

**Step 3: Create `packages/webhook-logger/src/routes/health.ts`**

```typescript
import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'webhook-logger:health' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/webhook-logger/src/routes/health.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/routes/health.ts packages/webhook-logger/src/routes/health.test.ts
git commit -m "feat(webhook-logger): add Elysia health route plugin"
```

---

### Task 2.3: Rewrite webhook route as Elysia plugin

**Files:**

- Replace: `packages/webhook-logger/src/routes/webhook.ts`
- Replace: `packages/webhook-logger/src/routes/webhook.test.ts`

> **Important:** The existing `webhook.test.ts` tests HMAC verification which we're removing. The new tests test Elysia body validation instead.

**Step 1: Write failing integration test**

Replace `packages/webhook-logger/src/routes/webhook.test.ts` with:

```typescript
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'

// Mock env before importing route
void mock.module('../env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}))

// Mock fetch to avoid real HTTP calls to translator
const mockFetch = mock(() => Promise.resolve(new Response('OK', { status: 200 })))
global.fetch = mockFetch

describe('webhookRoutes', () => {
  let app: Elysia

  beforeAll(async () => {
    const { webhookRoutes } = await import('./webhook')
    app = new Elysia().use(webhookRoutes)
  })

  const validEvent = {
    webhook_setting_id: '12345',
    webhook_event_type: 'message_created',
    webhook_event_time: 1498028130,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 123456,
      body: 'Hello World',
      send_time: 1498028125,
      update_time: 0,
    },
  }

  it('POST /webhook with valid body returns 200', async () => {
    mockFetch.mockClear()
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )
    expect(res.status).toBe(200)
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

  it('POST /webhook forwards event to translator (fire-and-forget)', async () => {
    mockFetch.mockClear()
    await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )
    // Give fire-and-forget time to complete
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mockFetch.mock.calls.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/webhook-logger/src/routes/webhook.test.ts
```

Expected: FAIL — `webhookRoutes` not found or wrong shape.

**Step 3: Rewrite `packages/webhook-logger/src/routes/webhook.ts`**

```typescript
import { Elysia } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '../env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' }).post(
  '/webhook',
  ({ body }) => {
    // body is typed as ChatworkWebhookEvent — validated by Elysia automatically
    void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: body }),
    }).catch((err: unknown) => {
      console.error('[webhook] Failed to forward to translator:', err)
    })

    return 'OK'
  },
  {
    body: ChatworkWebhookEventSchema,
  },
)
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/webhook-logger/src/routes/webhook.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.ts packages/webhook-logger/src/routes/webhook.test.ts
git commit -m "feat(webhook-logger): rewrite webhook route as Elysia plugin, remove HMAC verification"
```

---

### Task 2.4: Update env.ts — remove CHATWORK_WEBHOOK_SECRET

**Files:**

- Modify: `packages/webhook-logger/src/env.ts`

> HMAC verification is removed, so CHATWORK_WEBHOOK_SECRET is no longer needed in webhook-logger.

**Step 1: Update `packages/webhook-logger/src/env.ts`**

Replace entire file with:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z
    .string()
    .url('TRANSLATOR_URL must be a valid URL')
    .default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
```

**Step 2: Run typecheck to verify no broken references**

```bash
bun run typecheck
bun test
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/webhook-logger/src/env.ts
git commit -m "refactor(webhook-logger): remove CHATWORK_WEBHOOK_SECRET from env (HMAC removed)"
```

---

### Task 2.5: Create Elysia app factory (createApp)

**Files:**

- Create: `packages/webhook-logger/src/app.ts`

**Step 1: Write failing integration test**

Create `packages/webhook-logger/src/app.test.ts`:

```typescript
import { describe, expect, it, mock } from 'bun:test'

void mock.module('./env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}))

global.fetch = mock(() => Promise.resolve(new Response('OK')))

describe('createApp', () => {
  it('GET /health returns 200', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
  })

  it('POST /webhook with valid body returns 200', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_setting_id: '12345',
          webhook_event_type: 'message_created',
          webhook_event_time: 1498028130,
          webhook_event: {
            message_id: '789012345',
            room_id: 567890123,
            account_id: 123456,
            body: 'Hello World',
            send_time: 1498028125,
            update_time: 0,
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
  })

  it('unknown route returns 404', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const res = await app.handle(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/webhook-logger/src/app.test.ts
```

Expected: FAIL — `createApp` not found.

**Step 3: Create `packages/webhook-logger/src/app.ts`**

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { webhookRoutes } from './routes/webhook'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'webhook-logger' })

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Webhook Logger API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(webhookRoutes)
    .onError(({ code, error }) => {
      console.error(`[app] Error [${code}]:`, error instanceof Error ? error.message : error)
    })
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test packages/webhook-logger/src/app.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/app.ts packages/webhook-logger/src/app.test.ts
git commit -m "feat(webhook-logger): create Elysia app factory with health + webhook routes"
```

---

### Task 2.6: Replace server.ts and update index.ts

**Files:**

- Replace: `packages/webhook-logger/src/server.ts`
- Modify: `packages/webhook-logger/src/index.ts`

**Step 1: Replace `packages/webhook-logger/src/server.ts`**

> Old server.ts wraps Bun.serve(). New one just delegates to createApp.

```typescript
import { createApp } from './app'

export function createServer() {
  return createApp()
}
```

> **Note:** This keeps the `createServer` name for backward compatibility with index.ts, but now returns an Elysia instance instead of a Bun server.

**Step 2: Update `packages/webhook-logger/src/index.ts`**

```typescript
import { env } from './env'
import { createServer } from './server'

const server = createServer()

server.listen(env.LOGGER_PORT)

console.log(`[webhook-logger] Listening on http://0.0.0.0:${env.LOGGER_PORT.toString()}`)
console.log(`[webhook-logger] Health check: http://localhost:${env.LOGGER_PORT.toString()}/health`)
console.log(
  `[webhook-logger] Webhook endpoint: http://localhost:${env.LOGGER_PORT.toString()}/webhook`,
)
if (env.NODE_ENV === 'development') {
  console.log(`[webhook-logger] Swagger UI: http://localhost:${env.LOGGER_PORT.toString()}/docs`)
}
console.log('[webhook-logger] Waiting for Chatwork webhook events...\n')

function shutdown() {
  console.log('\n[webhook-logger] Shutting down...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Step 3: Run full verification**

```bash
bun test
bun run typecheck
bun run lint
```

Expected: All PASS.

**Step 4: Commit**

```bash
git add packages/webhook-logger/src/server.ts packages/webhook-logger/src/index.ts
git commit -m "refactor(webhook-logger): replace Bun.serve() with Elysia app in server + index"
```

---

## Phase 3: packages/translator — Elysia Refactor

> Goal: Apply the same Elysia patterns from Phase 2 to the translator service.

---

### Task 3.1: Install Elysia dependencies in translator

**Files:**

- Modify: `packages/translator/package.json`

**Step 1: Install dependencies**

```bash
cd packages/translator
bun add elysia @elysiajs/swagger
```

**Step 2: Verify**

```bash
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/translator/package.json bun.lockb
git commit -m "chore(translator): add elysia and swagger dependencies"
```

---

### Task 3.2: Create health route for translator

**Files:**

- Create: `packages/translator/src/routes/health.ts`
- Create: `packages/translator/src/routes/health.test.ts`

**Step 1: Write failing test**

```typescript
// packages/translator/src/routes/health.test.ts
import { describe, expect, it } from 'bun:test'
import Elysia from 'elysia'
import { healthRoutes } from './health'

describe('healthRoutes', () => {
  const app = new Elysia().use(healthRoutes)

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = await res.json<{ status: string; timestamp: string }>()
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/translator/src/routes/health.test.ts
```

Expected: FAIL — module not found.

**Step 3: Create `packages/translator/src/routes/health.ts`**

```typescript
import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'translator:health' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
```

**Step 4: Run test to verify it passes**

```bash
bun test packages/translator/src/routes/health.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/routes/health.ts packages/translator/src/routes/health.test.ts
git commit -m "feat(translator): add Elysia health route plugin"
```

---

### Task 3.3: Rewrite webhook/router.ts as Elysia plugin

**Files:**

- Replace: `packages/translator/src/webhook/router.ts`

**Step 1: Write failing test**

Create `packages/translator/src/webhook/router.test.ts`:

```typescript
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'

void mock.module('../env', () => ({
  env: {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}))

const mockHandleTranslateRequest = mock(() => Promise.resolve())
void mock.module('./handler', () => ({
  handleTranslateRequest: mockHandleTranslateRequest,
}))

describe('translateRoutes', () => {
  let app: Elysia

  beforeAll(async () => {
    const { translateRoutes } = await import('./router')
    app = new Elysia().use(translateRoutes)
  })

  const validPayload = {
    event: {
      webhook_setting_id: '12345',
      webhook_event_type: 'message_created',
      webhook_event_time: 1498028130,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 123456,
        body: 'Hello World',
        send_time: 1498028125,
        update_time: 0,
      },
    },
  }

  it('POST /internal/translate with valid payload returns 200', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    expect(res.status).toBe(200)
  })

  it('POST /internal/translate with missing event returns 422', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      }),
    )
    expect(res.status).toBe(422)
  })

  it('POST /internal/translate calls handleTranslateRequest (fire-and-forget)', async () => {
    mockHandleTranslateRequest.mockClear()
    await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mockHandleTranslateRequest.mock.calls.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/translator/src/webhook/router.test.ts
```

Expected: FAIL.

**Step 3: Rewrite `packages/translator/src/webhook/router.ts`**

```typescript
import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  ({ body }) => {
    // body.event is typed as ChatworkWebhookEvent — validated by Elysia automatically
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

**Step 4: Run test to verify it passes**

```bash
bun test packages/translator/src/webhook/router.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/webhook/router.ts packages/translator/src/webhook/router.test.ts
git commit -m "feat(translator): rewrite router as Elysia plugin with TypeBox body validation"
```

---

### Task 3.4: Update translator env.ts — remove CHATWORK_WEBHOOK_SECRET

**Files:**

- Modify: `packages/translator/src/env.ts`

> Translator never verified webhook signatures. Remove the CHATWORK_WEBHOOK_SECRET field to reflect reality.

**Step 1: Update `packages/translator/src/env.ts`**

```typescript
import { z } from 'zod'

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AI_PROVIDER: z.enum(['gemini', 'openai']),
    AI_MODEL: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER === 'gemini' && !data.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini',
        path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      })
    }
    if (data.AI_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
        path: ['OPENAI_API_KEY'],
      })
    }
  })

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
```

**Step 2: Run full verification**

```bash
bun test
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/translator/src/env.ts
git commit -m "refactor(translator): remove unused CHATWORK_WEBHOOK_SECRET from env"
```

---

### Task 3.5: Create Elysia app factory for translator

**Files:**

- Create: `packages/translator/src/app.ts`
- Create: `packages/translator/src/app.test.ts`

**Step 1: Write failing integration test**

```typescript
// packages/translator/src/app.test.ts
import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type Elysia from 'elysia'

void mock.module('./env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'test-token',
    PORT: 3000,
    NODE_ENV: 'test',
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o',
  },
}))

void mock.module('./webhook/handler', () => ({
  handleTranslateRequest: mock(() => Promise.resolve()),
}))

describe('createApp (translator)', () => {
  let app: Elysia

  beforeAll(async () => {
    const { createApp } = await import('./app')
    app = createApp()
  })

  it('GET /health returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
  })

  it('POST /internal/translate with valid payload returns 200', async () => {
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            webhook_setting_id: '12345',
            webhook_event_type: 'message_created',
            webhook_event_time: 1498028130,
            webhook_event: {
              message_id: '789012345',
              room_id: 567890123,
              account_id: 123456,
              body: 'Hello World',
              send_time: 1498028125,
              update_time: 0,
            },
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
  })

  it('unknown route returns 404', async () => {
    const res = await app.handle(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test packages/translator/src/app.test.ts
```

Expected: FAIL — `createApp` not found.

**Step 3: Create `packages/translator/src/app.ts`**

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { translateRoutes } from './webhook/router'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'translator' })

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Translator API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(translateRoutes)
    .onError(({ code, error }) => {
      console.error(`[app] Error [${code}]:`, error instanceof Error ? error.message : error)
    })
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test packages/translator/src/app.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/app.ts packages/translator/src/app.test.ts packages/translator/src/routes/
git commit -m "feat(translator): create Elysia app factory with health + translate routes"
```

---

### Task 3.6: Replace server.ts and update index.ts for translator

**Files:**

- Replace: `packages/translator/src/server.ts`
- Modify: `packages/translator/src/index.ts`

**Step 1: Replace `packages/translator/src/server.ts`**

```typescript
import { createApp } from './app'

export function createServer() {
  return createApp()
}
```

**Step 2: Update `packages/translator/src/index.ts`**

```typescript
import { env } from './env'
import { createServer } from './server'

const server = createServer()

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
console.log(`[translator] Provider: ${env.AI_PROVIDER}`)
console.log(`[translator] Environment: ${env.NODE_ENV}`)
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(
  `[translator] Internal endpoint: http://localhost:${env.PORT.toString()}/internal/translate`,
)
if (env.NODE_ENV === 'development') {
  console.log(`[translator] Swagger UI: http://localhost:${env.PORT.toString()}/docs`)
}

function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Step 3: Run full verification**

```bash
bun test
bun run typecheck
bun run lint
```

Expected: All PASS.

**Step 4: Commit**

```bash
git add packages/translator/src/server.ts packages/translator/src/index.ts
git commit -m "refactor(translator): replace Bun.serve() with Elysia app in server + index"
```

---

## Phase 4: Final Cleanup and Verification

---

### Task 4.1: Remove dead code

**Step 1: Identify dead code from previous implementation**

The following are now unused and should be deleted:

- `packages/webhook-logger/src/routes/webhook.ts` old logic (already replaced in Task 2.3)
- `packages/translator/src/webhook/router.ts` old logic (already replaced in Task 3.3)
- `packages/core/src/webhook/verify.ts` — HMAC verification, no longer called by either service

**Step 2: Check if verify.ts is used anywhere**

```bash
grep -r "verifyWebhookSignature\|verify" packages --include="*.ts" | grep -v ".test.ts" | grep -v "node_modules"
```

Expected: No remaining usages (only in the verify.ts itself and its test).

**Step 3: Delete verify.ts and its test if unused**

```bash
rm packages/core/src/webhook/verify.ts
rm packages/core/src/webhook/verify.test.ts
```

**Step 4: Remove from core index.ts**

In `packages/core/src/index.ts`, remove the line:

```typescript
export { verifyWebhookSignature } from './webhook/verify'
```

**Step 5: Run verification**

```bash
bun test
bun run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/index.ts
git rm packages/core/src/webhook/verify.ts packages/core/src/webhook/verify.test.ts
git commit -m "refactor(core): remove verifyWebhookSignature (HMAC verification removed)"
```

---

### Task 4.2: Final full verification

**Step 1: Run complete test suite**

```bash
bun test
```

Expected: All tests PASS, no failures.

**Step 2: TypeScript check**

```bash
bun run typecheck
```

Expected: No errors.

**Step 3: Lint check**

```bash
bun run lint
```

Expected: No errors.

**Step 4: Build check**

```bash
bun run build
```

Expected: Build succeeds, `dist/server.js` generated.

**Step 5: Docker smoke test (optional)**

```bash
docker compose up --build
```

Then in another terminal:

```bash
curl http://localhost:3001/health  # webhook-logger
curl http://localhost:3000/health  # translator (if exposed)
```

Expected: Both return `{"status":"ok","timestamp":"..."}`.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete ElysiaJS refactor across all packages

- packages/core: TypeBox schemas for ChatworkWebhookEvent runtime validation
- packages/webhook-logger: Elysia app with TypeBox validation, Swagger dev
- packages/translator: Elysia app with TypeBox validation, Swagger dev
- Remove HMAC signature verification (intentional for research project)
- Remove CHATWORK_WEBHOOK_SECRET from both service envs"
```

---

## Quick Reference: Key Elysia Patterns Used

```typescript
// Route with body validation (Elysia handles 422 automatically for invalid bodies)
app.post('/route', ({ body }) => body, { body: SomeSchema })

// Health route (returns object → Elysia serializes to JSON)
app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Error handling (centralized, no manual try/catch in handlers)
app.onError(({ code, error }) => { console.error(code, error) })

// Swagger (dev only)
if (env.NODE_ENV === 'development') app.use(swagger({ path: '/docs' }))

// Start server
app.listen(port)

// Integration testing
const res = await app.handle(new Request('http://localhost/path', { method: 'POST', body: ... }))
```
