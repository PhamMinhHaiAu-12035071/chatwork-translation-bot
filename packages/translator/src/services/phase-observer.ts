import type {
  TranslatorLogEntry,
  TranslatorPhase,
  TranslatorRequestContext,
} from '~/types/observability'
import type { TranslatorStatusStore } from './translator-status-store'

type LogWriter = (entry: TranslatorLogEntry) => void

export function createPhaseObserver(config: {
  logger: LogWriter
  statusStore: TranslatorStatusStore
  heartbeatMs: number
  phaseBudgets: Record<TranslatorPhase, number>
  request: TranslatorRequestContext
}) {
  let requestStartedAtMs: number | null = null
  let currentPhase: {
    phase: TranslatorPhase
    phaseRound?: number
    phaseStartedAtMs: number
    phaseBudgetMs: number
    timer?: Timer
    heartbeatLogged: boolean
  } | null = null

  function emit(
    level: TranslatorLogEntry['level'],
    event: string,
    extra: Partial<TranslatorLogEntry> = {},
  ): void {
    const now = new Date()
    const totalElapsed = now.getTime() - (requestStartedAtMs ?? now.getTime())

    const phaseElapsed =
      currentPhase === null ? undefined : now.getTime() - currentPhase.phaseStartedAtMs

    logger({
      level,
      service: 'translator',
      event,
      timestamp: now.toISOString(),
      requestSource: 'webhook',
      ...request,
      ...(currentPhase !== null ? { phase: currentPhase.phase } : {}),
      ...(currentPhase?.phaseRound !== undefined ? { phaseRound: currentPhase.phaseRound } : {}),
      ...(currentPhase !== null ? { phaseBudgetMs: currentPhase.phaseBudgetMs } : {}),
      ...(phaseElapsed !== undefined ? { phaseElapsedMs: phaseElapsed } : {}),
      ...(currentPhase !== null
        ? { overBudget: phaseElapsed !== undefined && phaseElapsed >= currentPhase.phaseBudgetMs }
        : {}),
      elapsedMs: totalElapsed < 0 ? 0 : totalElapsed,
      ...extra,
    })
  }

  function startHeartbeat(): void {
    if (currentPhase === null) return
    const phase = currentPhase

    phase.timer = setInterval(() => {
      const phaseElapsedMs = Date.now() - phase.phaseStartedAtMs
      if (phaseElapsedMs < phase.phaseBudgetMs) return

      store.recordHeartbeat({
        requestId: request.requestId,
        phase: phase.phase,
      })
      emit('warn', 'translation_phase_heartbeat', {
        phase: phase.phase,
        ...(phase.phaseRound !== undefined ? { phaseRound: phase.phaseRound } : {}),
      })
      phase.heartbeatLogged = true
    }, config.heartbeatMs)

    if (typeof phase.timer.unref === 'function') phase.timer.unref()
  }

  function stopHeartbeat(): void {
    if (currentPhase?.timer) clearInterval(currentPhase.timer)
  }

  const { logger, statusStore: store, request } = config

  function beginPhase(phase: TranslatorPhase, options: { phaseRound?: number } = {}): void {
    const phaseBudgetMs = config.phaseBudgets[phase]
    currentPhase = {
      phase,
      phaseStartedAtMs: Date.now(),
      phaseBudgetMs,
      heartbeatLogged: false,
      ...(options.phaseRound !== undefined ? { phaseRound: options.phaseRound } : {}),
    }

    store.startPhase({
      requestId: request.requestId,
      phase,
      ...(options.phaseRound !== undefined ? { phaseRound: options.phaseRound } : {}),
      phaseBudgetMs,
    })
    emit('info', 'translation_phase_started')
    startHeartbeat()
  }

  function finishPhase(): void {
    stopHeartbeat()
    emit('info', 'translation_phase_completed')
    currentPhase = null
  }

  function failPhase(error: unknown): void {
    stopHeartbeat()
    emit('error', 'translation_phase_failed', {
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    markRequestReceived(): void {
      requestStartedAtMs = Date.now()
      store.startRequest(request)
      emit('info', 'translation_request_received')
    },

    logEvent(
      level: TranslatorLogEntry['level'],
      event: string,
      extra: Partial<TranslatorLogEntry> = {},
    ): void {
      emit(level, event, extra)
    },

    async runPhase<T>(
      phase: TranslatorPhase,
      run: () => Promise<T>,
      options: { phaseRound?: number } = {},
    ): Promise<T> {
      beginPhase(phase, options)

      try {
        const result = await run()
        finishPhase()
        return result
      } catch (error) {
        failPhase(error)
        throw error
      }
    },

    markPhaseStarted(phase: TranslatorPhase, options: { phaseRound?: number } = {}): void {
      beginPhase(phase, options)
    },

    markPhaseCompleted(): void {
      finishPhase()
    },

    markPhaseFailed(error: unknown): void {
      failPhase(error)
    },

    completeRequest(params: {
      finalPhase: TranslatorPhase
      deliveryStatus?: 'sent' | 'partial' | 'failed'
      ackStatus?: 'sent' | 'failed'
    }): void {
      stopHeartbeat()
      const totalDurationMs = Date.now() - (requestStartedAtMs ?? Date.now())
      store.completeRequest({
        requestId: request.requestId,
        finalPhase: params.finalPhase,
        finalStatus: 'completed',
        ...(params.deliveryStatus !== undefined ? { deliveryStatus: params.deliveryStatus } : {}),
        ...(params.ackStatus !== undefined ? { ackStatus: params.ackStatus } : {}),
      })
      emit('info', 'translation_request_completed', {
        finalStatus: 'completed',
        finalPhase: params.finalPhase,
        totalDurationMs,
        ...(params.deliveryStatus !== undefined ? { deliveryStatus: params.deliveryStatus } : {}),
        ...(params.ackStatus !== undefined ? { ackStatus: params.ackStatus } : {}),
      })
      currentPhase = null
    },

    failRequest(params: {
      finalStatus: 'failed' | 'aborted'
      errorCode: string
      errorMessage: string
    }): void {
      stopHeartbeat()
      const finalPhase = currentPhase?.phase ?? 'translation'
      const totalDurationMs = Date.now() - (requestStartedAtMs ?? Date.now())
      store.completeRequest({
        requestId: request.requestId,
        finalPhase,
        finalStatus: params.finalStatus,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
      })
      emit(
        params.finalStatus === 'aborted' ? 'warn' : 'error',
        params.finalStatus === 'aborted'
          ? 'translation_request_aborted'
          : 'translation_request_failed',
        {
          finalStatus: params.finalStatus,
          finalPhase,
          totalDurationMs,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
        },
      )
      currentPhase = null
    },
  }
}
