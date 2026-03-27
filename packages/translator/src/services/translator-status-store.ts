import type {
  ActiveTranslatorRequest,
  TranslatorFinalStatus,
  TranslatorPhase,
  TranslatorRecentResult,
  TranslatorRequestContext,
  TranslatorStatusSnapshot,
} from '~/types/observability'

interface ActiveRequestState extends TranslatorRequestContext {
  startedAt: string
  phase: TranslatorPhase
  phaseRound?: number
  phaseStartedAt: string
  phaseBudgetMs: number
  lastHeartbeatAt?: string
  overBudgetPhases: Set<TranslatorPhase>
}

export class TranslatorStatusStore {
  private readonly activeRequests = new Map<string, ActiveRequestState>()
  private readonly recentResults: TranslatorRecentResult[] = []
  private updatedAt: string

  constructor(
    private readonly config: {
      historyLimit: number
      now?: () => Date
    },
  ) {
    this.updatedAt = this.now().toISOString()
  }

  startRequest(request: TranslatorRequestContext): void {
    const startedAt = this.now().toISOString()
    this.activeRequests.set(request.requestId, {
      ...request,
      startedAt,
      phase: 'translation',
      phaseStartedAt: startedAt,
      phaseBudgetMs: 0,
      overBudgetPhases: new Set<TranslatorPhase>(),
    })
    this.updatedAt = startedAt
  }

  startPhase(params: {
    requestId: string
    phase: TranslatorPhase
    phaseRound?: number
    phaseBudgetMs: number
  }): void {
    const request = this.activeRequests.get(params.requestId)
    if (!request) return

    request.phase = params.phase
    if (params.phaseRound !== undefined) {
      request.phaseRound = params.phaseRound
    } else {
      delete request.phaseRound
    }
    request.phaseStartedAt = this.now().toISOString()
    request.phaseBudgetMs = params.phaseBudgetMs
    delete request.lastHeartbeatAt
    this.updatedAt = this.now().toISOString()
  }

  recordHeartbeat(params: { requestId: string; phase: TranslatorPhase; at?: string }): void {
    const request = this.activeRequests.get(params.requestId)
    if (!request) return

    request.overBudgetPhases.add(params.phase)
    request.lastHeartbeatAt = params.at ?? this.now().toISOString()
    this.updatedAt = request.lastHeartbeatAt
  }

  completeRequest(params: {
    requestId: string
    finalPhase: TranslatorPhase
    finalStatus?: TranslatorFinalStatus
    deliveryStatus?: 'sent' | 'partial' | 'failed'
    ackStatus?: 'sent' | 'failed'
    errorCode?: string
    errorMessage?: string
  }): void {
    const request = this.activeRequests.get(params.requestId)
    if (!request) return

    const completedAt = this.now().toISOString()
    const recentResult: TranslatorRecentResult = {
      ...this.buildRequestContext(request),
      finalStatus: params.finalStatus ?? 'completed',
      finalPhase: params.finalPhase,
      completedAt,
      totalDurationMs: new Date(completedAt).getTime() - new Date(request.startedAt).getTime(),
      overBudgetPhases: [...request.overBudgetPhases],
      ...(params.deliveryStatus !== undefined ? { deliveryStatus: params.deliveryStatus } : {}),
      ...(params.ackStatus !== undefined ? { ackStatus: params.ackStatus } : {}),
      ...(params.errorCode !== undefined ? { errorCode: params.errorCode } : {}),
      ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    }

    this.activeRequests.delete(params.requestId)
    this.recentResults.unshift(recentResult)
    if (this.recentResults.length > this.config.historyLimit) {
      this.recentResults.length = this.config.historyLimit
    }
    this.updatedAt = completedAt
  }

  getSnapshot(): TranslatorStatusSnapshot {
    const nowMs = this.now().getTime()
    const activeRequests: ActiveTranslatorRequest[] = [...this.activeRequests.values()].map(
      (request) => {
        const phaseStartedAtMs = new Date(request.phaseStartedAt).getTime()
        return {
          ...this.buildRequestContext(request),
          phase: request.phase,
          ...(request.phaseRound !== undefined ? { phaseRound: request.phaseRound } : {}),
          startedAt: request.startedAt,
          phaseStartedAt: request.phaseStartedAt,
          elapsedMs: nowMs - new Date(request.startedAt).getTime(),
          phaseElapsedMs: nowMs - phaseStartedAtMs,
          phaseBudgetMs: request.phaseBudgetMs,
          overBudget: request.overBudgetPhases.has(request.phase),
          ...(request.lastHeartbeatAt !== undefined
            ? { lastHeartbeatAt: request.lastHeartbeatAt }
            : {}),
        }
      },
    )

    return {
      status: 'ok',
      updatedAt: this.updatedAt,
      activeRequests,
      recentResults: [...this.recentResults],
    }
  }

  private now(): Date {
    return this.config.now?.() ?? new Date()
  }

  private buildRequestContext(request: TranslatorRequestContext): TranslatorRequestContext {
    return {
      requestId: request.requestId,
      traceId: request.traceId,
      sourceMessageId: request.sourceMessageId,
      originType: request.originType,
      provider: request.provider,
      model: request.model,
      translationStyle: request.translationStyle,
      roomId: request.roomId,
      inputLength: request.inputLength,
      ...(request.pipelineTimeoutMs !== undefined
        ? { pipelineTimeoutMs: request.pipelineTimeoutMs }
        : {}),
      ...(request.pipelineTimeoutSource !== undefined
        ? { pipelineTimeoutSource: request.pipelineTimeoutSource }
        : {}),
      ...(request.datasetFile !== undefined ? { datasetFile: request.datasetFile } : {}),
      ...(request.datasetItemId !== undefined ? { datasetItemId: request.datasetItemId } : {}),
      ...(request.datasetLineNumber !== undefined
        ? { datasetLineNumber: request.datasetLineNumber }
        : {}),
    }
  }
}
