# Remove Webhook Signature Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire HMAC webhook signature verification mechanism — all env vars, routes, store fields, UI inputs, and tests related to `webhookSecret` / `INTERNAL_API_SECRET` / `TRANSLATOR_INTERNAL_URL` / `CHATWORK_SKIP_SIGNATURE_VERIFY`.

**Architecture:** Webhook-logger becomes a pure forwarder: receive → normalize payload → forward to `/internal/translate`. The `/internal/room-secret` endpoint in translator is deleted. `encryptedWebhookSecret` is removed from room config storage. Dashboard forms lose the Webhook Secret input and the stepper shrinks from 6 to 5 steps.

**Tech Stack:** Bun v1.1+ · TypeScript 5.4+ strict · Elysia · Zod · React/react-hook-form · Bun test

---

## File Map

### Delete

| File                                                               | Reason                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `packages/chatwork/src/services/verify-webhook-signature.ts`       | Core HMAC logic — removed entirely                           |
| `packages/chatwork/src/services/verify-webhook-signature.test.ts`  | Tests for deleted function                                   |
| `packages/chatwork/src/errors/chatwork-webhook-signature-error.ts` | Error class only used by verify fn                           |
| `packages/translator/src/routes/internal-room-secret.ts`           | `/internal/room-secret` endpoint                             |
| `packages/translator/src/routes/internal-room-secret.test.ts`      | Tests for deleted route                                      |
| `data/room-configs.json`                                           | Schema change — fresh start without `encryptedWebhookSecret` |

### Modify

| File                                                                   | Change                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/chatwork/src/errors/index.ts`                                | Remove `ChatworkWebhookSignatureError` re-export                                                 |
| `packages/chatwork/src/index.ts`                                       | Remove `verifyWebhookSignature` + `ChatworkWebhookSignatureError` exports                        |
| `packages/webhook-logger/src/env.ts`                                   | Remove `CHATWORK_SKIP_SIGNATURE_VERIFY`, `INTERNAL_API_SECRET`, `TRANSLATOR_INTERNAL_URL`        |
| `packages/webhook-logger/src/env.test.ts`                              | Rewrite 2 tests — only assert `TRANSLATOR_URL`                                                   |
| `packages/webhook-logger/src/routes/webhook.ts`                        | Remove cache + signature logic; handler reads body from `request.text()`                         |
| `packages/webhook-logger/src/routes/webhook.test.ts`                   | Remove cache tests, signature tests, skip-verify describe block                                  |
| `packages/webhook-logger/src/app.test.ts`                              | Remove mock env fields, remove signature integration tests                                       |
| `packages/translator/src/app.ts`                                       | Remove `createInternalRoomSecretRoute` import + `.use()` call                                    |
| `packages/translator/src/env-schema.ts`                                | Remove `INTERNAL_API_SECRET` field                                                               |
| `packages/translator/src/env.test.ts`                                  | Remove 2 tests that assert `INTERNAL_API_SECRET`                                                 |
| `packages/translator/src/app.test.ts`                                  | Remove `INTERNAL_API_SECRET` from mock env                                                       |
| `packages/translator/src/types/room-config.ts`                         | Remove `encryptedWebhookSecret` from schema, `Omit`, `redactRoomConfig`, and request schemas     |
| `packages/translator/src/services/room-config-store.ts`                | Remove encrypt/decrypt webhook secret calls                                                      |
| `packages/translator/src/services/room-config-store.test.ts`           | Remove `webhookSecret` from all fixtures                                                         |
| `packages/translator/src/routes/rooms.test.ts`                         | Remove `webhookSecret` from `VALID_BODY`                                                         |
| `packages/translator/src/webhook/handler.test.ts`                      | Remove `webhookSecret` from test fixture at line 324                                             |
| `packages/dashboard/src/lib/room-schema.ts`                            | Remove `webhookSecret` from `roomCreateSchema` and `roomEditSchema`                              |
| `packages/dashboard/src/lib/api-types.ts`                              | Remove `webhookSecret` from `CreateRoomInput` and `UpdateRoomInput`                              |
| `packages/dashboard/src/lib/room-schema.test.ts`                       | Remove 2 test cases that assert `webhookSecret`                                                  |
| `packages/dashboard/src/lib/api-client.test.ts`                        | Remove test `'sends webhookSecret in createRoom requests'`                                       |
| `packages/dashboard/src/stores/room-store.test.ts`                     | Remove `webhookSecret` from `createRoom` call and `updateRoom` call                              |
| `packages/dashboard/src/pages/room-create.tsx`                         | Remove `BrutalInput` for Webhook Secret, default value, description, "Manual Step Required" card |
| `packages/dashboard/src/pages/room-detail.tsx`                         | Remove `BrutalInput` for Webhook Secret, 3 default values, conditional spread                    |
| `packages/dashboard/src/pages/room-create.test.tsx`                    | Remove assertions about `Webhook Secret` and `register('webhookSecret')`                         |
| `packages/dashboard/src/pages/room-detail.test.tsx`                    | Remove assertion about `register('webhookSecret')`                                               |
| `packages/dashboard/src/components/molecules/webhook-stepper.tsx`      | 6 steps → 5 steps; step 5 reworded; step 6 deleted                                               |
| `packages/dashboard/src/pages/webhook-guide.tsx`                       | Update description + "One-time setup" card text                                                  |
| `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx` | Update `'1 of 6'` → `'1 of 5'`; remove step-5/6 secret assertions                                |
| `packages/dashboard/src/pages/webhook-guide.test.tsx`                  | Remove assertion about `'webhook secret is saved in the room configuration'`                     |
| `.env.example`                                                         | Remove 3 env vars + comments                                                                     |
| `docker-compose.yml`                                                   | Remove `INTERNAL_API_SECRET` (×2) + `TRANSLATOR_INTERNAL_URL`                                    |
| `docker-compose.dev.yml`                                               | Remove `TRANSLATOR_INTERNAL_URL=http://translator:3000`                                          |
| `ai_rules/security.md`                                                 | Remove HMAC section + `CHATWORK_WEBHOOK_SECRET` / `CHATWORK_SKIP_SIGNATURE_VERIFY` entries       |
| `docs/manual-e2e-test.md`                                              | Remove step about saving webhook token                                                           |
| `scripts/dev.test.ts`                                                  | Remove assertion on `TRANSLATOR_INTERNAL_URL`                                                    |

