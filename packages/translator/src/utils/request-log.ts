import type { TranslationResult } from '@chatwork-bot/core'

interface TranslationLogEntry {
  requestId: string
  provider: string
  model: string
  latencyMs: number
  outcome: 'success' | 'error'
  errorCode?: string | undefined
  sourceLang?: string | undefined
  timestamp?: string | undefined
}

interface LogTranslationParams {
  requestId: string
  provider: string
  model: string
  latencyMs: number
  outcome: 'success' | 'error'
  result?: TranslationResult
  errorCode?: string
}

export function logTranslationRequest(params: LogTranslationParams): void {
  const entry: TranslationLogEntry = {
    requestId: params.requestId,
    provider: params.provider,
    model: params.model,
    latencyMs: params.latencyMs,
    outcome: params.outcome,
    sourceLang: params.result?.sourceLang,
    timestamp: params.result?.timestamp ?? new Date().toISOString(),
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
  }
  console.log(JSON.stringify(entry))
}
