export type TranslatorPhase = 'translation' | 'delivery' | 'ack_callback'

export type TranslatorFinalStatus = 'completed' | 'failed' | 'aborted'

export interface TranslatorRequestContext {
  requestId: string
  sourceMessageId: string
  originType: 'manual' | 'automation'
  provider: string
  model: string
  roomId: number
  inputLength: number
  pipelineTimeoutMs?: number
  pipelineTimeoutSource?: 'env' | 'provider' | 'default'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

export interface TranslatorLogEntry extends TranslatorRequestContext {
  level: 'info' | 'warn' | 'error'
  service: 'translator' | 'webhook-logger' | 'dataset-runner'
  event: string
  timestamp: string
  requestSource?: 'webhook'
  phase?: TranslatorPhase
  phaseRound?: number
  elapsedMs?: number
  phaseElapsedMs?: number
  phaseBudgetMs?: number
  overBudget?: boolean
  lastHeartbeatAt?: string
  finalStatus?: TranslatorFinalStatus
  finalPhase?: TranslatorPhase
  totalDurationMs?: number
  deliveryStatus?: 'sent' | 'failed'
  ackStatus?: 'sent' | 'failed'
  errorCode?: string
  errorMessage?: string
}

export interface ActiveTranslatorRequest extends TranslatorRequestContext {
  phase: TranslatorPhase
  phaseRound?: number
  startedAt: string
  phaseStartedAt: string
  elapsedMs: number
  phaseElapsedMs: number
  phaseBudgetMs: number
  overBudget: boolean
  lastHeartbeatAt?: string
}

export interface TranslatorRecentResult extends TranslatorRequestContext {
  finalStatus: TranslatorFinalStatus
  finalPhase: TranslatorPhase
  completedAt: string
  totalDurationMs: number
  overBudgetPhases: TranslatorPhase[]
  deliveryStatus?: 'sent' | 'failed'
  ackStatus?: 'sent' | 'failed'
  errorCode?: string
  errorMessage?: string
}

export interface TranslatorStatusSnapshot {
  status: 'ok'
  updatedAt: string
  activeRequests: ActiveTranslatorRequest[]
  recentResults: TranslatorRecentResult[]
}