---

## Task 1: Remove verify-webhook-signature from `@chatwork-bot/chatwork`

**Files:**

- Delete: `packages/chatwork/src/services/verify-webhook-signature.ts`
- Delete: `packages/chatwork/src/services/verify-webhook-signature.test.ts`
- Delete: `packages/chatwork/src/errors/chatwork-webhook-signature-error.ts`
- Modify: `packages/chatwork/src/errors/index.ts`
- Modify: `packages/chatwork/src/index.ts`

- [ ] **Step 1: Delete the three files**

```bash
rm packages/chatwork/src/services/verify-webhook-signature.ts
rm packages/chatwork/src/services/verify-webhook-signature.test.ts
rm packages/chatwork/src/errors/chatwork-webhook-signature-error.ts
```

- [ ] **Step 2: Update `packages/chatwork/src/errors/index.ts`**

Replace the entire file with:

```typescript
export { ChatworkWebhookPayloadError } from './chatwork-webhook-payload-error'
export { ChatworkApiError, ChatworkRateLimitError } from './chatwork-api-error'
```

- [ ] **Step 3: Update `packages/chatwork/src/index.ts`**

Remove line 14 and line 19. The file should become:

```typescript
// @chatwork-bot/chatwork – public API

// Types
export type { ChatworkWebhookPayload } from '~/types/webhook'
export type {
  ChatworkMe,
  ChatworkMember,
  ChatworkMessage,
  ChatworkSendMessageResult,
} from '~/types/message'
export type { CreateRoomParams, CreateRoomResult, Room, UpdateRoomParams } from '~/types/room'

// Errors
export { ChatworkWebhookPayloadError } from '~/errors/chatwork-webhook-payload-error'
export { ChatworkApiError, ChatworkRateLimitError } from '~/errors/chatwork-api-error'

// Services
export { normalizeWebhookPayload } from '~/services/normalize-webhook-payload'
export { mapWebhookToTranslationCommand } from '~/services/map-webhook-to-translation-command'
export { sendRoomMessage } from '~/services/send-room-message'
export { deleteRoomMessage } from '~/services/delete-room-message'
export { deleteRoom } from '~/services/delete-room'
export { getRoomMembers } from '~/services/get-room-members'
export { getRoomMessage } from '~/services/get-room-message'
export { listRoomMessages } from '~/services/list-room-messages'
export { resolveRoomMemberDisplayName } from '~/services/resolve-room-member-display-name'
export { getMe } from '~/services/get-me'
export { getRoom } from '~/services/get-room'
export { createRoom } from '~/services/create-room'
export { updateRoom } from '~/services/update-room'
export { resolveRoomDisplayName } from '~/services/resolve-room-display-name'
export { composeTranslatedMessagePair } from '~/services/compose-translated-message-pair'
```

- [ ] **Step 4: Run chatwork tests**

```bash
cd packages/chatwork && bun test
```

Expected: all tests pass (the deleted test file is gone, no other test references `verifyWebhookSignature`).

- [ ] **Step 5: Commit**

```bash
git add packages/chatwork/src/services/verify-webhook-signature.ts \
        packages/chatwork/src/services/verify-webhook-signature.test.ts \
        packages/chatwork/src/errors/chatwork-webhook-signature-error.ts \
        packages/chatwork/src/errors/index.ts \
        packages/chatwork/src/index.ts
git commit -m "$(cat <<'EOF'
feat(chatwork): remove verifyWebhookSignature and ChatworkWebhookSignatureError

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Simplify webhook-logger env

**Files:**

- Modify: `packages/webhook-logger/src/env.ts`
- Modify: `packages/webhook-logger/src/env.test.ts`

- [ ] **Step 1: Rewrite `packages/webhook-logger/src/env.ts`**

```typescript
import { z } from 'zod'

const envSchema = z.object({
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z.string().pipe(z.url()).default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
})

export function parseEnv(input: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(input)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = parseEnv(process.env)

export type Env = z.infer<typeof envSchema>
```

- [ ] **Step 2: Rewrite `packages/webhook-logger/src/env.test.ts`**

```typescript
import { afterEach, describe, expect, it } from 'bun:test'
import type { Env } from './env'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      void Reflect.deleteProperty(process.env, key)
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
})

describe('webhook-logger env', () => {
  it('parses TRANSLATOR_URL and applies defaults', async () => {
    process.env['TRANSLATOR_URL'] = 'http://localhost:3000'

    const envModuleUnknown: unknown = await import(
      `${import.meta.dir}/env.ts?${crypto.randomUUID()}`
    )
    const { parseEnv } = envModuleUnknown as { parseEnv: (input: NodeJS.ProcessEnv) => Env }
    const env = parseEnv(process.env)

    expect(env.TRANSLATOR_URL).toBe('http://localhost:3000')
    expect('INTERNAL_API_SECRET' in env).toBe(false)
    expect('TRANSLATOR_INTERNAL_URL' in env).toBe(false)
    expect('CHATWORK_SKIP_SIGNATURE_VERIFY' in env).toBe(false)
  })
})
```

- [ ] **Step 3: Run env test**

```bash
cd packages/webhook-logger && bun test src/env.test.ts
```

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add packages/webhook-logger/src/env.ts packages/webhook-logger/src/env.test.ts
git commit -m "$(cat <<'EOF'
feat(webhook-logger): remove CHATWORK_SKIP_SIGNATURE_VERIFY, INTERNAL_API_SECRET, TRANSLATOR_INTERNAL_URL from env

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rewrite webhook-logger route handler

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.ts`

- [ ] **Step 1: Rewrite `packages/webhook-logger/src/routes/webhook.ts`**

The new file removes: `.derive()` rawBody hook, `RoomSecretFetchError`, cache constants, `CachedRoomSecret`, `roomSecretCache`, `resetRoomSecretCacheForTest()`, `getCachedRoomSecret()`, `fetchRoomSecret()`, `extractRoomId()`, and all signature verification logic.

