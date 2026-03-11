import { TranslationError } from '@chatwork-bot/core'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 240_000

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  sleepFn?: (ms: number) => Promise<void>
  signal?: AbortSignal
  isRetryable?: (error: unknown) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = MAX_ATTEMPTS,
    delayMs = RETRY_DELAY_MS,
    sleepFn = Bun.sleep,
    signal,
    isRetryable = defaultIsRetryable,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const isLast = attempt === maxAttempts
      if (isLast || !isRetryable(error)) throw error

      console.warn(
        JSON.stringify({
          level: 'warn',
          service: 'provider-cursor',
          event: 'cursor_api_retry',
          attempt,
          maxAttempts,
          delayMs,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      )

      if (signal?.aborted) throw error
      await sleepFn(delayMs)
      if (signal?.aborted) throw error
    }
  }
  throw lastError
}

function defaultIsRetryable(error: unknown): boolean {
  return error instanceof TranslationError && error.code === 'API_ERROR'
}
