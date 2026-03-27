import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { webhookRoutes as WebhookRoutesType } from './webhook'

const TRANSLATOR_URL = 'http://localhost:3000'
const ROOM_ID = 567890123
type FetchInput = string | URL | Request
type FetchCall = [FetchInput, RequestInit | undefined]

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

function makeRequest(rawBody: string): Request {
  return new Request('http://localhost/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: rawBody,
  })
}

function installDefaultFetch(): void {
  mockFetch.mockImplementation((input: FetchInput) => {
    const url = resolveUrl(input)

    if (url === `${TRANSLATOR_URL}/internal/translate`) {
      return Promise.resolve(new Response('OK', { status: 200 }))
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  })
}

const mockEnv: {
  LOGGER_PORT: number
  TRANSLATOR_URL: string
  NODE_ENV: 'development' | 'production' | 'test' | 'local'
} = {
  LOGGER_PORT: 3001,
  TRANSLATOR_URL,
  NODE_ENV: 'test',
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
let webhookRoutes: typeof WebhookRoutesType
let app: ReturnType<typeof Elysia.prototype.use>

describe('webhookRoutes', () => {
  beforeAll(async () => {
    const mod = await import('./webhook')
    webhookRoutes = mod.webhookRoutes
    app = new Elysia().use(webhookRoutes)
  })

  beforeEach(() => {
    installDefaultFetch()
    mockEnv.NODE_ENV = 'test'
    mockEnv.TRANSLATOR_URL = TRANSLATOR_URL
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    consoleLogLines.length = 0
    mockFetch.mockReset()
  })

  it('POST /webhook forwards the neutral DTO to translator', async () => {
    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(200)
    expect(mockFetch.mock.calls).toHaveLength(1)

    const [translateInput, translateInit] = getFetchCall(0)
    const translateHeaders = new Headers(translateInit?.headers)
    const traceHeader = translateHeaders.get('x-trace-id')

    expect(resolveUrl(translateInput)).toBe(`${TRANSLATOR_URL}/internal/translate`)
    expect(translateHeaders.get('Content-Type')).toBe('application/json')
    expect(typeof traceHeader).toBe('string')
    expect(traceHeader).not.toBe('')

    const forwardedBody = JSON.parse(getJsonBody(getFetchCall(0))) as {
      command: Record<string, unknown>
    }
    expect(forwardedBody.command['sourceSystem']).toBe('chatwork')
    expect(forwardedBody.command['sourceMessageId']).toBe('789012345')
    expect(forwardedBody.command['sourceRoomId']).toBe(ROOM_ID)
    expect(forwardedBody.command['sourceEventId']).toBe('789012345:message_created:1498028130')
    expect(forwardedBody.command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook accepts message_updated payloads', async () => {
    const rawBody = JSON.stringify(makeValidEvent('message_updated'))

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(200)

    const forwardedBody = JSON.parse(getJsonBody(getFetchCall(0))) as {
      command: Record<string, unknown>
    }

    expect(forwardedBody.command['sourceEventId']).toBe('789012345:message_updated:1498028130')
    expect(forwardedBody.command['sourceEventType']).toBe('message_updated')
    expect(forwardedBody.command['translationInputs']).toEqual(['Hello World'])
  })

  it('POST /webhook with malformed JSON returns 422', async () => {
    const rawBody = 'not-valid-json'

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook with valid JSON but missing room fields returns 422', async () => {
    const rawBody = JSON.stringify({ invalid: 'payload' })

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook with room_id only in webhook_setting returns 422', async () => {
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

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(422)
    expect(mockFetch.mock.calls).toHaveLength(0)
  })

  it('POST /webhook logs completion when forwarding succeeds', async () => {
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log

    const rawBody = JSON.stringify(makeValidEvent())

    await app.handle(makeRequest(rawBody))

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string })

    expect(jsonLogs.some((entry) => entry.event === 'webhook_received')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_started')).toBe(true)
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_completed')).toBe(true)
  })

  it('POST /webhook generates a trace id, logs receipt, and forwards x-trace-id to translator', async () => {
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log

    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(200)

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event?: string; traceId?: string })

    const webhookReceivedLog = jsonLogs.find((entry) => entry.event === 'webhook_received')

    expect(webhookReceivedLog).toMatchObject({
      event: 'webhook_received',
    })
    expect(typeof webhookReceivedLog?.traceId).toBe('string')
    expect(webhookReceivedLog?.traceId).not.toBe('')

    const translationStartLog = jsonLogs.find(
      (entry) => entry.event === 'translation_forward_started',
    )
    expect(translationStartLog?.traceId).toBe(webhookReceivedLog?.traceId)

    const [_, translateInit] = getFetchCall(0)
    const translateHeaders = new Headers(translateInit?.headers)
    expect(translateHeaders.get('Content-Type')).toBe('application/json')
    expect(translateHeaders.get('x-trace-id')).toBe(webhookReceivedLog?.traceId ?? null)
  })

  it('returns 503 when translator forwarding is not reachable', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.reject(new Error('fetch failed'))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(503)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('returns 502 when translator returns non-2xx', async () => {
    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.resolve(new Response('error', { status: 500 }))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())

    const res = await app.handle(makeRequest(rawBody))

    expect(res.status).toBe(502)
    expect(mockFetch.mock.calls).toHaveLength(1)
  })

  it('logs translation_forward_failed when translator forwarding rejects', async () => {
    console.error = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error

    mockFetch.mockImplementation((input: FetchInput) => {
      const url = resolveUrl(input)

      if (url === `${TRANSLATOR_URL}/internal/translate`) {
        return Promise.reject(new Error('translator down'))
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawBody = JSON.stringify(makeValidEvent())

    await app.handle(makeRequest(rawBody))

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string })

    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_failed')).toBe(true)
  })
})