```typescript
import { Elysia } from 'elysia'
import {
  normalizeWebhookPayload,
  mapWebhookToTranslationCommand,
  ChatworkWebhookPayloadError,
} from '@chatwork-bot/chatwork'
import { env } from '~/env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
  .post('/webhook', ({ request }) => handleWebhook(request))
  .post('/', ({ request }) => handleWebhook(request))

type WebhookLogLevel = 'info' | 'warn' | 'error'

function logWebhookEvent(
  level: WebhookLogLevel,
  event: string,
  context: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    level,
    service: 'webhook-logger',
    event,
    timestamp: new Date().toISOString(),
    ...context,
  })

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

async function handleWebhook(request: Request): Promise<Response> {
  const traceId = crypto.randomUUID()
  const rawBody = await request.text()

  // --- Payload normalization ---
  let payload: ReturnType<typeof normalizeWebhookPayload>
  try {
    payload = normalizeWebhookPayload(rawBody)
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookPayloadError) {
      logWebhookEvent('error', 'webhook_payload_invalid', {
        traceId,
        errorCode: 'WEBHOOK_PAYLOAD_INVALID',
        errorMessage: err.message,
      })
      return new Response('Invalid webhook payload', { status: 422 })
    }
    throw err
  }

  // --- Map to neutral DTO ---
  const command = mapWebhookToTranslationCommand(payload, new Date().toISOString())

  const sourceMessageId = command.sourceMessageId
  const sourceRoomId = command.sourceRoomId

  logWebhookEvent('info', 'webhook_received', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
  })

  logWebhookEvent('info', 'translation_forward_started', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
  })

  // --- Forward neutral DTO to translator ---
  let response: Response
  try {
    response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': traceId,
      },
      body: JSON.stringify({ command }),
    })
  } catch (err: unknown) {
    logWebhookEvent('error', 'translation_forward_failed', {
      traceId,
      sourceMessageId,
      roomId: sourceRoomId,
      errorCode: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return new Response('Translator unavailable', { status: 503 })
  }

  if (!response.ok) {
    logWebhookEvent('error', 'translation_forward_failed', {
      traceId,
      sourceMessageId,
      roomId: sourceRoomId,
      errorCode: 'TRANSLATOR_HTTP',
      errorMessage: `Translator responded with ${String(response.status)}`,
      translatorStatus: response.status,
    })
    return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
  }

  logWebhookEvent('info', 'translation_forward_completed', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
    translatorStatus: response.status,
  })

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 2: Run typecheck on webhook-logger**

```bash
cd packages/webhook-logger && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.ts
git commit -m "$(cat <<'EOF'
feat(webhook-logger): remove signature verification and room secret cache — pure forwarder

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update webhook-logger tests

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/webhook-logger/src/app.test.ts`

- [ ] **Step 1: Update the mockEnv in `webhook.test.ts`**

Find the mock.module block near the top of the file. Remove `CHATWORK_SKIP_SIGNATURE_VERIFY`, `INTERNAL_API_SECRET`, and `TRANSLATOR_INTERNAL_URL` from the mock env object:

```typescript
void mock.module('~/env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}))
```

- [ ] **Step 2: Remove the import of `resetRoomSecretCacheForTest` from `webhook.test.ts`**

Find and remove this import line:

```typescript
import { webhookRoutes, resetRoomSecretCacheForTest } from './webhook'
```

Replace with:

```typescript
import { webhookRoutes } from './webhook'
```

- [ ] **Step 3: Remove `resetRoomSecretCacheForTest()` calls from `beforeEach`/`afterEach` in `webhook.test.ts`**

Find the `beforeEach` and `afterEach` blocks that call `resetRoomSecretCacheForTest()` and remove those calls.

- [ ] **Step 4: Delete `describe('room secret cache', ...)` block from `webhook.test.ts`**

This is a large describe block (approximately lines 138–236 in the original file). Delete the entire block:

```typescript
describe('room secret cache', () => {
  // ... all tests inside ...
})
```

- [ ] **Step 5: Delete all signature-related `it(...)` tests from `webhook.test.ts`**

Delete any test that:

- Tests for `422` on missing signature header
- Tests for `422` on invalid signature
- Tests that assert `fetchSpy.mock.calls[0]` pointed at `/internal/room-secret`

Also delete the `makeSignature` helper function at the top of the file.

- [ ] **Step 6: Delete `describe('webhookRoutes – CHATWORK_SKIP_SIGNATURE_VERIFY', ...)` block from `webhook.test.ts`**

This is the last describe block in the file (approximately lines 594–633). Delete the entire block.

- [ ] **Step 7: Update forward tests in `webhook.test.ts` — only 1 fetch call now**

In the forward/success tests, the first fetch used to be the room-secret lookup and the second was the translate call. Now there is only 1 fetch call (the translate call). Update assertions:

Before:

```typescript
const [translateInput, translateInit] = fetchSpy.mock.calls[1] as [string, RequestInit]
```

After:

```typescript
const [translateInput, translateInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
```

Also remove any assertions on `fetchSpy.mock.calls[0]` that were asserting the room-secret URL.

- [ ] **Step 8: Update forward tests — requests no longer need signature headers**

In success-path tests, remove the `'X-ChatWorkWebhookSignature': makeSignature(rawBody)` header from all `new Request(...)` calls. Only `'Content-Type': 'application/json'` is needed.

- [ ] **Step 9: Rewrite `packages/webhook-logger/src/app.test.ts`**

The app.test.ts needs: the mock env without the 3 removed fields, global.fetch without room-secret routing, and webhook tests that don't use signatures.

```typescript
import { describe, expect, it, mock } from 'bun:test'

type FetchInput = string | URL | Request

void mock.module('./env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}))

global.fetch = mock((_input: FetchInput) => {
  return Promise.resolve(new Response('OK'))
}) as unknown as typeof fetch

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
    const rawBody = JSON.stringify({
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
    })
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      }),
    )
    expect(res.status).toBe(200)
  })

  it('POST /webhook accepts message_updated payloads', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const rawBody = JSON.stringify({
      webhook_setting_id: '12345',
      webhook_event_type: 'message_updated',
      webhook_event_time: 1498028130,
      webhook_event: {
        message_id: '789012345',
        room_id: 567890123,
        account_id: 123456,
        body: 'Hello World',
        send_time: 1498028125,
        update_time: 1498028130,
      },
    })
    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
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

- [ ] **Step 10: Run all webhook-logger tests**

```bash
cd packages/webhook-logger && bun test
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.test.ts \
        packages/webhook-logger/src/app.test.ts
git commit -m "$(cat <<'EOF'
test(webhook-logger): remove signature/cache tests, update forward tests and integration tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove `/internal/room-secret` from translator

**Files:**

- Delete: `packages/translator/src/routes/internal-room-secret.ts`
- Delete: `packages/translator/src/routes/internal-room-secret.test.ts`
- Modify: `packages/translator/src/app.ts`
- Modify: `packages/translator/src/env-schema.ts`
- Modify: `packages/translator/src/env.test.ts`
- Modify: `packages/translator/src/app.test.ts`

- [ ] **Step 1: Delete the route files**

```bash
rm packages/translator/src/routes/internal-room-secret.ts
rm packages/translator/src/routes/internal-room-secret.test.ts
```

- [ ] **Step 2: Update `packages/translator/src/app.ts`**

Remove line 9 (import) and line 64 (`.use()` call):

```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { providerHealthRoute } from './routes/provider-health'
import { providersRoute } from './routes/providers'
import { createRoomsRoutes } from './routes/rooms'
import { createStatusRoute } from './routes/status'
import { staticRoutes, spaCatchAll } from './routes/static'
import { getTranslatorStatusSnapshot } from './services/translator-observability-runtime'
import { translateRoutes } from './webhook/router'
import { env } from './env'
import type { RoomConfigStore } from './services/room-config-store'

interface AppOptions {
  store: RoomConfigStore
}

export function createApp({ store }: AppOptions) {
  const app = new Elysia({ name: 'translator' })

  if (env.NODE_ENV !== 'test') {
    app.use(
      logixlysia({
        config: {
          showStartupMessage: false,
          ip: false,
          customLogFormat:
            '🦊 {now} {level} {duration} {method} {pathname} {status} {message} {context}',
        },
      }),
    )
  }

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

  app.use(cors())

  return app
    .use(healthRoutes)
    .use(providerHealthRoute)
    .use(createStatusRoute(() => getTranslatorStatusSnapshot()))
    .use(providersRoute)
    .use(
      createRoomsRoutes({
        store,
        chatworkApiToken: env.CHATWORK_API_TOKEN,
        chatworkBotAccountId: env.CHATWORK_BOT_ACCOUNT_ID,
      }),
    )
    .use(translateRoutes)
    .use(staticRoutes)
    .use(spaCatchAll)
}
```

- [ ] **Step 3: Update `packages/translator/src/env-schema.ts`**

Remove line 15 (`INTERNAL_API_SECRET`):

```typescript
import { z } from 'zod'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export const translatorEnvSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_BOT_ACCOUNT_ID: z.coerce
    .number()
    .int()
    .positive('CHATWORK_BOT_ACCOUNT_ID must be a positive integer'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  ROOM_CONFIG_ENCRYPTION_KEY: z
    .string()
    .length(64, 'ROOM_CONFIG_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  ROOM_CONFIG_DATA_DIR: z.string().default('./data'),
  TRANSLATOR_PHASE_HEARTBEAT_MS: z.coerce.number().int().positive().default(30_000),
  TRANSLATOR_TRANSLATION_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(45_000),
  TRANSLATOR_ACK_CALLBACK_BUDGET_MS: z.coerce.number().int().positive().default(10_000),
  TRANSLATOR_PIPELINE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS),
  TRANSLATOR_STATUS_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
})

