import { describe, expect, it } from 'bun:test'
import Elysia from 'elysia'
import { healthRoutes } from './health'

describe('healthRoutes', () => {
  const app = new Elysia().use(healthRoutes)

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; timestamp: string }
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})
