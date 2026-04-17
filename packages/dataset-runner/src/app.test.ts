import { describe, expect, it, mock } from 'bun:test'

void mock.module('./env', () => ({
  env: {
    NODE_ENV: 'test',
    DATASET_AUTORUN: false,
    DATASET_RUNNER_PORT: 3002,
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createApp } = require('./app')

describe('createApp (dataset-runner)', () => {
  const app = createApp({
    getStatus: () => ({
      mode: 'idle',
      autorun: false,
      pendingFiles: 0,
      completedCount: 0,
      failedCount: 0,
      updatedAt: new Date(0).toISOString(),
    }),
    onDeliveryAck: () => {},
  })

  it('GET /health returns 200', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
  })

  it('GET /status returns idle snapshot', async () => {
    const res = await app.handle(new Request('http://localhost/status'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string; autorun: boolean }
    expect(body.mode).toBe('idle')
    expect(body.autorun).toBe(false)
  })
})