export function parseTranslatorEnv(input: NodeJS.ProcessEnv) {
  const result = translatorEnvSchema.safeParse(input)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}
```

- [ ] **Step 4: Update `packages/translator/src/env.test.ts`**

Remove `process.env['INTERNAL_API_SECRET'] = 'internal-secret'` from all 4 test cases, and remove the entire last test (`'rejects missing INTERNAL_API_SECRET values at schema level'`). Also remove `INTERNAL_API_SECRET: 'internal-secret'` from the safeParse call in the 4th test.

The resulting file should look like:

```typescript
import { afterEach, describe, expect, it } from 'bun:test'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) void Reflect.deleteProperty(process.env, key)
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
})

describe('translator env', () => {
  it('applies observability defaults when optional vars are absent', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.ROOM_CONFIG_DATA_DIR).toBe('./data')
    expect(env.TRANSLATOR_PHASE_HEARTBEAT_MS).toBe(30_000)
    expect(env.TRANSLATOR_TRANSLATION_BUDGET_MS).toBe(60_000)
    expect(env.TRANSLATOR_DELIVERY_BUDGET_MS).toBe(45_000)
    expect(env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS).toBe(10_000)
    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(1_800_000)
    expect(env.TRANSLATOR_STATUS_HISTORY_LIMIT).toBe(20)
  })

  it('allows overriding the pipeline timeout', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '45000'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(45_000)
  })

  it('accepts a valid custom room config data directory override', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)
    process.env['ROOM_CONFIG_DATA_DIR'] = '/tmp/translator-room-configs'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.ROOM_CONFIG_DATA_DIR).toBe('/tmp/translator-room-configs')
  })

  it('rejects invalid ROOM_CONFIG_ENCRYPTION_KEY values at schema level', async () => {
    const { translatorEnvSchema } = await import('./env-schema')
    const result = translatorEnvSchema.safeParse({
      CHATWORK_API_TOKEN: 'token',
      CHATWORK_BOT_ACCOUNT_ID: '42',
      ROOM_CONFIG_ENCRYPTION_KEY: 'short-key',
    })

    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 5: Update `packages/translator/src/app.test.ts`**

Remove `INTERNAL_API_SECRET: 'internal-secret'` from the mock env object (line 10):

```typescript
void mock.module('./env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'test-token',
    CHATWORK_BOT_ACCOUNT_ID: 42,
    PORT: 3000,
    NODE_ENV: 'test',
  },
}))
```

- [ ] **Step 6: Run translator tests**

```bash
cd packages/translator && bun test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/translator/src/routes/internal-room-secret.ts \
        packages/translator/src/routes/internal-room-secret.test.ts \
        packages/translator/src/app.ts \
        packages/translator/src/env-schema.ts \
        packages/translator/src/env.test.ts \
        packages/translator/src/app.test.ts
git commit -m "$(cat <<'EOF'
feat(translator): remove /internal/room-secret endpoint and INTERNAL_API_SECRET env var

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Remove `encryptedWebhookSecret` from translator types and store

**Files:**

- Modify: `packages/translator/src/types/room-config.ts`
- Modify: `packages/translator/src/services/room-config-store.ts`

- [ ] **Step 1: Rewrite `packages/translator/src/types/room-config.ts`**

Remove `encryptedWebhookSecret` from `RoomConfigSchema`, `RoomConfigPublic`, `redactRoomConfig`, `CreateRoomRequestSchema`, and `UpdateRoomRequestSchema`:

```typescript
import { z } from 'zod'

export const AI_PROVIDER_VALUES = ['openai', 'gemini'] as const
export type RoomAiProvider = (typeof AI_PROVIDER_VALUES)[number]

export const TRANSLATION_STYLE_VALUES_ROOM = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const
export type RoomTranslationStyle = (typeof TRANSLATION_STYLE_VALUES_ROOM)[number]

export const RoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM),
  encryptedAiApiToken: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type RoomConfig = z.infer<typeof RoomConfigSchema>

export const RoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(RoomConfigSchema),
})

