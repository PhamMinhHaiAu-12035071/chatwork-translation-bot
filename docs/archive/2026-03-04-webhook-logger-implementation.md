# Webhook Logger & Core Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `@chatwork-bot/webhook-logger` package and refactor `@chatwork-bot/core` to share Chatwork client + HMAC verify between bot and logger.

**Architecture:** Refactor shared code (Chatwork REST client, HMAC signature verify) into `@chatwork-bot/core`. Create new `@chatwork-bot/webhook-logger` package — a standalone Bun HTTP server that receives Chatwork webhook events and logs raw JSON + metadata to terminal. Fix signature verification to match Chatwork docs (`x-chatworkwebhooksignature` + Base64).

**Tech Stack:** Bun, TypeScript (strict), Zod, Web Crypto API, localtunnel

---

## Task 1: Add `verifyWebhookSignature` to core

**Files:**

- Create: `packages/core/src/webhook/verify.ts`
- Test: `packages/core/src/webhook/verify.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/webhook/verify.test.ts
import { describe, expect, it } from 'bun:test'
import { verifyWebhookSignature } from './verify'

describe('verifyWebhookSignature', () => {
  // Generate a known test vector:
  // secret (Base64) = Base64Encode("test-secret-key-1234")
  // = "dGVzdC1zZWNyZXQta2V5LTEyMzQ="
  const testSecret = 'dGVzdC1zZWNyZXQta2V5LTEyMzQ='
  const testBody = '{"webhook_event_type":"message_created"}'

  it('returns true for valid signature', async () => {
    // Pre-compute: HMAC-SHA256(Base64Decode(testSecret), testBody) → Base64
    const keyBytes = Uint8Array.from(atob(testSecret), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(testBody))
    const validSignature = btoa(String.fromCharCode(...new Uint8Array(sig)))

    const result = await verifyWebhookSignature(testBody, validSignature, testSecret)
    expect(result).toBe(true)
  })

  it('returns false for invalid signature', async () => {
    const result = await verifyWebhookSignature(testBody, 'invalid-signature', testSecret)
    expect(result).toBe(false)
  })

  it('returns false for empty signature', async () => {
    const result = await verifyWebhookSignature(testBody, '', testSecret)
    expect(result).toBe(false)
  })

  it('returns false for tampered body', async () => {
    const keyBytes = Uint8Array.from(atob(testSecret), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(testBody))
    const validSignature = btoa(String.fromCharCode(...new Uint8Array(sig)))

    const result = await verifyWebhookSignature('tampered body', validSignature, testSecret)
    expect(result).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/webhook/verify.test.ts`
Expected: FAIL with "Cannot find module" or similar

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/webhook/verify.ts

