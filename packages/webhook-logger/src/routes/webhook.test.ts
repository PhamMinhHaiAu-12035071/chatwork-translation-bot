import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { handleWebhookRoute as HandleWebhookRouteType } from './webhook'

const testSecret = 'dGVzdC1zZWNyZXQta2V5LTEyMzQ='

void mock.module('../env', () => ({
  env: {
    CHATWORK_WEBHOOK_SECRET: testSecret,
    LOGGER_PORT: 3001,
    TRANSLATOR_URL: 'http://localhost:3000',
  },
}))

function generateSignature(body: string, secret: string): Promise<string> {
  return (async () => {
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
  })()
}

describe('handleWebhookRoute', () => {
  let handleWebhookRoute: typeof HandleWebhookRouteType

  beforeAll(async () => {
    const mod = await import('./webhook')
    handleWebhookRoute = mod.handleWebhookRoute
  })

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

  it('returns 200 when signature is provided via query parameter', async () => {
    const signature = await generateSignature(sampleEvent, testSecret)
    const request = new Request(
      `http://localhost/webhook?chatwork_webhook_signature=${encodeURIComponent(signature)}`,
      {
        method: 'POST',
        body: sampleEvent,
        headers: {
          'content-type': 'application/json',
        },
      },
    )

    const response = await handleWebhookRoute(request)
    expect(response.status).toBe(200)
  })

  it('returns 400 for invalid JSON with valid signature', async () => {
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
