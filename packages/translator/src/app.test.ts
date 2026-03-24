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

  it('GET /status returns 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const res = await app.handle(new Request('http://localhost/status'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
  })

  it('POST /internal/translate accepts the enriched ingress command schema', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const res = await app.handle(
      new Request('http://localhost/internal/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: {
            sourceSystem: 'chatwork',
            sourceEventId: '789012345:message_updated:1498028130',
            sourceEventType: 'message_updated',
            sourceMessageId: '789012345',
            sourceRoomId: 567890123,
            senderAccountId: 123456,
            rawBody: 'Hello World',
            translatableText: 'Hello World',
            translationInputs: ['Hello World'],
            sendTime: 1498028125,
            updateTime: 1498028130,
            audit: {
              receivedAt: '2026-03-24T00:00:00.000Z',
              rawSourceSnapshot: {
                webhook_setting_id: '12345',
              },
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
