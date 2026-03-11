import { env } from '~/env'
import type { TranslatorLogEntry, TranslatorStatusSnapshot } from '~/types/observability'
import { TranslatorStatusStore } from './translator-status-store'

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
  console.log(JSON.stringify(entry))
}

export function getTranslatorObservabilityConfig() {
  return {
    heartbeatMs: env.TRANSLATOR_PHASE_HEARTBEAT_MS,
    phaseBudgets: {
      analysis: env.TRANSLATOR_ANALYSIS_BUDGET_MS,
      translation: env.TRANSLATOR_TRANSLATION_BUDGET_MS,
      review: env.TRANSLATOR_REVIEW_BUDGET_MS,
      delivery: env.TRANSLATOR_DELIVERY_BUDGET_MS,
      ack_callback: env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS,
    },
  }
}

export function resetTranslatorObservabilityForTest(): void {
  translatorStatusStore = createStatusStore()
}
