import { describe, expect, it } from 'bun:test'
import { createStatusRoutes } from './status'

describe('createStatusRoutes', () => {
  it('GET /status returns the snapshot provided by getStatus', async () => {
    const snapshot = {
      mode: 'running',
      autorun: true,
      pendingFiles: 3,
      completedCount: 10,
      failedCount: 1,
      updatedAt: '2026-03-10T00:00:00.000Z',
    }
    const app = createStatusRoutes(() => snapshot)

    const res = await app.handle(new Request('http://localhost/status'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as typeof snapshot
    expect(body.mode).toBe('running')
    expect(body.pendingFiles).toBe(3)
  })
})
