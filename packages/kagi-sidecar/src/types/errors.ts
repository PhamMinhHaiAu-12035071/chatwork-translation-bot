/**
 * Error codes for Kagi sidecar operations.
 * Each code maps to specific retry/HTTP status behavior.
 */
export type KagiSidecarErrorCode =
  | 'TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'ANTI_ABUSE_DETECTED'
  | 'UI_INTERACTION' // NEW - Browser UI automation failures

/**
 * Metadata for each error code defining retry behavior and HTTP status.
 */
const ERROR_METADATA: Record<KagiSidecarErrorCode, { retryable: boolean; httpStatus: number }> = {
  TIMEOUT: { retryable: true, httpStatus: 504 },
  NAVIGATION_FAILED: { retryable: true, httpStatus: 502 },
  ANTI_ABUSE_DETECTED: { retryable: false, httpStatus: 429 },
  UI_INTERACTION: { retryable: false, httpStatus: 502 }, // NEW
}

/**
 * Structured error for Kagi sidecar operations.
 * Includes error code, retry behavior, HTTP status, and optional context.
 */
export class KagiSidecarError extends Error {
  public readonly code: KagiSidecarErrorCode
  public readonly retryable: boolean
  public readonly httpStatus: number
  public readonly context?: Record<string, unknown>

  constructor(code: KagiSidecarErrorCode, message: string, context?: Record<string, unknown>) {
    super(message)
    this.name = 'KagiSidecarError'
    this.code = code
    if (context !== undefined) {
      this.context = context
    }

    const metadata = ERROR_METADATA[code]
    this.retryable = metadata.retryable
    this.httpStatus = metadata.httpStatus
  }
}
