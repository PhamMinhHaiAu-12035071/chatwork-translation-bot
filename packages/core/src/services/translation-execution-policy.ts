import pRetry from 'p-retry'
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
import { TranslationError } from '~/interfaces/translation'

const TIMEOUT_MS = 10_000

const RETRY_OPTIONS = {
  retries: 2,
  minTimeout: 300,
  factor: 2,
}

function isTransient(error: unknown): boolean {
  return error instanceof TranslationError && error.code === 'API_ERROR'
}

export async function translateWithPolicy(
  service: ITranslationService,
  text: string,
): Promise<TranslationResult> {
  return pRetry(
    async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, TIMEOUT_MS)
      try {
        return await service.translate(text)
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
