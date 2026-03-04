import { describe, expect, it, mock } from 'bun:test'

void mock.module('./env', () => ({
  env: {
    CHATWORK_API_TOKEN: 'test-token',
    PORT: 3000,
    NODE_ENV: 'test',
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-4o',
  },
}))

// Import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { createApp } = require('./app')

describe('createApp (translator)', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const app = createApp()

  it('GET /health returns 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const res = await app.handle(new Request('http://localhost/health'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
  })

  it('POST /internal/translate with valid payload returns 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      }),
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
  })

  it('unknown route returns 404', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const res = await app.handle(new Request('http://localhost/unknown'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(404)
  })
})
