import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createStatusRoute } from './status'

describe('GET /status', () => {
  it('returns current translator observability snapshot', async () => {
    const app = new Elysia().use(
      createStatusRoute(() => ({
        status: 'ok',
        updatedAt: '2026-03-11T00:00:00.000Z',
        activeRequests: [],
        recentResults: [],
      })),
    )

    const res = await app.handle(new Request('http://localhost/status'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; activeRequests: unknown[] }
    expect(body.status).toBe('ok')
    expect(body.activeRequests).toEqual([])
  })
})
