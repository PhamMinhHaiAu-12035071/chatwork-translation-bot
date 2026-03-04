import { beforeAll, describe, expect, it, mock } from 'bun:test'
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
