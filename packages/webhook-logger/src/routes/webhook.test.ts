import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { webhookRoutes as WebhookRoutesType } from './webhook'

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
global.fetch = mockFetch as unknown as typeof fetch
const consoleLogLines: string[] = []
const originalConsoleLog = console.log
const originalConsoleError = console.error

describe('webhookRoutes', () => {
  let webhookRoutes: typeof WebhookRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  beforeAll(async () => {
    const mod = await import('./webhook')
    webhookRoutes = mod.webhookRoutes
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

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    consoleLogLines.length = 0
  })

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

  it('POST /webhook forwards event to translator and logs completion', async () => {
    console.log = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.log
    mockFetch.mockClear()
    await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
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
    mockFetch.mockClear()
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('fetch failed')))

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )

    expect(res.status).toBe(503)
  })

  it('returns 502 when translator returns non-2xx', async () => {
    mockFetch.mockClear()
    mockFetch.mockImplementationOnce(() => Promise.resolve(new Response('error', { status: 500 })))

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )

    expect(res.status).toBe(502)
  })

  it('logs translation_forward_failed when translator forwarding rejects', async () => {
    console.error = mock((...args: unknown[]) => {
      consoleLogLines.push(args.map((arg) => String(arg)).join(' '))
    }) as typeof console.error
    mockFetch.mockClear()
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('translator down')))

    await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )

    const jsonLogs = consoleLogLines
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { event: string; errorMessage?: string })
    expect(jsonLogs.some((entry) => entry.event === 'translation_forward_failed')).toBe(true)
  })
})
