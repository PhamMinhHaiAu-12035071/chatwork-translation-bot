import { createHmac } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { webhookRoutes as WebhookRoutesType } from './webhook'

const TEST_SECRET = Buffer.from('test-webhook-secret').toString('base64')
const INTERNAL_API_SECRET = 'internal-secret'
const TRANSLATOR_URL = 'http://localhost:3000'
const ROOM_ID = 567890123
type FetchInput = string | URL | Request
type FetchCall = [FetchInput, RequestInit | undefined]

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
      room_id: ROOM_ID,
      account_id: 123456,
      body: 'Hello World',
      send_time: 1498028125,
      update_time: eventType === 'message_updated' ? 1498028130 : 0,
    },
  }
}

function roomSecretUrl(roomId = ROOM_ID): string {
  return `${TRANSLATOR_URL}/internal/room-secret?room_id=${roomId.toString()}`
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function resolveUrl(input: FetchInput): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function getFetchCall(index: number): FetchCall {
  const call = mockFetch.mock.calls[index] as FetchCall | undefined

  if (call === undefined) {
    throw new Error(`Expected fetch call at index ${index.toString()}`)
  }

  return call
}

function getJsonBody(call: FetchCall): string {
  const body = call[1]?.body

  if (typeof body !== 'string') {
    throw new Error('Expected fetch call body to be a JSON string')
  }

  return body
}

function makeRequest(rawBody: string, signature?: string): Request {
  return new Request('http://localhost/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature !== undefined ? { 'X-ChatWorkWebhookSignature': signature } : {}),
    },
    body: rawBody,
  })
}

