import type { KagiBrowserServiceOptions } from './browser-service'

export interface KagiRuntimeConfig {
  port: number
  browser: Pick<
    KagiBrowserServiceOptions,
    | 'maxQueueDepth'
    | 'maxQueueWaitMs'
    | 'maxRetries'
    | 'minIntervalMs'
    | 'requestTimeoutMs'
    | 'retryBaseMs'
  >
}

function parsePositiveInteger(
  input: string | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (input === undefined || input.trim() === '') {
    return fallback
  }

  const parsed = Number.parseInt(input, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`)
  }

  return parsed
}

export function resolveKagiRuntimeConfig(input: NodeJS.ProcessEnv): KagiRuntimeConfig {
  return {
    port: parsePositiveInteger(input['KAGI_PORT'], 'KAGI_PORT', 3002),
    browser: {
      minIntervalMs: parsePositiveInteger(
        input['KAGI_MIN_INTERVAL_MS'],
        'KAGI_MIN_INTERVAL_MS',
        1_500,
      ),
      maxRetries: parsePositiveInteger(input['KAGI_MAX_RETRIES'], 'KAGI_MAX_RETRIES', 2),
      retryBaseMs: parsePositiveInteger(input['KAGI_RETRY_BASE_MS'], 'KAGI_RETRY_BASE_MS', 1_000),
      requestTimeoutMs: parsePositiveInteger(
        input['KAGI_REQUEST_TIMEOUT_MS'],
        'KAGI_REQUEST_TIMEOUT_MS',
        120_000,
      ),
      maxQueueDepth: parsePositiveInteger(
        input['KAGI_MAX_QUEUE_DEPTH'],
        'KAGI_MAX_QUEUE_DEPTH',
        10,
      ),
      maxQueueWaitMs: parsePositiveInteger(
        input['KAGI_MAX_QUEUE_WAIT_MS'],
        'KAGI_MAX_QUEUE_WAIT_MS',
        15_000,
      ),
    },
  }
}
