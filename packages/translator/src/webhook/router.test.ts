import { beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { translateRoutes as TranslateRoutesType } from './router'

describe('translateRoutes', () => {
  let translateRoutes: typeof TranslateRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  beforeAll(async () => {
    const realCore = await import('@chatwork-bot/core')

    void mock.module('@chatwork-bot/core', () => ({
      ...realCore,
      ChatworkClient: class {
        getMembers = mock(() => Promise.resolve([]))
        sendMessage = mock(() => Promise.resolve({ message_id: 'mock-id' }))
      },
    }))

    void mock.module('../env', () => ({
      env: {
        AI_PROVIDER: 'openai',
        AI_MODEL: 'gpt-4o',
        PORT: 3000,
        NODE_ENV: 'test',
        CHATWORK_API_TOKEN: 'test-token',
        CHATWORK_DESTINATION_ROOM_ID: 99999,
      },
    }))

    const mod = await import('./router')
    translateRoutes = mod.translateRoutes
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

  it('POST /internal/translate is fire-and-forget (returns 200 without blocking on handler)', async () => {
    // The route uses `void handleTranslateRequest(...).catch(...)` — returns 'OK' immediately
    // regardless of how long the handler takes or whether it fails.
    // This test verifies the routing contract: valid payload always yields 200 synchronously.
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })
})