function installDefaultFetch(): void {
  mockFetch.mockImplementation((input: FetchInput) => {
    const url = resolveUrl(input)

    if (url === roomSecretUrl()) {
      return Promise.resolve(makeJsonResponse({ secret: TEST_SECRET }))
    }

    if (url === `${TRANSLATOR_URL}/internal/translate`) {
      return Promise.resolve(new Response('OK', { status: 200 }))
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })
}

const mockEnv: {
  LOGGER_PORT: number
  TRANSLATOR_URL: string
  TRANSLATOR_INTERNAL_URL: string
  NODE_ENV: 'development' | 'production' | 'test' | 'local'
  INTERNAL_API_SECRET: string
  CHATWORK_SKIP_SIGNATURE_VERIFY: boolean
} = {
  LOGGER_PORT: 3001,
  TRANSLATOR_URL,
  TRANSLATOR_INTERNAL_URL: TRANSLATOR_URL,
  NODE_ENV: 'test',
  INTERNAL_API_SECRET,
  CHATWORK_SKIP_SIGNATURE_VERIFY: false,
}

void mock.module('../env', () => ({
  env: mockEnv,
}))

const mockFetch = mock((_input: FetchInput, _init?: RequestInit) =>
  Promise.resolve(new Response('OK', { status: 200 })),
)
global.fetch = mockFetch as unknown as typeof fetch

const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
let webhookRoutes: typeof WebhookRoutesType
let app: ReturnType<typeof Elysia.prototype.use>
let resetRoomSecretCacheForTest: () => void

describe('webhookRoutes', () => {
  beforeAll(async () => {
    const mod = await import('./webhook')
    webhookRoutes = mod.webhookRoutes
    resetRoomSecretCacheForTest = mod.resetRoomSecretCacheForTest
    app = new Elysia().use(webhookRoutes)
  })

  describe('room secret cache', () => {
    it('does not fetch the same room secret again within TTL', async () => {
      const rawBody = JSON.stringify(makeValidEvent())
      const sig = makeSignature(rawBody)

      const firstRes = await app.handle(makeRequest(rawBody, sig))
      const secondRes = await app.handle(makeRequest(rawBody, sig))

      expect(firstRes.status).toBe(200)
      expect(secondRes.status).toBe(200)

      const secretFetchCalls = mockFetch.mock.calls.filter(
        (call) => resolveUrl(call[0]) === roomSecretUrl(),
      )
      expect(secretFetchCalls).toHaveLength(1)
    })

    it('serves a cached room secret when the translator internal API is down', async () => {
      const rawBody = JSON.stringify(makeValidEvent())
      const sig = makeSignature(rawBody)

      const firstRes = await app.handle(makeRequest(rawBody, sig))
      expect(firstRes.status).toBe(200)

      mockFetch.mockImplementation((input: FetchInput) => {
        const url = resolveUrl(input)

        if (url === roomSecretUrl()) {
          return Promise.reject(new Error('secret service unavailable'))
        }

        if (url === `${TRANSLATOR_URL}/internal/translate`) {
          return Promise.resolve(new Response('OK', { status: 200 }))
        }

        throw new Error(`Unexpected fetch URL: ${url}`)
      })

      const secondRes = await app.handle(makeRequest(rawBody, sig))

      expect(secondRes.status).toBe(200)
    })

    it('returns 503 when the translator internal API is unavailable for a cache miss', async () => {
      const roomId = ROOM_ID + 1
      const event = makeValidEvent()
      const rawBody = JSON.stringify({
        ...event,
        webhook_event: {
          ...event.webhook_event,
          room_id: roomId,
        },
      })

      mockFetch.mockImplementation((input: FetchInput) => {
        const url = resolveUrl(input)

        if (url === roomSecretUrl(roomId)) {
          return Promise.reject(new Error('secret service unavailable'))
        }

        if (url === `${TRANSLATOR_URL}/internal/translate`) {
          return Promise.resolve(new Response('OK', { status: 200 }))
        }

        throw new Error(`Unexpected fetch URL: ${url}`)
      })

      const sig = makeSignature(rawBody)
      const res = await app.handle(makeRequest(rawBody, sig))

      expect(res.status).toBe(503)
    })

    it('refetches the room secret after the cache entry expires', async () => {
      const originalNow = Date.now
      let now = 1_000_000
      Date.now = () => now

      try {
        const rawBody = JSON.stringify(makeValidEvent())
        const sig = makeSignature(rawBody)

        const firstRes = await app.handle(makeRequest(rawBody, sig))
        expect(firstRes.status).toBe(200)

        now += 60_001

        const secondRes = await app.handle(makeRequest(rawBody, sig))
        expect(secondRes.status).toBe(200)

        const secretFetchCalls = mockFetch.mock.calls.filter(
          (call) => resolveUrl(call[0]) === roomSecretUrl(),
        )
        expect(secretFetchCalls).toHaveLength(2)
      } finally {
        Date.now = originalNow
      }
    })
  })

  beforeEach(() => {
    installDefaultFetch()
    resetRoomSecretCacheForTest()
    mockEnv.NODE_ENV = 'test'
    mockEnv.CHATWORK_SKIP_SIGNATURE_VERIFY = false
    mockEnv.TRANSLATOR_URL = TRANSLATOR_URL
    mockEnv.TRANSLATOR_INTERNAL_URL = TRANSLATOR_URL
    mockEnv.INTERNAL_API_SECRET = INTERNAL_API_SECRET
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    consoleLogLines.length = 0
    mockFetch.mockReset()
    resetRoomSecretCacheForTest()
  })

  it('POST /webhook fetches the per-room secret before forwarding the neutral DTO', async () => {
    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(200)
    expect(mockFetch.mock.calls).toHaveLength(2)

    const firstCall = getFetchCall(0)
    const secondCall = getFetchCall(1)

    expect(resolveUrl(firstCall[0])).toBe(roomSecretUrl())
    expect(firstCall[1]?.headers).toMatchObject({
      'x-internal-secret': INTERNAL_API_SECRET,
    })
    expect(resolveUrl(secondCall[0])).toBe(`${TRANSLATOR_URL}/internal/translate`)

    const forwardedBody = JSON.parse(getJsonBody(secondCall)) as {
      command: Record<string, unknown>
    }
    expect(forwardedBody.command['sourceSystem']).toBe('chatwork')
    expect(forwardedBody.command['sourceMessageId']).toBe('789012345')
    expect(forwardedBody.command['sourceRoomId']).toBe(ROOM_ID)
    expect(forwardedBody.command['sourceEventId']).toBe('789012345:message_created:1498028130')
    expect(forwardedBody.command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook accepts message_updated payloads after secret lookup succeeds', async () => {
    const rawBody = JSON.stringify(makeValidEvent('message_updated'))
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(200)

    const forwardedBody = JSON.parse(getJsonBody(getFetchCall(1))) as {
      command: Record<string, unknown>
    }

    expect(forwardedBody.command['sourceEventId']).toBe('789012345:message_updated:1498028130')
    expect(forwardedBody.command['sourceEventType']).toBe('message_updated')
    expect(forwardedBody.command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook missing X-ChatWorkWebhookSignature header returns 422', async () => {
    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook returns 200 and skips when translator has no room config for room_id', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.resolve(new Response('not found', { status: 404 }))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const res = await app.handle(makeRequest(rawBody, 'wrong-signature-still-skips'))

    expect(res.status).toBe(200)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('POST /webhook with invalid signature returns 422 after fetching the room secret', async () => {
    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody, 'invalidsignature=='))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('POST /webhook returns 503 when room secret fetch fails with a network error', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.reject(new Error('secret service unavailable'))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(503)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('POST /webhook returns 503 when room secret fetch returns non-404 non-ok', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.resolve(new Response('error', { status: 500 }))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(503)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('POST /webhook with malformed JSON returns 422 when room_id cannot be extracted', async () => {
    const rawBody = 'not-valid-json'
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook with valid JSON but missing room fields returns 422 before secret fetch', async () => {
    const rawBody = JSON.stringify({ invalid: 'payload' })
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook fetches the room secret when room_id is only present in webhook_setting', async () => {
    const rawBody = JSON.stringify({
      webhook_setting: {
        room_id: ROOM_ID,
      },
      webhook_event_type: 'message_created',
      webhook_event_time: 1498028130,
      webhook_event: {
        message_id: '789012345',
        account_id: 123456,
        body: 'Hello World',
        send_time: 1498028125,
        update_time: 0,
      },
    })
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(422)
    expect(resolveUrl(getFetchCall(0)[0])).toBe(roomSecretUrl())
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('POST /webhook logs completion when secret fetch and forward both succeed', async () => {
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    await app.handle(makeRequest(rawBody, sig))

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string })

    expect(jsonLogs.some((entry) => entry.event === 'webhook_received')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_started')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_completed')).toBe(true)
  })

  it('returns 503 when translator forwarding is not reachable after secret fetch succeeds', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.resolve(makeJsonResponse({ secret: TEST_SECRET }))
      }

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.reject(new Error('fetch failed'))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(503)
    expect(mockFetch.mock.calls).toHaveLength(2)
  })

  it('returns 502 when translator returns non-2xx after secret fetch succeeds', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.resolve(makeJsonResponse({ secret: TEST_SECRET }))
      }

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.resolve(new Response('error', { status: 500 }))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    const res = await app.handle(makeRequest(rawBody, sig))

    expect(res.status).toBe(502)
    expect(mockFetch.mock.calls).toHaveLength(2)
  })

  it('logs translation_forward_failed when translator forwarding rejects', async () => {
    console.error = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error

    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === roomSecretUrl()) {
        return Promise.resolve(makeJsonResponse({ secret: TEST_SECRET }))
      }

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.reject(new Error('translator down'))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())
    const sig = makeSignature(rawBody)

    await app.handle(makeRequest(rawBody, sig))

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string })

    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_failed')).toBe(true)
  })
})

