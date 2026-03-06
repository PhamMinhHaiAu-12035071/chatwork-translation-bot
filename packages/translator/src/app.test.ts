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

  // NOTE: /internal/translate endpoint is comprehensively tested in router.test.ts
  // Removed duplicate test to avoid file creation side effects during test runs

  it('unknown route returns 404', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const res = await app.handle(new Request('http://localhost/unknown'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(404)
  })
})
