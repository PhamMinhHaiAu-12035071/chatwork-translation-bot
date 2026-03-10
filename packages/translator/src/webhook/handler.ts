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
    await writeTranslationOutput(
      { ...event, translation: result, pipeline: trace },
      ...(outputBaseDir ? [outputBaseDir] : []),
    )

    await sendTranslatedMessage(event, result, {
      apiToken: env.CHATWORK_API_TOKEN,
      destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
    })
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
