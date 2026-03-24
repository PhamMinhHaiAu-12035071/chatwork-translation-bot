import { createHmac } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { webhookRoutes as WebhookRoutesType } from './webhook'

// Use a base64-encoded secret to mirror Chatwork's real token format
const TEST_SECRET = Buffer.from('test-webhook-secret').toString('base64')

function makeSignature(rawBody: string, secret = TEST_SECRET): string {
  return createHmac('sha256', Buffer.from(secret, 'base64')).update(rawBody).digest('base64')
}

function makeValidEvent(eventType: 'message_created' | 'message_updated' = 'message_created') {
  return {
    webhook_setting_id: '12345',
    webhook_event_type: eventType,
    webhook_event_time: 1498028130,
    webhook_event: {
      message_id: '789012345',
      room_id: 567890123,
      account_id: 123456,
      body: 'Hello World',
      send_time: 1498028125,
      update_time: eventType === 'message_updated' ? 1498028130 : 0,
    },
  }
}

// Mock env before importing route
void mock.module('../env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
    CHATWORK_WEBHOOK_SECRET: TEST_SECRET,
    CHATWORK_SKIP_SIGNATURE_VERIFY: false,
  },
}))

// Mock fetch to avoid real HTTP calls to translator
const mockFetch = mock(() => Promise.resolve(new Response('OK', { status: 200 })))
global.fetch = mockFetch as unknown as typeof fetch
const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

describe('webhookRoutes', () => {
  let webhookRoutes: typeof WebhookRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  const validEvent = makeValidEvent()

  beforeAll(async () => {
    const mod = await import('./webhook')
    webhookRoutes = mod.webhookRoutes
    app = new Elysia().use(webhookRoutes)
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    consoleLogLines.length = 0
    mockFetch.mockClear()
  })

  it('POST /webhook with valid raw body + valid HMAC signature returns 200 and forwards neutral DTO', async () => {
    const rawBody = JSON.stringify(validEvent)
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(200)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(0)

    // Check that forwarded body contains the neutral DTO fields (not raw ChatworkWebhookEvent)
    const forwardedCalls = mockFetch.mock.calls as unknown as [string, RequestInit][]
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const forwardedCall = forwardedCalls[0]!
    const forwardedBody = JSON.parse(forwardedCall[1].body as string) as Record<string, unknown>
    expect(forwardedBody).toHaveProperty('command')
    const command = forwardedBody['command'] as Record<string, unknown>
    expect(command['sourceSystem']).toBe('chatwork')
    expect(command['sourceMessageId']).toBe('789012345')
    expect(command['sourceRoomId']).toBe(567890123)
    expect(command['sourceEventId']).toBe('789012345:message_created:1498028130')
    expect(command['sourceEventType']).toBe('message_created')
    expect(command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook accepts message_updated and forwards enriched neutral DTO fields', async () => {
    const rawBody = JSON.stringify(makeValidEvent('message_updated'))
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(200)

    const forwardedCalls = mockFetch.mock.calls as unknown as [string, RequestInit][]
    const forwardedCall = forwardedCalls[0]
    const forwardedBody = JSON.parse(forwardedCall?.[1].body as string) as {
      command: Record<string, unknown>
    }

    expect(forwardedBody.command['sourceEventId']).toBe('789012345:message_updated:1498028130')
    expect(forwardedBody.command['sourceEventType']).toBe('message_updated')
    expect(forwardedBody.command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook missing X-ChatWorkWebhookSignature header returns 422', async () => {
    const rawBody = JSON.stringify(validEvent)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(422)
  })

  it('POST /webhook with invalid signature returns 422', async () => {
    const rawBody = JSON.stringify(validEvent)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': 'invalidsignature==',
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(422)
  })

  it('POST /webhook with valid signature but malformed JSON body returns 422', async () => {
    const rawBody = 'not-valid-json'
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(422)
  })

  it('POST /webhook with valid signature + valid JSON but missing required fields returns 422', async () => {
    const rawBody = JSON.stringify({ invalid: 'payload' })
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(422)
  })

  it('POST /webhook forwards neutral DTO and logs completion', async () => {
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log

    const rawBody = JSON.stringify(validEvent)
    const sig = makeSignature(rawBody)

    await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(mockFetch.mock.calls.length).toBeGreaterThan(0)
    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string })
    expect(jsonLogs.some((entry) => entry.event === 'webhook_received')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_started')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_completed')).toBe(true)
  })

  it('returns 503 when translator is not reachable (network error)', async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('fetch failed')))

    const rawBody = JSON.stringify(validEvent)
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(503)
  })

  it('returns 502 when translator returns non-2xx', async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(new Response('error', { status: 500 })))

    const rawBody = JSON.stringify(validEvent)
    const sig = makeSignature(rawBody)

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(502)
  })

  it('logs translation_forward_failed when translator forwarding rejects', async () => {
    console.error = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('translator down')))

    const rawBody = JSON.stringify(validEvent)
    const sig = makeSignature(rawBody)

    await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': sig,
        },
        body: rawBody,
      }),
    )

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string; errorMessage?: string })
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_failed')).toBe(true)
  })
})

describe('webhookRoutes – CHATWORK_SKIP_SIGNATURE_VERIFY', () => {
  it('bypasses verification in development when CHATWORK_SKIP_SIGNATURE_VERIFY=true and logs warning', async () => {
    const warnLines: string[] = []
    console.warn = mock((...args: unknown[]) => {
      warnLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.warn

    // Mock env with skip=true and non-production
    void mock.module('../env', () => ({
      env: {
        LOGGER_PORT: 3001,
        TRANSLATOR_URL: 'http://localhost:3000',
        NODE_ENV: 'development',
        CHATWORK_WEBHOOK_SECRET: TEST_SECRET,
        CHATWORK_SKIP_SIGNATURE_VERIFY: true,
      },
    }))

    // Re-import to pick up new mock
    const { webhookRoutes: devRoutes } = await import('./webhook')
    const devApp = new Elysia().use(devRoutes)

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

    // Send with a wrong signature — should still pass due to skip
    const res = await devApp.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': 'wrong-sig',
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(200)
    const hasWarnLog = warnLines.some(
      (line) => line.includes('bypass') || line.includes('Bypass') || line.includes('verification'),
    )
    expect(hasWarnLog).toBe(true)
  })

  it('does NOT bypass verification in production even when CHATWORK_SKIP_SIGNATURE_VERIFY=true', async () => {
    void mock.module('../env', () => ({
      env: {
        LOGGER_PORT: 3001,
        TRANSLATOR_URL: 'http://localhost:3000',
        NODE_ENV: 'production',
        CHATWORK_WEBHOOK_SECRET: TEST_SECRET,
        CHATWORK_SKIP_SIGNATURE_VERIFY: true,
      },
    }))

    const { webhookRoutes: prodRoutes } = await import('./webhook')
    const prodApp = new Elysia().use(prodRoutes)

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

    // Send with a wrong signature — production should still reject it
    const res = await prodApp.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatWorkWebhookSignature': 'wrong-sig',
        },
        body: rawBody,
      }),
    )

    expect(res.status).toBe(422)
  })
})
