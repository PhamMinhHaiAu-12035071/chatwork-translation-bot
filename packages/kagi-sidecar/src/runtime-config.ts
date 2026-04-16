import { join } from 'node:path'
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
    | 'userDataDir'
    | 'headless'
    | 'sessionFile'
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

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined) return fallback
  const normalized = input.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0' || normalized === '') return false
  return fallback
}

export function resolveKagiRuntimeConfig(input: NodeJS.ProcessEnv): KagiRuntimeConfig {
  const userDataDirRaw = input['USER_DATA_DIR']?.trim()
  const sessionFileRaw = input['KAGI_SESSION_FILE']?.trim()

  const baseBrowser = {
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
    userDataDir:
      userDataDirRaw !== undefined && userDataDirRaw !== ''
        ? userDataDirRaw
        : join(process.cwd(), 'user-data'),
    headless: parseBoolean(input['KAGI_HEADLESS'], false),
  }

  const browser =
    sessionFileRaw !== undefined && sessionFileRaw !== ''
      ? { ...baseBrowser, sessionFile: sessionFileRaw }
      : baseBrowser

  return {
    port: parsePositiveInteger(input['KAGI_PORT'], 'KAGI_PORT', 3002),
    browser,
  }
}
