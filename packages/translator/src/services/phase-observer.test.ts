import { describe, expect, it, mock } from 'bun:test'
import { createPhaseObserver } from './phase-observer'
import { TranslatorStatusStore } from './translator-status-store'

describe('createPhaseObserver', () => {
  it('emits lifecycle logs and one heartbeat for a slow phase', async () => {
    const logs: string[] = []
    const store = new TranslatorStatusStore({
      historyLimit: 20,
      now: () => new Date(),
    })

    const observer = createPhaseObserver({
      logger: (entry) => {
        logs.push(JSON.stringify(entry))
      },
      statusStore: store,
      heartbeatMs: 10,
      phaseBudgets: {
        translation: 5,
        delivery: 5,
        ack_callback: 5,
      },
      request: {
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
      },
    })

    observer.markRequestReceived()

    await observer.runPhase('translation', async () => {
      await Bun.sleep(25)
    })

    observer.completeRequest({
      finalPhase: 'delivery',
      deliveryStatus: 'sent',
    })

    expect(logs.some((entry) => entry.includes('"event":"translation_request_received"'))).toBe(
      true,
    )
    expect(logs.some((entry) => entry.includes('"event":"translation_phase_started"'))).toBe(true)
    expect(logs.some((entry) => entry.includes('"event":"translation_phase_heartbeat"'))).toBe(true)
    expect(logs.some((entry) => entry.includes('"event":"translation_phase_completed"'))).toBe(true)
    expect(logs.some((entry) => entry.includes('"event":"translation_request_completed"'))).toBe(
      true,
    )

    const snapshot = store.getSnapshot()
    expect(snapshot.activeRequests).toHaveLength(0)
    expect(snapshot.recentResults[0]?.overBudgetPhases).toContain('translation')
  })

  it('marks aborted requests with active phase context', async () => {
    const logger = mock((_entry: unknown) => undefined)
    const store = new TranslatorStatusStore({
      historyLimit: 20,
      now: () => new Date(),
    })

    const observer = createPhaseObserver({
      logger,
      statusStore: store,
      heartbeatMs: 10,
      phaseBudgets: {
        translation: 5,
        delivery: 5,
        ack_callback: 5,
      },
      request: {
        requestId: 'req-2',
        sourceMessageId: 'source-2',
        originType: 'manual',
        provider: 'cursor',
        model: 'gemini-3.1-pro',
        roomId: 424846369,
        inputLength: 12,
      },
    })

    observer.markRequestReceived()

    let caughtError: unknown
    try {
      await observer.runPhase('translation', async () => {
        await Bun.sleep(1)
        throw new Error('boom')
      })
    } catch (error) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe('boom')

    observer.failRequest({
      finalStatus: 'aborted',
      errorCode: 'ABORTED',
      errorMessage: 'Translation pipeline aborted',
    })

    const snapshot = store.getSnapshot()
    expect(snapshot.recentResults[0]).toMatchObject({
      requestId: 'req-2',
      finalStatus: 'aborted',
      finalPhase: 'translation',
      errorCode: 'ABORTED',
    })
  })

  it('records partial delivery status when a request completes with a body-stage failure', () => {
    const logs: string[] = []
    const store = new TranslatorStatusStore({
      historyLimit: 20,
      now: () => new Date(),
    })

    const observer = createPhaseObserver({
      logger: (entry) => {
        logs.push(JSON.stringify(entry))
      },
      statusStore: store,
      heartbeatMs: 10,
      phaseBudgets: {
        translation: 5,
        delivery: 5,
        ack_callback: 5,
      },
      request: {
        requestId: 'req-3',
        sourceMessageId: 'source-3',
        originType: 'automation',
        provider: 'openai',
        model: 'gpt-5.4',
        roomId: 424846369,
        inputLength: 8,
      },
    })

    observer.markRequestReceived()
    observer.completeRequest({
      finalPhase: 'ack_callback',
      deliveryStatus: 'partial',
      ackStatus: 'sent',
    })

    expect(logs.some((entry) => entry.includes('"deliveryStatus":"partial"'))).toBe(true)
    expect(store.getSnapshot().recentResults[0]).toMatchObject({
      requestId: 'req-3',
      finalStatus: 'completed',
      finalPhase: 'ack_callback',
      deliveryStatus: 'partial',
      ackStatus: 'sent',
    })
  })
})
