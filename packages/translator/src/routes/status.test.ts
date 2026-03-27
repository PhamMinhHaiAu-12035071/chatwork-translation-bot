import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createStatusRoute } from './status'

describe('GET /status', () => {
  it('returns current translator observability snapshot', async () => {
    const app = new Elysia().use(
      createStatusRoute(() => ({
        status: 'ok',
        updatedAt: '2026-03-11T00:00:00.000Z',
        activeRequests: [
          {
            requestId: 'req-1',
            traceId: 'trace-status-1',
            sourceMessageId: 'source-1',
            originType: 'manual',
            provider: 'openai',
            model: 'gpt-5.4',
            translationStyle: 'TECHNICAL',
            roomId: 123,
            inputLength: 10,
            phase: 'translation',
            startedAt: '2026-03-11T00:00:00.000Z',
            phaseStartedAt: '2026-03-11T00:00:00.000Z',
            elapsedMs: 1000,
            phaseElapsedMs: 1000,
            phaseBudgetMs: 60000,
            overBudget: false,
          },
        ],
        recentResults: [],
      })),
    )

    const res = await app.handle(new Request('http://localhost/status'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      status: string
      activeRequests: { translationStyle: string }[]
    }
    expect(body.status).toBe('ok')
    expect(body.activeRequests[0]?.translationStyle).toBe('TECHNICAL')
  })
})