/**
 * Verify Chatwork webhook signature.
 *
 * Chatwork sends `x-chatworkwebhooksignature` header containing
 * Base64(HMAC-SHA256(Base64Decode(token), requestBody)).
 *
 * @param body - raw request body string
 * @param signature - value from x-chatworkwebhooksignature header
 * @param secret - webhook token (Base64 encoded, from Chatwork settings)
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature) return false

  try {
    // Decode the Base64-encoded secret token
    const secretBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const hmac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))

    const expected = btoa(String.fromCharCode(...new Uint8Array(hmac)))

    return timingSafeEqual(expected, signature)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0)
  }

  return result === 0
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/core/src/webhook/verify.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/webhook/
git commit -m "feat(core): add verifyWebhookSignature with Base64 HMAC-SHA256"
```

---

## Task 2: Add `ChatworkClient` class to core

**Files:**

- Create: `packages/core/src/chatwork/client.ts`
- Test: `packages/core/src/chatwork/client.test.ts`
- Modify: `packages/core/src/types/chatwork.ts` (add response types)

**Step 1: Add response types to chatwork.ts**

Add to end of `packages/core/src/types/chatwork.ts`:

```typescript
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

**Step 2: Write the failing test**

```typescript
// packages/core/src/chatwork/client.test.ts
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ChatworkClient } from './client'

describe('ChatworkClient', () => {
  let client: ChatworkClient
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new ChatworkClient({ apiToken: 'test-token' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('sendMessage', () => {
    it('sends POST to correct endpoint with form-encoded body', async () => {
      let capturedUrl = ''
      let capturedInit: RequestInit | undefined

      globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
        capturedUrl = input.toString()
        capturedInit = init
        return new Response(JSON.stringify({ message_id: '123' }), { status: 200 })
      }) as typeof fetch

      await client.sendMessage({ roomId: 42, message: 'hello' })

      expect(capturedUrl).toBe('https://api.chatwork.com/v2/rooms/42/messages')
      expect(capturedInit?.method).toBe('POST')
      expect(capturedInit?.headers).toEqual(
        expect.objectContaining({ 'X-ChatWorkToken': 'test-token' }),
      )

      const bodyStr = capturedInit?.body?.toString() ?? ''
      expect(bodyStr).toContain('body=hello')
      expect(bodyStr).toContain('self_unread=0')
    })

    it('throws on non-2xx response', async () => {
      globalThis.fetch = mock(async () => {
        return new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      }) as typeof fetch

      await expect(client.sendMessage({ roomId: 42, message: 'hello' })).rejects.toThrow(
        'Chatwork API error',
      )
    })

    it('sends self_unread=1 when unread is true', async () => {
      let capturedInit: RequestInit | undefined

      globalThis.fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
        capturedInit = init
        return new Response(JSON.stringify({ message_id: '123' }), { status: 200 })
      }) as typeof fetch

      await client.sendMessage({ roomId: 42, message: 'hello', unread: true })

      const bodyStr = capturedInit?.body?.toString() ?? ''
      expect(bodyStr).toContain('self_unread=1')
    })
  })

  describe('constructor', () => {
    it('uses default base URL', () => {
      const c = new ChatworkClient({ apiToken: 'tok' })
      expect(c).toBeDefined()
    })

    it('accepts custom base URL', () => {
      const c = new ChatworkClient({ apiToken: 'tok', baseUrl: 'https://custom.api' })
      expect(c).toBeDefined()
    })
  })
})
```

**Step 3: Run test to verify it fails**

Run: `bun test packages/core/src/chatwork/client.test.ts`
Expected: FAIL with "Cannot find module"

**Step 4: Write implementation**

```typescript
// packages/core/src/chatwork/client.ts
import type { ChatworkSendMessageResponse } from '../types/chatwork'

const DEFAULT_BASE_URL = 'https://api.chatwork.com/v2'

export interface ChatworkClientConfig {
  apiToken: string
  baseUrl?: string
}

export interface SendMessageParams {
  roomId: number
  message: string
  unread?: boolean
}

export class ChatworkClient {
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(config: ChatworkClientConfig) {
    this.apiToken = config.apiToken
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  }

  async sendMessage({
    roomId,
    message,
    unread = false,
  }: SendMessageParams): Promise<ChatworkSendMessageResponse> {
    const url = `${this.baseUrl}/rooms/${roomId.toString()}/messages`

    const body = new URLSearchParams({
      body: message,
      self_unread: unread ? '1' : '0',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': this.apiToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Chatwork API error: ${response.status.toString()} ${response.statusText} - ${errorText}`,
      )
    }

    return (await response.json()) as ChatworkSendMessageResponse
  }
}
```

**Step 5: Run test to verify it passes**

Run: `bun test packages/core/src/chatwork/client.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/core/src/chatwork/ packages/core/src/types/chatwork.ts
git commit -m "feat(core): add ChatworkClient class with sendMessage"
```

---

## Task 3: Update core barrel export

**Files:**

- Modify: `packages/core/src/index.ts`

**Step 1: Update index.ts to re-export new modules**

Replace `packages/core/src/index.ts` with:

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
export { isChatworkMessageEvent } from './types/chatwork'

export type { ParsedCommand, SupportedLang } from './types/command'
export { SUPPORTED_LANGUAGES, isSupportedLang } from './types/command'

// Interfaces
export type { ITranslationService, TranslationResult } from './interfaces/translation'
export { TranslationError } from './interfaces/translation'

// Services
export { MockTranslationService } from './services/mock-translation'

// Chatwork client
export { ChatworkClient } from './chatwork/client'
export type { ChatworkClientConfig, SendMessageParams } from './chatwork/client'

// Webhook utilities
export { verifyWebhookSignature } from './webhook/verify'

// Utils
export { parseCommand } from './utils/parse-command'
```

**Step 2: Run typecheck on core**

Run: `bun run --cwd packages/core typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): re-export ChatworkClient and verifyWebhookSignature"
```

---

## Task 4: Update bot to import from core

**Files:**

- Modify: `packages/bot/src/webhook/router.ts`
- Modify: `packages/bot/src/webhook/handler.ts`
- Delete: `packages/bot/src/chatwork/client.ts`
- Delete: `packages/bot/src/webhook/verify.ts`

**Step 1: Update router.ts**

Replace `packages/bot/src/webhook/router.ts` with:

```typescript
import { verifyWebhookSignature } from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'
import { handleWebhookEvent } from './handler'

export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  if (request.method === 'POST' && url.pathname === '/webhook') {
    return handleWebhookRequest(request)
  }

  return new Response('Not Found', { status: 404 })
}

async function handleWebhookRequest(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const signature = request.headers.get('x-chatworkwebhooksignature')

  if (!signature) {
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifyWebhookSignature(rawBody, signature, env.CHATWORK_WEBHOOK_SECRET)
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 })
  }

  let event: ChatworkWebhookEvent
  try {
    event = JSON.parse(rawBody) as ChatworkWebhookEvent
  } catch {
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  void handleWebhookEvent(event).catch((error: unknown) => {
    console.error('[router] Background handler error:', error)
  })

  return new Response('OK', { status: 200 })
}
```

**Step 2: Update handler.ts**

Replace `packages/bot/src/webhook/handler.ts` with:

```typescript
import {
  ChatworkClient,
  isChatworkMessageEvent,
  MockTranslationService,
  parseCommand,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'

const translationService = new MockTranslationService()
const chatwork = new ChatworkClient({ apiToken: env.CHATWORK_API_TOKEN })

export async function handleWebhookEvent(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) return

  const { room_id: roomId, account_id: accountId, body } = event.webhook_event

  const command = parseCommand(body)
  if (!command) return

  try {
    const result = await translationService.translate(command.targetLang, command.text)

    const replyMessage = [
      `[To:${accountId.toString()}]`,
      `Translation (auto -> ${command.targetLang}):`,
      result.translatedText,
    ].join('\n')

    await chatwork.sendMessage({ roomId, message: replyMessage })
  } catch (error) {
    if (error instanceof TranslationError) {
      const errorMessage = [
        `[To:${accountId.toString()}]`,
        `Translation failed: ${error.message}`,
      ].join('\n')

      await chatwork.sendMessage({ roomId, message: errorMessage })
      return
    }

    console.error('[handler] Unexpected error:', error)
  }
}
```

**Step 3: Delete old files**

```bash
rm packages/bot/src/chatwork/client.ts
rmdir packages/bot/src/chatwork
rm packages/bot/src/webhook/verify.ts
```

**Step 4: Run typecheck on bot**

Run: `bun run --cwd packages/bot typecheck`
Expected: No errors (if errors about empty chatwork dir, that's fine — dir is gone)

**Step 5: Run all existing tests**

Run: `bun test`
Expected: All existing tests PASS (parse-command tests)

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(bot): use ChatworkClient and verifyWebhookSignature from core"
```

---

## Task 5: Create webhook-logger package scaffold

**Files:**

- Create: `packages/webhook-logger/package.json`
- Create: `packages/webhook-logger/tsconfig.json`
- Create: `packages/webhook-logger/src/env.ts`

**Step 1: Create package.json**

```json
{
  "name": "@chatwork-bot/webhook-logger",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@core/*": ["../core/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create env.ts**

```typescript
// packages/webhook-logger/src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  CHATWORK_WEBHOOK_SECRET: z.string().min(1, 'CHATWORK_WEBHOOK_SECRET is required'),
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
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

**Step 4: Install deps**

Run: `bun install`
Expected: Lockfile updated with new workspace package

**Step 5: Commit**

```bash
git add packages/webhook-logger/
git commit -m "feat(webhook-logger): scaffold package with env validation"
```

---

## Task 6: Implement webhook-logger server + routes

**Files:**

- Create: `packages/webhook-logger/src/routes/webhook.ts`
- Create: `packages/webhook-logger/src/server.ts`
- Create: `packages/webhook-logger/src/index.ts`

**Step 1: Create webhook route handler**

```typescript
// packages/webhook-logger/src/routes/webhook.ts
import { verifyWebhookSignature } from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'

export async function handleWebhookRoute(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const signature = request.headers.get('x-chatworkwebhooksignature')

  if (!signature) {
    console.log('[webhook] Rejected: missing signature header')
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifyWebhookSignature(rawBody, signature, env.CHATWORK_WEBHOOK_SECRET)
  if (!isValid) {
    console.log('[webhook] Rejected: invalid signature')
    return new Response('Unauthorized', { status: 401 })
  }

  let event: ChatworkWebhookEvent
  try {
    event = JSON.parse(rawBody) as ChatworkWebhookEvent
  } catch {
    console.log('[webhook] Rejected: invalid JSON')
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  // Log the full event with metadata
  console.log('\n------- WEBHOOK EVENT -------')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Headers:', Object.fromEntries(request.headers))
  console.dir(event, { depth: null, colors: true })
  console.log('-----------------------------\n')

  return new Response('OK', { status: 200 })
}
```

**Step 2: Create server.ts**

```typescript
// packages/webhook-logger/src/server.ts
import { env } from './env'
import { handleWebhookRoute } from './routes/webhook'

function router(request: Request): Response | Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  if (request.method === 'POST' && url.pathname === '/webhook') {
    return handleWebhookRoute(request)
  }

  return new Response('Not Found', { status: 404 })
}

export function createServer() {
  return Bun.serve({
    port: env.LOGGER_PORT,
    hostname: '0.0.0.0',
    fetch: router,
    error(error) {
      console.error('[server] Unhandled error:', error)
      return new Response('Internal Server Error', { status: 500 })
    },
  })
}
```

**Step 3: Create index.ts**

```typescript
// packages/webhook-logger/src/index.ts
import { env } from './env'
import { createServer } from './server'

const server = createServer()

console.log(`[webhook-logger] Listening on http://0.0.0.0:${env.LOGGER_PORT.toString()}`)
console.log(`[webhook-logger] Health check: http://localhost:${env.LOGGER_PORT.toString()}/health`)
console.log(
  `[webhook-logger] Webhook endpoint: http://localhost:${env.LOGGER_PORT.toString()}/webhook`,
)
console.log('[webhook-logger] Waiting for Chatwork webhook events...\n')

function shutdown() {
  console.log('\n[webhook-logger] Shutting down...')
  server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Step 4: Run typecheck**

Run: `bun run --cwd packages/webhook-logger typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/
git commit -m "feat(webhook-logger): implement server with webhook route and logging"
```

---

## Task 7: Add root scripts and update configs

**Files:**

- Modify: `package.json` (root)
- Modify: `.env.example`
- Modify: `tsconfig.base.json` (add webhook-logger path alias)

**Step 1: Add scripts to root package.json**

Add to `"scripts"` section in root `package.json`:

```json
"logger": "bun run --hot packages/webhook-logger/src/index.ts",
"tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger"
```

Also update `typecheck` script to include webhook-logger:

```json
"typecheck": "tsc --noEmit -p tsconfig.base.json && tsc --noEmit -p packages/core/tsconfig.json && tsc --noEmit -p packages/bot/tsconfig.json && tsc --noEmit -p packages/webhook-logger/tsconfig.json"
```

**Step 2: Update .env.example**

Replace `.env.example` with:

```bash
# Chatwork API Configuration
CHATWORK_API_TOKEN=your_chatwork_api_token_here
CHATWORK_WEBHOOK_SECRET=your_webhook_secret_here

# Bot Server Configuration
PORT=3000
NODE_ENV=development

# Webhook Logger Configuration (optional)
LOGGER_PORT=3001
```

**Step 3: Commit**

```bash
git add package.json .env.example
git commit -m "chore: add logger scripts and update env example"
```

---

## Task 8: Write webhook-logger route test

**Files:**

- Create: `packages/webhook-logger/src/routes/webhook.test.ts`

**Step 1: Write test**

```typescript
// packages/webhook-logger/src/routes/webhook.test.ts
import { describe, expect, it } from 'bun:test'
import { handleWebhookRoute } from './webhook'

// Helper: generate valid signature for a body using a known secret
async function generateSignature(body: string, secret: string): Promise<string> {
  const secretBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

describe('handleWebhookRoute', () => {
  // Must match CHATWORK_WEBHOOK_SECRET in env
  // This test requires the env var to be set
  const testSecret = process.env['CHATWORK_WEBHOOK_SECRET'] ?? ''

  const sampleEvent = JSON.stringify({
    webhook_setting_id: '123',
    webhook_event_type: 'message_created',
    webhook_event_time: 1709542200,
    webhook_event: {
      message_id: '456',
      room_id: 424846369,
      account_id: 789,
      body: 'test message',
      send_time: 1709542200,
      update_time: 1709542200,
    },
  })

  it('returns 401 when signature header is missing', async () => {
    const request = new Request('http://localhost/webhook', {
      method: 'POST',
      body: sampleEvent,
    })

    const response = await handleWebhookRoute(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 when signature is invalid', async () => {
    const request = new Request('http://localhost/webhook', {
      method: 'POST',
      body: sampleEvent,
      headers: {
        'x-chatworkwebhooksignature': 'invalid',
      },
    })

    const response = await handleWebhookRoute(request)
    expect(response.status).toBe(401)
  })

  it('returns 200 and logs event when signature is valid', async () => {
    if (!testSecret) {
      console.log('Skipping: CHATWORK_WEBHOOK_SECRET not set')
      return
    }

    const signature = await generateSignature(sampleEvent, testSecret)
    const request = new Request('http://localhost/webhook', {
      method: 'POST',
      body: sampleEvent,
      headers: {
        'x-chatworkwebhooksignature': signature,
        'content-type': 'application/json',
      },
    })

    const response = await handleWebhookRoute(request)
    expect(response.status).toBe(200)
  })

  it('returns 400 for invalid JSON with valid signature', async () => {
    if (!testSecret) {
      console.log('Skipping: CHATWORK_WEBHOOK_SECRET not set')
      return
    }

    const invalidBody = 'not json'
    const signature = await generateSignature(invalidBody, testSecret)
    const request = new Request('http://localhost/webhook', {
      method: 'POST',
      body: invalidBody,
      headers: {
        'x-chatworkwebhooksignature': signature,
        'content-type': 'application/json',
      },
    })

    const response = await handleWebhookRoute(request)
    expect(response.status).toBe(400)
  })
})
```

**Step 2: Run tests**

Run: `bun test packages/webhook-logger/`
Expected: Tests pass (401 tests always pass, 200/400 tests skip if no secret)

**Step 3: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.test.ts
git commit -m "test(webhook-logger): add webhook route handler tests"
```

---

## Task 9: Full verification

**Step 1: Run all typecheck**

Run: `bun run typecheck`
Expected: No errors across all packages

**Step 2: Run all lint**

Run: `bun run lint`
Expected: No errors (or only pre-existing ones)

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass (core: parse-command + verify + client, webhook-logger: webhook route)

**Step 4: Verify logger starts**

Run: `CHATWORK_WEBHOOK_SECRET=dGVzdA== bun run packages/webhook-logger/src/index.ts`
Expected: Server starts, prints listening message on port 3001
Kill with Ctrl+C.

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix issues from full verification"
```

---

## Summary

| Task | Description                        | Est. Steps |
| ---- | ---------------------------------- | ---------- |
| 1    | Add verifyWebhookSignature to core | 5          |
| 2    | Add ChatworkClient to core         | 6          |
| 3    | Update core barrel export          | 3          |
| 4    | Update bot to import from core     | 6          |
| 5    | Scaffold webhook-logger package    | 5          |
| 6    | Implement logger server + routes   | 5          |
| 7    | Add root scripts + configs         | 3          |
| 8    | Write webhook-logger tests         | 3          |
| 9    | Full verification                  | 5          |

**Total: 9 tasks, ~41 steps**