describe('webhookRoutes – CHATWORK_SKIP_SIGNATURE_VERIFY', () => {
  beforeEach(() => {
    installDefaultFetch()
    resetRoomSecretCacheForTest()
    mockEnv.NODE_ENV = 'test'
    mockEnv.CHATWORK_SKIP_SIGNATURE_VERIFY = false
  })

  afterEach(() => {
    console.warn = originalConsoleWarn
    mockFetch.mockReset()
    resetRoomSecretCacheForTest()
  })

  it('bypasses verification in development when CHATWORK_SKIP_SIGNATURE_VERIFY=true and logs warning', async () => {
    const warnLines: string[] = []
    console.warn = mock((...args: unknown[]) => {
      warnLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.warn

    mockEnv.NODE_ENV = 'development'
    mockEnv.CHATWORK_SKIP_SIGNATURE_VERIFY = true

    const rawBody = JSON.stringify(makeValidEvent())
    const res = await app.handle(makeRequest(rawBody, 'wrong-sig'))

    expect(res.status).toBe(200)
    expect(warnLines.some((line) => line.includes('verification'))).toBe(true)
  })

  it('does NOT bypass verification in production even when CHATWORK_SKIP_SIGNATURE_VERIFY=true', async () => {
    mockEnv.NODE_ENV = 'production'
    mockEnv.CHATWORK_SKIP_SIGNATURE_VERIFY = true

    const rawBody = JSON.stringify(makeValidEvent())
    const res = await app.handle(makeRequest(rawBody, 'wrong-sig'))

    expect(res.status).toBe(422)
  })
})
