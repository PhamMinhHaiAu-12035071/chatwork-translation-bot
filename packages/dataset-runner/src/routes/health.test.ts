import { describe, expect, it } from 'bun:test'
import { healthRoutes } from './health'

describe('healthRoutes', () => {
  it('GET /health returns 200 with ok: true', async () => {
    const res = await healthRoutes.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
