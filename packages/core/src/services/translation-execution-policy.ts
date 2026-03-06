import pRetry from 'p-retry'
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
import { TranslationError } from '~/interfaces/translation'

const DEFAULT_TIMEOUT_MS = 10_000

const RETRY_OPTIONS = {
  retries: 1,
  minTimeout: 300,
  factor: 2,
}

function isTransient(error: unknown): boolean {
  return error instanceof TranslationError && error.code === 'API_ERROR'
}

export interface PolicyOptions {
  timeoutMs?: number
}

export async function translateWithPolicy(
  service: ITranslationService,
  text: string,
  options?: PolicyOptions,
): Promise<TranslationResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return pRetry(
    async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
      try {
        return await service.translate(text, { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
    },
    {
      ...RETRY_OPTIONS,
      shouldRetry({ error }) {
        return isTransient(error)
      },
    },
  )
}
