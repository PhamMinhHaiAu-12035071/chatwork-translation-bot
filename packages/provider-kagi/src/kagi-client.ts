import type { KagiErrorPayload, KagiTranslateRequest, KagiTranslateResponse } from './types'

export class KagiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: {
      status?: number
      cause?: unknown
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'KagiClientError'
    this.status = options?.status
  }

  public readonly status: number | undefined
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function isErrorPayload(payload: unknown): payload is KagiErrorPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const typedError = error as { code?: unknown; message?: unknown }
  return typeof typedError.code === 'string' && typeof typedError.message === 'string'
}

function isTranslateResponse(payload: unknown): payload is KagiTranslateResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { translated?: unknown }).translated === 'string'
  )
}

export class KagiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
  }

  async translate(request: KagiTranslateRequest): Promise<KagiTranslateResponse> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      })
    } catch (error) {
      throw new KagiClientError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network failure',
        { cause: error },
      )
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch (error) {
      throw new KagiClientError('INVALID_RESPONSE', 'Kagi sidecar returned invalid JSON', {
        status: response.status,
        cause: error,
      })
    }

    if (!response.ok) {
      if (isErrorPayload(payload)) {
        throw new KagiClientError(payload.error.code, payload.error.message, {
          status: response.status,
        })
      }

      throw new KagiClientError(
        'HTTP_ERROR',
        `Kagi sidecar responded with ${response.status.toString()}`,
        {
          status: response.status,
        },
      )
    }

    if (!isTranslateResponse(payload)) {
      throw new KagiClientError(
        'INVALID_RESPONSE',
        'Kagi sidecar response missing translated text',
        {
          status: response.status,
        },
      )
    }

    return payload
  }
}