export type RoomConfigFile = z.infer<typeof RoomConfigFileSchema>

export const ArchivedRoomConfigSchema = RoomConfigSchema.extend({
  archivedAt: z.iso.datetime(),
})

export type ArchivedRoomConfig = z.infer<typeof ArchivedRoomConfigSchema>

export const ArchiveFileSchema = z.object({
  archived: z.array(ArchivedRoomConfigSchema),
})

export type ArchiveFile = z.infer<typeof ArchiveFileSchema>

export type RoomConfigPublic = Omit<RoomConfig, 'encryptedAiApiToken'>

export function redactRoomConfig(room: RoomConfig): RoomConfigPublic {
  const { encryptedAiApiToken: _a, ...rest } = room

  return rest
}

export const CreateRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1).max(128),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable().default(null),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).default('PROFESSIONAL_BUSINESS'),
  aiApiToken: z.string().min(1),
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>

export const UpdateRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  aiProvider: z.enum(AI_PROVIDER_VALUES).optional(),
  aiModel: z.string().min(1).nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).optional(),
  aiApiToken: z.string().min(1).optional(),
})

export type UpdateRoomRequest = z.infer<typeof UpdateRoomRequestSchema>
```

- [ ] **Step 2: Update `packages/translator/src/services/room-config-store.ts`**

Remove 4 things:

1. Line 88: `encryptedWebhookSecret: await encrypt(params.webhookSecret, this.encryptionKeyHex),` from the `create()` method's `room` object literal.

2. Lines 116–119 and line 132: Remove the entire `encryptedWebhookSecret` re-encryption block from `update()`, and remove `encryptedWebhookSecret,` from the `updated` object spread. The `update()` method should look like:

```typescript
async update(id: string, patch: UpdateRoomRequest): Promise<RoomConfigPublic> {
  return this.withMutex(async () => {
    const existing = this.roomsById.get(id)
    if (existing === undefined) {
      throw new RoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
    }

    const encryptedAiApiToken =
      patch.aiApiToken !== undefined
        ? await encrypt(patch.aiApiToken, this.encryptionKeyHex)
        : existing.encryptedAiApiToken

    const updated: RoomConfig = {
      ...existing,
      ...(patch.destinationRoomName !== undefined
        ? { destinationRoomName: patch.destinationRoomName }
        : {}),
      ...(patch.aiProvider !== undefined ? { aiProvider: patch.aiProvider } : {}),
      ...(patch.aiModel !== undefined ? { aiModel: patch.aiModel } : {}),
      ...(patch.translationStyle !== undefined
        ? { translationStyle: patch.translationStyle }
        : {}),
      encryptedAiApiToken,
      updatedAt: new Date().toISOString(),
    }

    const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
    await this.writeConfig({ version: 1, rooms })
    this.rebuildIndex(rooms)

    return redactRoomConfig(updated)
  })
}
```

3. Lines 182–184: Remove the entire `decryptWebhookSecret()` method.

4. The `create()` method's `room` object should no longer include `encryptedWebhookSecret`:

```typescript
const room: RoomConfig = {
  id: crypto.randomUUID(),
  originalRoomId: params.originalRoomId,
  destinationRoomId: params.destinationRoomId,
  destinationRoomName: params.destinationRoomName,
  aiProvider: params.aiProvider,
  aiModel: params.aiModel,
  translationStyle: params.translationStyle,
  encryptedAiApiToken: await encrypt(params.aiApiToken, this.encryptionKeyHex),
  enabled: true,
  createdAt: now,
  updatedAt: now,
}
```

- [ ] **Step 3: Run translator typecheck**

```bash
cd packages/translator && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/types/room-config.ts \
        packages/translator/src/services/room-config-store.ts
git commit -m "$(cat <<'EOF'
feat(translator): remove encryptedWebhookSecret from RoomConfig schema and store

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update translator tests + delete data file

**Files:**

- Modify: `packages/translator/src/services/room-config-store.test.ts`
- Modify: `packages/translator/src/routes/rooms.test.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`
- Delete: `data/room-configs.json`

- [ ] **Step 1: Remove `webhookSecret` from all fixtures in `room-config-store.test.ts`**

There are 11 occurrences of `webhookSecret:` in this file. Remove every occurrence. Also remove line 78: `expect(room.encryptedWebhookSecret).not.toBe('raw-secret')` — this property no longer exists. For example, the `create()` test fixture changes from:

```typescript
const room = await store.create({
  originalRoomId: 1001,
  destinationRoomId: 2001,
  destinationRoomName: 'Output Room',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'raw-token',
  webhookSecret: 'raw-secret',
})
```

To:

```typescript
const room = await store.create({
  originalRoomId: 1001,
  destinationRoomId: 2001,
  destinationRoomName: 'Output Room',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'raw-token',
})
```

