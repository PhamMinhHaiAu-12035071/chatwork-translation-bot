import { createHmac } from 'node:crypto'
import { describe, expect, it, mock } from 'bun:test'

// Use a base64-encoded secret to mirror Chatwork's real token format
const TEST_SECRET = Buffer.from('test-app-webhook-secret').toString('base64')
type FetchInput = string | URL | Request

function makeSignature(rawBody: string): string {
  return createHmac('sha256', Buffer.from(TEST_SECRET, 'base64')).update(rawBody).digest('base64')
}

void mock.module('./env', () => ({
  env: {
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
    TRANSLATOR_INTERNAL_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
    INTERNAL_API_SECRET: 'internal-secret',
    CHATWORK_SKIP_SIGNATURE_VERIFY: false,
  },
}))

global.fetch = mock((input: FetchInput) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  if (url === 'http://localhost:3000/internal/room-secret?room_id=567890123') {
    return Promise.resolve(
      new Response(JSON.stringify({ webhookSecret: TEST_SECRET }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  return Promise.resolve(new Response('OK'))
}) as unknown as typeof fetch

describe('createApp', () => {
  it('GET /health returns 200', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
  })

  it('POST /webhook with valid body and valid signature returns 200', async () => {
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
  })

  it('POST /webhook accepts message_updated payloads with a valid signature', async () => {
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
  })

  it('POST /webhook without signature returns 422', async () => {
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
    expect(res.status).toBe(422)
  })

  it('unknown route returns 404', async () => {
    const { createApp } = await import('./app')
    const app = createApp()
    const res = await app.handle(new Request('http://localhost/unknown'))
    expect(res.status).toBe(404)
  })
})
