import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  getProviderPlugin,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent, ProviderCreateContext } from '@chatwork-bot/core'
import { env } from '~/env'
import { TranslationPipeline } from '~/pipeline/pipeline'
import { writeTranslationOutput } from '~/utils/output-writer'
import { logTranslationRequest } from '~/utils/request-log'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
import { resolveOutputOrigin } from '~/services/output-origin'
import { notifyDatasetRunner } from '~/services/dataset-runner-callback'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    return
  }

  const { body } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    return
  }

  const plugin = getProviderPlugin(env.AI_PROVIDER)
  const modelId = env.AI_MODEL ?? plugin.manifest.defaultModel
  const ctx: ProviderCreateContext = { modelId }
  const baseUrl = process.env['CURSOR_API_URL']
  if (baseUrl) {
    ctx.baseUrl = baseUrl
  }
  const executor = plugin.create(ctx)
  const requestId = crypto.randomUUID()
  const startMs = Date.now()

  try {
    const timeoutMs = plugin.manifest.timeoutMs
    const pipeline = new TranslationPipeline(executor, timeoutMs ? { timeoutMs } : {})
    const { result, trace } = await pipeline.run(cleanText)
    const latencyMs = Date.now() - startMs

    logTranslationRequest({
      requestId,
      provider: env.AI_PROVIDER,
      model: modelId,
      latencyMs,
      outcome: 'success',
      result,
    })

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']

    const origin = await resolveOutputOrigin(
      event.webhook_event.message_id,
      process.env['DATASET_INPUT_DIR'] ?? './input',
    )

    const outputRecord = { ...event, translation: result, pipeline: trace, origin }

    await writeTranslationOutput(outputRecord, ...(outputBaseDir ? [outputBaseDir] : []))

    const delivery = await sendTranslatedMessage(event, result, {
      apiToken: env.CHATWORK_API_TOKEN,
      destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
    })

    await writeTranslationOutput(
      { ...outputRecord, delivery },
      ...(outputBaseDir ? [outputBaseDir] : []),
    )

    if (origin.type === 'automation') {
      await notifyDatasetRunner(
        {
          sourceMessageId: event.webhook_event.message_id,
          ...delivery,
          ackedAt: new Date().toISOString(),
        },
        {
          callbackUrl:
            process.env['DATASET_RUNNER_CALLBACK_URL'] ??
            'http://dataset-runner:3002/internal/delivery-acks',
        },
      )
    }
  } catch (error) {
    const latencyMs = Date.now() - startMs
    if (error instanceof TranslationError) {
      logTranslationRequest({
        requestId,
        provider: env.AI_PROVIDER,
        model: modelId,
        latencyMs,
        outcome: 'error',
        errorCode: error.code,
      })
      return
    }
    throw error
  }
}
