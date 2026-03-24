import { describe, expect, it } from 'bun:test'
import { TranslatorStatusStore } from './translator-status-store'

describe('TranslatorStatusStore', () => {
  it('tracks one active request with current phase metadata', () => {
    let nowMs = Date.parse('2026-03-11T00:00:00.000Z')
    const store = new TranslatorStatusStore({
      historyLimit: 20,
      now: () => new Date(nowMs),
    })

    store.startRequest({
      requestId: 'req-1',
      sourceMessageId: 'source-1',
      originType: 'automation',
      provider: 'cursor',
      model: 'gemini-3.1-pro',
      roomId: 424846369,
      inputLength: 5,
      datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
      datasetItemId: 'vfa-001',
      datasetLineNumber: 1,
    })

    nowMs += 15_000
    store.startPhase({
      requestId: 'req-1',
      phase: 'translation',
      phaseBudgetMs: 60_000,
    })

    nowMs += 12_000
    const snapshot = store.getSnapshot()

    expect(snapshot.status).toBe('ok')
    expect(snapshot.activeRequests).toHaveLength(1)
    expect(snapshot.activeRequests[0]).toMatchObject({
      requestId: 'req-1',
      sourceMessageId: 'source-1',
      phase: 'translation',
      phaseBudgetMs: 60_000,
      datasetItemId: 'vfa-001',
    })
    expect(snapshot.activeRequests[0]?.elapsedMs).toBe(27_000)
    expect(snapshot.activeRequests[0]?.phaseElapsedMs).toBe(12_000)
  })

  it('moves completed requests into recent results and trims to history limit', () => {
    let nowMs = Date.parse('2026-03-11T00:00:00.000Z')
    const store = new TranslatorStatusStore({
      historyLimit: 2,
      now: () => new Date(nowMs),
    })

    for (const requestId of ['req-1', 'req-2', 'req-3']) {
      store.startRequest({
        requestId,
        sourceMessageId: `${requestId}-source`,
        originType: 'manual',
        provider: 'cursor',
        model: 'gemini-3.1-pro',
        roomId: 424846369,
        inputLength: 5,
      })
      store.startPhase({
        requestId,
        phase: 'translation',
        phaseBudgetMs: 60_000,
      })
      nowMs += 5_000
      store.completeRequest({
        requestId,
        finalPhase: 'delivery',
        deliveryStatus: 'sent',
      })
      nowMs += 1_000
    }

    const snapshot = store.getSnapshot()
    expect(snapshot.activeRequests).toHaveLength(0)
    expect(snapshot.recentResults).toHaveLength(2)
    expect(snapshot.recentResults.map((item) => item.requestId)).toEqual(['req-3', 'req-2'])
  })
})
