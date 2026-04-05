import { env } from '~/env'
import type { TranslatorLogEntry, TranslatorStatusSnapshot } from '~/types/observability'
import { TranslatorStatusStore } from './translator-status-store'
import { asyncLogger } from './async-logger'

function createStatusStore(): TranslatorStatusStore {
  return new TranslatorStatusStore({
    historyLimit: env.TRANSLATOR_STATUS_HISTORY_LIMIT,
  })
}

let translatorStatusStore = createStatusStore()

export function getTranslatorStatusStore(): TranslatorStatusStore {
  return translatorStatusStore
}

export function getTranslatorStatusSnapshot(): TranslatorStatusSnapshot {
  return translatorStatusStore.getSnapshot()
}

export function logTranslatorEvent(entry: TranslatorLogEntry): void {
  const useAsync = process.env['USE_ASYNC_LOGGING'] !== 'false'
  
  const logData = {
    ...entry,
    timestamp: new Date().toISOString(),
  }
  
  if (useAsync) {
    // Map TranslatorLogEntry to LogEntry format
    asyncLogger.log({
      level: entry.level,
      message: entry.event,
      timestamp: logData.timestamp,
      service: entry.service,
      traceId: entry.traceId,
      requestId: entry.requestId,
      sourceMessageId: entry.sourceMessageId,
    })
  } else {
    // Fallback to sync logging
    console.log(JSON.stringify(logData))
  }
}

export function getTranslatorObservabilityConfig() {
  return {
    heartbeatMs: env.TRANSLATOR_PHASE_HEARTBEAT_MS,
    phaseBudgets: {
      translation: env.TRANSLATOR_TRANSLATION_BUDGET_MS,
      delivery: env.TRANSLATOR_DELIVERY_BUDGET_MS,
      ack_callback: env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS,
    },
  }
}

export function resetTranslatorObservabilityForTest(): void {
  translatorStatusStore = createStatusStore()
}

export { asyncLogger }
