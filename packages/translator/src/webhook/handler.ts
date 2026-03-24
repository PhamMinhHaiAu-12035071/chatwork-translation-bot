import { getProviderPlugin, TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, ProviderCreateContext } from '@chatwork-bot/core'
import { env } from '~/env'
import { TranslationPipeline } from '~/pipeline/pipeline'
import { writeTranslationOutput } from '~/utils/output-writer'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
import { resolveOutputOrigin } from '~/services/output-origin'
import {
  buildDatasetRunnerAckPayload,
  notifyDatasetRunner,
} from '~/services/dataset-runner-callback'
import type { OutputDelivery } from '~/types/output'
import {
  getTranslatorObservabilityConfig,
  getTranslatorStatusStore,
  logTranslatorEvent,
} from '~/services/translator-observability-runtime'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { createPhaseObserver } from '~/services/phase-observer'

export async function handleTranslateRequest(command: TranslationIngressCommand): Promise<void> {
  if (command.translatableText.trim() === '' && !hasMeaningfulLiteralStructure(command)) {
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
  const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
    envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
    hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
    providerTimeoutMs: plugin.manifest.timeoutMs,
  })
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
      pipelineTimeoutMs: effectiveTimeoutMs,
      pipelineTimeoutSource: timeoutSource,
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
          buildDatasetRunnerAckPayload({
            sourceMessageId: command.sourceMessageId,
            delivery,
            ackedAt: new Date().toISOString(),
          }),
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
    const pipeline = new TranslationPipeline(executor, { timeoutMs: effectiveTimeoutMs })
    const pipelineResult = await pipeline.runStructured(
      {
        cleanText,
        translationInputs: command.translationInputs,
      },
      {
        phaseObserver: {
          onPhaseStarted: ({ phase }) => {
            observer.markPhaseStarted(phase, {})
          },
          onPhaseCompleted: () => {
            observer.markPhaseCompleted()
          },
          onPhaseFailed: ({ error }) => {
            observer.markPhaseFailed(error)
          },
        },
      },
    )

    const result = pipelineResult.translation

    const outputBaseDir = process.env['OUTPUT_BASE_DIR']

    const outputRecord = { command, translation: result, origin }

    await writeTranslationOutput(outputRecord, ...(outputBaseDir ? [outputBaseDir] : []))

    const delivery = await observer.runPhase('delivery', async () => {
      observer.logEvent('info', 'translation_delivery_started', {
        phase: 'delivery',
      })

      const deliveryResult = await sendTranslatedMessage(command, result, {
        apiToken: env.CHATWORK_API_TOKEN,
        destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
        translatedSegments: pipelineResult.translatedSegments,
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

interface DecorationSnapshotEnvelope {
  snapshot?: {
    renderTemplate?: MessageRenderNodeLike[]
  }
}

type MessageRenderNodeLike =
  | { type: 'literal'; content?: string }
  | { type: 'translationSlot' }
  | { type: 'hr' }
  | { type: 'code'; content?: string }
  | { type: 'info' | 'title' | 'quote' | 'qt'; children?: MessageRenderNodeLike[] }

function hasMeaningfulLiteralStructure(command: TranslationIngressCommand): boolean {
  const rawSnapshot = command.audit.rawSourceSnapshot as DecorationSnapshotEnvelope
  const renderTemplate = rawSnapshot.snapshot?.renderTemplate
  if (renderTemplate === undefined) return false
  return renderNodesHaveMeaningfulLiteralStructure(renderTemplate)
}

function renderNodesHaveMeaningfulLiteralStructure(nodes: MessageRenderNodeLike[]): boolean {
  return nodes.some((node) => renderNodeHasMeaningfulLiteralStructure(node))
}

function renderNodeHasMeaningfulLiteralStructure(node: MessageRenderNodeLike): boolean {
  if (node.type === 'translationSlot') return false
  if (node.type === 'hr') return true
  if (node.type === 'literal') return (node.content?.trim().length ?? 0) > 0
  if (node.type === 'code') return (node.content?.trim().length ?? 0) > 0
  return renderNodesHaveMeaningfulLiteralStructure(node.children ?? [])
}
