import type { OutputDelivery } from '~/types/output'

export interface DatasetRunnerAckPayload extends OutputDelivery {
  sourceMessageId: string
  ackedAt: string
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