Apply the same `webhookSecret` removal to all remaining store.create() and store.update() calls in the file.

- [ ] **Step 2: Remove `webhookSecret` from `VALID_BODY` in `rooms.test.ts`**

Line 43 currently reads:

```typescript
const VALID_BODY = {
  originalRoomId: 1001,
  destinationRoomName: 'Translation Output',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'sk-openai-key',
  webhookSecret: 'webhook-secret-abc',
}
```

Remove `webhookSecret: 'webhook-secret-abc'`:

```typescript
const VALID_BODY = {
  originalRoomId: 1001,
  destinationRoomName: 'Translation Output',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'sk-openai-key',
}
```

- [ ] **Step 3: Remove `webhookSecret` from `handler.test.ts`**

Line 324 currently reads `webhookSecret: 'room-webhook-secret',` inside a store.create() call. Remove it.

- [ ] **Step 4: Delete `data/room-configs.json`**

```bash
rm -f data/room-configs.json
```

- [ ] **Step 5: Run all translator tests**

```bash
cd packages/translator && bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/services/room-config-store.test.ts \
        packages/translator/src/routes/rooms.test.ts \
        packages/translator/src/webhook/handler.test.ts \
        data/room-configs.json
git commit -m "$(cat <<'EOF'
feat(translator): remove webhookSecret from all test fixtures; delete stale room-configs.json

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Remove `webhookSecret` from dashboard schemas and API types

**Files:**

- Modify: `packages/dashboard/src/lib/room-schema.ts`
- Modify: `packages/dashboard/src/lib/api-types.ts`
- Modify: `packages/dashboard/src/lib/room-schema.test.ts`
- Modify: `packages/dashboard/src/lib/api-client.test.ts`
- Modify: `packages/dashboard/src/stores/room-store.test.ts`

- [ ] **Step 1: Update `packages/dashboard/src/lib/room-schema.ts`**

Remove `webhookSecret` field from both schemas:

```typescript
import { z } from 'zod'

export const TRANSLATION_STYLES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export const AI_PROVIDERS = ['openai', 'gemini'] as const

export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z
    .string({ required_error: 'AI API token is required' })
    .min(1, 'AI API token is required'),
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

export const roomEditSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().optional().default(''),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z.string().optional().default(''),
})

export type RoomEditInput = z.infer<typeof roomEditSchema>
```

- [ ] **Step 2: Update `packages/dashboard/src/lib/api-types.ts`**

Remove `webhookSecret` from both interfaces:

```typescript
export interface CreateRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
}

// ...

export interface UpdateRoomInput {
  destinationRoomName?: string
  aiProvider?: AiProvider
  aiModel?: string | null
  translationStyle?: TranslationStyle
  aiApiToken?: string
}
```

- [ ] **Step 3: Update `packages/dashboard/src/lib/room-schema.test.ts`**

Replace the first test (`'requires webhookSecret when validating the create payload'`) to no longer include or assert `webhookSecret`. Update the `validResult` parse to remove `webhookSecret: 'cw-secret-demo'` and remove the `webhookSecret` assertion on the invalid case. Also update the second test (`'allows blank secrets on the edit schema'`) to remove `webhookSecret: ''` from the safeParse call:

```typescript
import { describe, expect, it } from 'bun:test'

const removedWebhookActivationSchema = ['webhook', 'Activation', 'Schema'].join('')

describe('room schema', () => {
  it('requires aiApiToken when validating the create payload', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    const validResult = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: 'sk-demo',
    })

    expect(validResult.success).toBe(true)

    const invalidResult = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 0,
      destinationRoomName: '',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: '',
    })

    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error?.flatten().fieldErrors.originalRoomId).toContain(
      'Room ID must be positive',
    )
    expect(invalidResult.error?.flatten().fieldErrors.destinationRoomName).toContain(
      'Destination room name is required',
    )
    expect(invalidResult.error?.flatten().fieldErrors.aiApiToken).toContain(
      'AI API token is required',
    )
  })

  it('allows blank aiApiToken on the edit schema so unchanged values can be preserved', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    const result = schemaModule.roomEditSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: '',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: '',
    })

    expect(result.success).toBe(true)
  })

  it('removes the old webhook activation schema export', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    expect(removedWebhookActivationSchema in schemaModule).toBe(false)
  })
})
```

- [ ] **Step 4: Remove the `webhookSecret` test from `api-client.test.ts`**

Delete the entire test case `'sends webhookSecret in createRoom requests'` (lines 96–121).

- [ ] **Step 5: Remove `webhookSecret` from `room-store.test.ts`**

Remove `webhookSecret: 'cw-secret-555001'` from the `createRoom` call (line 224) and `webhookSecret: 'cw-secret-rotated'` from the `updateRoom` call (line 238).

- [ ] **Step 6: Run dashboard tests for schema/store**

```bash
cd packages/dashboard && bun test src/lib src/stores
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/lib/room-schema.ts \
        packages/dashboard/src/lib/api-types.ts \
        packages/dashboard/src/lib/room-schema.test.ts \
        packages/dashboard/src/lib/api-client.test.ts \
        packages/dashboard/src/stores/room-store.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): remove webhookSecret from room schemas, API types, and related tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Remove Webhook Secret UI from room pages

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.tsx`
- Modify: `packages/dashboard/src/pages/room-create.test.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.test.tsx`

- [ ] **Step 1: Update `packages/dashboard/src/pages/room-create.tsx`**

Four changes:

1. Remove `webhookSecret: ''` from `defaultValues`.

2. Remove the `BrutalInput` for Webhook Secret (lines 172–178):

```tsx
<BrutalInput
  label="Webhook Secret"
  type="password"
  hint="The token from Chatwork after saving the webhook. Follow the Webhook Guide first."
  error={errors.webhookSecret?.message}
  {...register('webhookSecret')}
