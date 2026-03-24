import type { OutputDelivery } from '~/types/output'

export interface DatasetRunnerAckPayload {
  sourceMessageId: string
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  ackedAt: string
}

export function buildDatasetRunnerAckPayload(params: {
  sourceMessageId: string
  delivery: OutputDelivery
  ackedAt: string
}): DatasetRunnerAckPayload {
  if (params.delivery.status === 'partial') {
    return {
      sourceMessageId: params.sourceMessageId,
      status: 'failed',
      destinationRoomId: params.delivery.destinationRoomId,
      errorCode: 'PARTIAL_DELIVERY',
      errorMessage:
        params.delivery.errorMessage ?? 'Metadata message sent but body delivery failed',
      ackedAt: params.ackedAt,
    }
  }

  return {
    sourceMessageId: params.sourceMessageId,
    status: params.delivery.status,
    destinationRoomId: params.delivery.destinationRoomId,
    ...(params.delivery.destinationMessageId !== undefined
      ? { destinationMessageId: params.delivery.destinationMessageId }
      : {}),
    ...(params.delivery.errorCode !== undefined ? { errorCode: params.delivery.errorCode } : {}),
    ...(params.delivery.errorMessage !== undefined
      ? { errorMessage: params.delivery.errorMessage }
      : {}),
    ackedAt: params.ackedAt,
  }
}

export async function notifyDatasetRunner(
  payload: DatasetRunnerAckPayload,
  config: {
    callbackUrl: string
    fetchImpl?: typeof fetch
  },
): Promise<void> {
  const fetchImpl = config.fetchImpl ?? fetch
  const delays = [250, 500, 1000]

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const response = await fetchImpl(config.callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok || response.status === 202) return
    const delay = delays[attempt]
    if (attempt < delays.length - 1 && delay !== undefined) await Bun.sleep(delay)
  }

  throw new Error('Dataset-runner callback failed after bounded retries')
}
