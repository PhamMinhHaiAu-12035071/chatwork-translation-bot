import { beforeAll, describe, expect, it, mock } from 'bun:test'
import Elysia from 'elysia'
import type { translateRoutes as TranslateRoutesType } from './router'

void mock.module('../env', () => ({
  env: {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o',
    PORT: 3000,
    NODE_ENV: 'test',
    CHATWORK_API_TOKEN: 'test-token',
  },
}))

const mockHandleTranslateRequest = mock(() => Promise.resolve())
void mock.module('./handler', () => ({
  handleTranslateRequest: mockHandleTranslateRequest,
}))

describe('translateRoutes', () => {
  let translateRoutes: typeof TranslateRoutesType
  let app: ReturnType<typeof Elysia.prototype.use>

  beforeAll(async () => {
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

  it('POST /internal/translate calls handleTranslateRequest (fire-and-forget)', async () => {
    mockHandleTranslateRequest.mockClear()
    await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mockHandleTranslateRequest.mock.calls.length).toBeGreaterThan(0)
  })
})