/>
```

3. Update `description` prop on `PageShell` — remove "and webhook secret before saving":

```tsx
description = 'Configure the Chatwork source room, AI provider, and translation preferences.'
```

4. Replace the "Manual Step Required" sticker card content to remove the reference to webhook secret. Update the card to:

```tsx
<BrutalCard className="theme-card-matcha space-y-3" tilt="left">
  <StickerLabel tone="warning">Before You Start</StickerLabel>
  <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
    Before creating a room, set up a Chatwork webhook with this server's URL. Follow the Webhook
    Guide for step-by-step instructions.
  </p>
  <button
    type="button"
    onClick={() => {
      void navigate('/guide')
    }}
    className="brutal-button theme-button-sky px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
  >
    Open Webhook Guide
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: '6px',
        marginTop: '-2px',
      }}
    >
      <path
        d="M3 8H13M13 8L9 4M13 8L9 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
</BrutalCard>
```

- [ ] **Step 2: Update `packages/dashboard/src/pages/room-detail.tsx`**

Three changes:

1. Remove `webhookSecret: ''` from both default value objects (lines 84 and 93) and from the `editForm.reset(...)` call (line 119).

2. Remove the `BrutalInput` for Webhook Secret (lines 304–310):

```tsx
<BrutalInput
  label="Webhook Secret"
  type="password"
  hint="Leave blank to keep existing. Paste new secret to update."
  error={editForm.formState.errors.webhookSecret?.message}
  {...editForm.register('webhookSecret')}
/>
```

3. Remove the conditional spread `...(data.webhookSecret !== '' ? { webhookSecret: data.webhookSecret } : {})` from the `updateRoom` call inside `onEditSubmit` (line 196). The `updateRoom` call should be:

```typescript
updateRoom(room.id, {
  destinationRoomName: data.destinationRoomName,
  aiProvider: data.aiProvider,
  aiModel: normalizedAiModel,
  translationStyle: data.translationStyle,
  ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
})
```

- [ ] **Step 3: Update `packages/dashboard/src/pages/room-create.test.tsx`**

Remove:

- Line 40: `expect(html).toContain('Webhook Secret')`
- Line 56: `expect(source).toContain("register('webhookSecret')")`

Update the description assertion if needed:

- Line 44 currently `expect(html).toContain('Before creating a room')` — update text if the card text changed. The new card says "Before You Start" so update: `expect(html).toContain('Before You Start')`

- [ ] **Step 4: Update `packages/dashboard/src/pages/room-detail.test.tsx`**

Remove:

- Line 58: `expect(source).toContain("register('webhookSecret')")`

- [ ] **Step 5: Run dashboard page tests**

```bash
cd packages/dashboard && bun test src/pages/room-create.test.tsx src/pages/room-detail.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/pages/room-create.tsx \
        packages/dashboard/src/pages/room-detail.tsx \
        packages/dashboard/src/pages/room-create.test.tsx \
        packages/dashboard/src/pages/room-detail.test.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): remove Webhook Secret input from room create and edit forms

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update webhook stepper and guide

**Files:**

- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.tsx`
- Modify: `packages/dashboard/src/pages/webhook-guide.tsx`
- Modify: `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx`
- Modify: `packages/dashboard/src/pages/webhook-guide.test.tsx`

- [ ] **Step 1: Update `packages/dashboard/src/components/molecules/webhook-stepper.tsx`**

Replace the `STEPS`, `CARD_THEMES`, `PILL_COLORS`, and `TILTS_BY_INDEX` arrays. Step 5 is reworded; step 6 is deleted:

```typescript
const STEPS: Step[] = [
  {
    number: '01',
    title: 'Access Chatwork Admin',
    body: 'Log in to your Chatwork account. Open the Admin panel and navigate to Integrations → Webhooks.',
    action: 'link',
    actionLabel: 'Open Chatwork Admin',
  },
  {
    number: '02',
    title: 'Create New Webhook',
    body: 'Click "Add webhook". Give it a descriptive name — for example, the room name you are setting up — so you can recognise it later.',
    action: 'none',
  },
  {
    number: '03',
    title: 'Paste Webhook URL',
    body: 'Copy the URL below and paste it into the "Webhook URL" field in the Chatwork form.',
    action: 'copy',
    actionLabel: 'Copy URL',
  },
  {
    number: '04',
    title: 'Select Events',
    body: 'Tick "Message created" and "Message updated". Enter the original Room ID in the room filter so Chatwork only fires events for that room.',
    action: 'none',
  },
  {
    number: '05',
    title: 'Save Webhook',
    body: 'Click Save. Chatwork will activate the webhook. No secret needed.',
    action: 'none',
  },
]

const CARD_THEMES = [
  'theme-card-matcha',
  'theme-card-lilac',
  'theme-card-sky',
  'theme-card-matcha',
  'theme-card-peach',
] as const

const PILL_COLORS = [
  'bg-[#6e77e5]',
  'bg-[#e8a065]',
  'bg-[#5bb89a]',
  'bg-[#d44470]',
  'bg-[#6e77e5]',
] as const

const TILTS_BY_INDEX = ['left', 'right', 'flat', 'left', 'right'] as const
```

- [ ] **Step 2: Update `packages/dashboard/src/pages/webhook-guide.tsx`**

Two changes:

1. Update the `description` prop in `PageShell` from "six steps" to "five steps":

```tsx
description =
  'Follow these five steps to connect your Chatwork room to the translation bot. Complete each step before moving on.'
```

2. Update the "One-time setup" card text (remove reference to webhook secret):

```tsx
<p className="text-sm leading-7 text-[var(--text-secondary)]">
  Once the webhook URL is saved in Chatwork and the room is enabled, translation runs automatically.
