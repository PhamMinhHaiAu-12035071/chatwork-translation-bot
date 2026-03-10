import { describe, expect, it, mock } from 'bun:test'

void mock.module('./env', () => ({
  env: {
    NODE_ENV: 'test',
    DATASET_AUTORUN: false,
    DATASET_RUNNER_PORT: 3002,
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { createApp } = require('./app')

describe('createApp (dataset-runner)', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const app = createApp({
    getStatus: () => ({
      mode: 'idle',
      autorun: false,
      pendingFiles: 0,
      completedCount: 0,
      failedCount: 0,
      updatedAt: new Date(0).toISOString(),
    }),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onDeliveryAck: () => {},
  })

  it('GET /health returns 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const res = await app.handle(new Request('http://localhost/health'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
  })

  it('GET /status returns idle snapshot', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const res = await app.handle(new Request('http://localhost/status'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const body = (await res.json()) as { mode: string; autorun: boolean }
    expect(body.mode).toBe('idle')
    expect(body.autorun).toBe(false)
  })
})
