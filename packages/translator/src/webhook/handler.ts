import { getProviderPlugin, TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, ProviderCreateContext } from '@chatwork-bot/core'
import { env } from '~/env'
import { TranslationPipeline } from '~/pipeline/pipeline'
import { writeTranslationOutput } from '~/utils/output-writer'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
import { resolveOutputOrigin } from '~/services/output-origin'
import { notifyDatasetRunner } from '~/services/dataset-runner-callback'
import type { OutputDelivery } from '~/types/output'
import {
  getTranslatorObservabilityConfig,
  getTranslatorStatusStore,
  logTranslatorEvent,
} from '~/services/translator-observability-runtime'
import { createPhaseObserver } from '~/services/phase-observer'

export async function handleTranslateRequest(command: TranslationIngressCommand): Promise<void> {
  if (command.translatableText.trim() === '') {
    return
  }

  const cleanText = command.translatableText

  const plugin = getProviderPlugin(env.AI_PROVIDER)
  const modelId = env.AI_MODEL ?? plugin.manifest.defaultModel
  const ctx: ProviderCreateContext = { modelId }
  const baseUrl = process.env['CURSOR_API_URL']
  if (baseUrl) {
    ctx.baseUrl = baseUrl
  }
  const executor = plugin.create(ctx)
  const requestId = crypto.randomUUID()
  const origin = await resolveOutputOrigin(
    command.sourceMessageId,
    process.env['DATASET_INPUT_DIR'] ?? './input',
  )
  const observer = createPhaseObserver({
    logger: logTranslatorEvent,
    statusStore: getTranslatorStatusStore(),
    ...getTranslatorObservabilityConfig(),
    request: {
      requestId,
      sourceMessageId: command.sourceMessageId,
      originType: origin.type,
      provider: env.AI_PROVIDER,
      model: modelId,
      roomId: command.sourceRoomId,
      inputLength: Array.from(cleanText).length,
      ...(origin.datasetFile !== undefined ? { datasetFile: origin.datasetFile } : {}),
      ...(origin.datasetItemId !== undefined ? { datasetItemId: origin.datasetItemId } : {}),
      ...(origin.datasetLineNumber !== undefined
        ? { datasetLineNumber: origin.datasetLineNumber }
        : {}),
    },
  })

  observer.markRequestReceived()
  const callbackUrl =
    process.env['DATASET_RUNNER_CALLBACK_URL'] ??
    'http://dataset-runner:3002/internal/delivery-acks'

  const notifyDatasetRunnerAck = async (delivery: OutputDelivery): Promise<void> => {
    if (origin.type !== 'automation') return

    await observer.runPhase('ack_callback', async () => {
      observer.logEvent('info', 'translation_ack_callback_started', {
        phase: 'ack_callback',
        ackStatus: 'sent',
      })

      try {
        await notifyDatasetRunner(
          {
            sourceMessageId: command.sourceMessageId,
            ...delivery,
            ackedAt: new Date().toISOString(),
          },
          { callbackUrl },
        )
        observer.logEvent('info', 'translation_ack_callback_completed', {
          phase: 'ack_callback',
          ackStatus: 'sent',
        })
      } catch (error) {
        observer.logEvent('error', 'translation_ack_callback_failed', {
          phase: 'ack_callback',
          ackStatus: 'failed',
          errorCode: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    })
  }

  try {
    const timeoutMs = plugin.manifest.timeoutMs
    const pipeline = new TranslationPipeline(executor, timeoutMs ? { timeoutMs } : {})
    const { result, trace } = await pipeline.run(cleanText, {
      phaseObserver: {
        onPhaseStarted: ({ phase, round }) => {
          observer.markPhaseStarted(phase, {
            ...(round !== undefined ? { phaseRound: round } : {}),
          })
        },
        onPhaseCompleted: () => {
          observer.markPhaseCompleted()
        },
        onPhaseFailed: ({ error }) => {
          observer.markPhaseFailed(error)
        },
        onEscalationStarted: ({ round }) => {
          observer.logEvent('info', 'translation_escalation_started', {
            phase: 'review',
            phaseRound: round,
          })
        },
        onEscalationCompleted: ({ round }) => {
          observer.logEvent('info', 'translation_escalation_completed', {
            phase: 'review',
            phaseRound: round,
          })
        },
      },
    })

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']

    const outputRecord = { command, translation: result, pipeline: trace, origin }

    await writeTranslationOutput(outputRecord, ...(outputBaseDir ? [outputBaseDir] : []))

    const delivery = await observer.runPhase('delivery', async () => {
      observer.logEvent('info', 'translation_delivery_started', {
        phase: 'delivery',
      })

      const deliveryResult = await sendTranslatedMessage(command, result, {
        apiToken: env.CHATWORK_API_TOKEN,
        destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
      })

      if (deliveryResult.status === 'failed') {
        observer.logEvent('error', 'translation_delivery_failed', {
          phase: 'delivery',
          deliveryStatus: deliveryResult.status,
          ...(deliveryResult.errorCode !== undefined
            ? { errorCode: deliveryResult.errorCode }
            : {}),
          ...(deliveryResult.errorMessage !== undefined
            ? { errorMessage: deliveryResult.errorMessage }
            : {}),
        })
      } else {
        observer.logEvent('info', 'translation_delivery_completed', {
          phase: 'delivery',
          deliveryStatus: deliveryResult.status,
        })
      }

      return deliveryResult
    })

    try {
      await writeTranslationOutput(
        { ...outputRecord, delivery },
        ...(outputBaseDir ? [outputBaseDir] : []),
      )
      observer.logEvent('info', 'translation_output_persisted', {
        deliveryStatus: delivery.status,
      })
    } catch (error) {
      const messageId = command.sourceMessageId
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'output-rewrite-failed',
          messageId,
          errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
          error: error instanceof Error ? error.message : String(error),
          context: { origin: outputRecord.origin, deliveryStatus: delivery.status },
        }),
      )
      throw error
    }

    await notifyDatasetRunnerAck(delivery)

    observer.completeRequest({
      finalPhase: origin.type === 'automation' ? 'ack_callback' : 'delivery',
      deliveryStatus: delivery.status,
      ...(origin.type === 'automation' ? { ackStatus: 'sent' as const } : {}),
    })
  } catch (error) {
    const errorCode =
      error instanceof TranslationError
        ? error.code
        : error instanceof Error
          ? error.name
          : 'UnknownError'
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (origin.type === 'automation') {
      const failedDelivery: OutputDelivery = {
        status: 'failed',
        destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
        sentAt: new Date().toISOString(),
        errorCode,
        errorMessage,
      }

      try {
        await notifyDatasetRunnerAck(failedDelivery)
      } catch {
        // Ack callback failure is intentionally logged inside notifyDatasetRunnerAck.
        // Fallthrough to report the original translation error to keep error visibility.
      }
    }

    if (error instanceof TranslationError) {
      observer.failRequest({
        finalStatus: error.code === 'ABORTED' ? 'aborted' : 'failed',
        errorCode: error.code,
        errorMessage: error.message,
      })
      return
    }

    observer.failRequest({
      finalStatus: 'failed',
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