</p>
```

- [ ] **Step 3: Update `packages/dashboard/src/components/molecules/webhook-stepper.test.tsx`**

Three changes:

1. Line 17: `expect(html).toContain('1 of 6')` → `expect(html).toContain('1 of 5')`

2. Delete the entire test case `'uses webhook-secret copy instead of the removed activation-token flow'` (lines 44–54). This test asserted on `"title: 'Save & Copy Secret'"` and `'webhook secret only once'` and `'Webhook Secret field'` — all of which are removed from the new step 5.

3. Add a new test to verify the new step 5:

```typescript
it('step 5 instructs save without copying a secret', async () => {
  const source = await Bun.file(new URL('./webhook-stepper.tsx', import.meta.url)).text()

  expect(source).toContain("title: 'Save Webhook'")
  expect(source).toContain('No secret needed')
  expect(source).not.toContain("title: 'Save & Copy Secret'")
  expect(source).not.toContain('Save Secret on Dashboard')
})
```

- [ ] **Step 4: Update `packages/dashboard/src/pages/webhook-guide.test.tsx`**

Remove the assertion at line 32:

```typescript
expect(source).toContain('webhook secret is saved in the room configuration')
```

Replace it with the new text:

```typescript
expect(source).toContain('webhook URL is saved in Chatwork')
```

- [ ] **Step 5: Run dashboard component and guide tests**

```bash
cd packages/dashboard && bun test src/components/molecules/webhook-stepper.test.tsx src/pages/webhook-guide.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/molecules/webhook-stepper.tsx \
        packages/dashboard/src/pages/webhook-guide.tsx \
        packages/dashboard/src/components/molecules/webhook-stepper.test.tsx \
        packages/dashboard/src/pages/webhook-guide.test.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): simplify webhook stepper to 5 steps, remove secret copy step

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Update infra, docs, and run full test suite

**Files:**

- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `ai_rules/security.md`
- Modify: `docs/manual-e2e-test.md`
- Modify: `scripts/dev.test.ts`

- [ ] **Step 1: Update `.env.example`**

Apply these changes:

1. Remove the "Webhook signature verification" comment block (lines 7–10):

```
# --- Webhook signature verification (webhook-logger) ---
# Set to true ONLY in development/local to bypass HMAC signature check.
# Always ignored in production. Default: false (verification enabled).
CHATWORK_SKIP_SIGNATURE_VERIFY=false
```

2. Remove the `INTERNAL_API_SECRET` block (lines 17–19):

```
# Shared secret for internal API communication (translator ↔ webhook-logger)
# Generate with: openssl rand -hex 16
INTERNAL_API_SECRET=
```

3. Remove `TRANSLATOR_INTERNAL_URL=http://localhost:3000` (line 42).

4. Remove the note block about both translator URLs (lines 44–50):

```
# NOTE: Both translator URLs above default to localhost for native dev
# ...
# Do NOT change either value to http://translator:3000 here — it will break
# native dev outside Docker.
```

Replace with a simpler comment for `TRANSLATOR_URL`:

```
# Translator service URL (used by webhook-logger to forward events)
TRANSLATOR_URL=http://localhost:3000
```

5. Update the "=== Removed ===" section — change the `CHATWORK_WEBHOOK_SECRET` line:

```
# CHATWORK_WEBHOOK_SECRET      → removed (signature verification eliminated)
```

- [ ] **Step 2: Update `docker-compose.yml`**

Remove `INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}` from the `translator` service environment (line 10) and remove both `INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}` and `TRANSLATOR_INTERNAL_URL: http://translator:3000` from the `webhook-logger` service environment (lines 35–36).

- [ ] **Step 3: Update `docker-compose.dev.yml`**

Remove line 70: `- TRANSLATOR_INTERNAL_URL=http://translator:3000` from the `webhook-logger` service environment block.

- [ ] **Step 4: Update `ai_rules/security.md`**

Remove the HMAC webhook signature verification section. Specifically:

- Remove the section that describes `CHATWORK_WEBHOOK_SECRET` (per-room secret).
- Remove the entry for `CHATWORK_SKIP_SIGNATURE_VERIFY`.
- Remove any description of the `X-ChatWorkWebhookSignature` header verification flow.

- [ ] **Step 5: Update `docs/manual-e2e-test.md`**

Remove the step "Save and copy the webhook token (this is the webhookSecret)" and any subsequent step that says to paste the secret into the dashboard Webhook Secret field.

- [ ] **Step 6: Remove assertion from `scripts/dev.test.ts`**

At line 404, remove:

```typescript
expect(webhookLoggerBlock).toContain('TRANSLATOR_INTERNAL_URL=http://translator:3000')
```

The surrounding test (`'wires webhook-logger to the translator internal URL in docker-compose.dev.yml'`) should either be deleted entirely or updated. Since the feature it was testing is now gone, delete the entire `it(...)` block.

- [ ] **Step 7: Run the full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all tests pass, no type errors, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add .env.example \
        docker-compose.yml \
        docker-compose.dev.yml \
        ai_rules/security.md \
        docs/manual-e2e-test.md \
        scripts/dev.test.ts
git commit -m "$(cat <<'EOF'
chore(repo): remove INTERNAL_API_SECRET and TRANSLATOR_INTERNAL_URL from infra and docs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review against spec

Checked `docs/superpowers/specs/2026-03-27-remove-webhook-signature-verification-design.md`:

| Spec requirement                                                                                                               | Covered in task           |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Remove `verifyWebhookSignature` and `ChatworkWebhookSignatureError` from `@chatwork-bot/chatwork`                              | Task 1                    |
| Remove signature verification logic from webhook-logger handler                                                                | Task 3                    |
| Remove room secret cache and `fetchRoomSecret()`                                                                               | Task 3                    |
| Remove `/internal/room-secret` endpoint                                                                                        | Task 5                    |
| Remove `encryptedWebhookSecret` from room config schema, store, API contracts                                                  | Tasks 6–7                 |
| Remove `webhookSecret` field from dashboard create/edit forms                                                                  | Tasks 8–9                 |
| Simplify webhook stepper from 6 steps to 5 steps                                                                               | Task 10                   |
| Remove env vars: `CHATWORK_SKIP_SIGNATURE_VERIFY`, `INTERNAL_API_SECRET`, `TRANSLATOR_INTERNAL_URL`                            | Tasks 2, 5, 11            |
| Delete `data/room-configs.json`                                                                                                | Task 7                    |
| Update docs: `ai_rules/security.md`, `.env.example`, `docker-compose.yml`, `docker-compose.dev.yml`, `docs/manual-e2e-test.md` | Task 11                   |
| `scripts/dev.test.ts` line 404 assertion                                                                                       | Task 11                   |
| `TRANSLATOR_URL` kept (still needed)                                                                                           | env.ts in Task 2 keeps it |
| `encryption.ts` and `ROOM_CONFIG_ENCRYPTION_KEY` kept                                                                          | Not touched in any task   |

No gaps found.
