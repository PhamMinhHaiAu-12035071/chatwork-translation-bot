import { getProviderPlugin, TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, ProviderCreateContext } from '@chatwork-bot/core'
import type { RoomConfigStore } from '~/services/room-config-store'
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

interface HandleTranslateRequestDeps {
  store: RoomConfigStore
  chatworkApiToken: string
}

interface TranslateRequestContext {
  traceId?: string
}

let translateRequestHandler:
  | ((command: TranslationIngressCommand, context?: TranslateRequestContext) => Promise<void>)
  | null = null

export function initTranslateHandler(deps: HandleTranslateRequestDeps): void {
  translateRequestHandler = createHandleTranslateRequest(deps)
}

export function createHandleTranslateRequest(deps: HandleTranslateRequestDeps) {
  return async function handleTranslateRequest(
    command: TranslationIngressCommand,
    context: TranslateRequestContext = {},
  ): Promise<void> {
    const traceId = context.traceId ?? crypto.randomUUID()
    const roomConfig = deps.store.getByOriginalRoomId(command.sourceRoomId)

    if (roomConfig === null) {
      console.log(
        JSON.stringify({
          level: 'warn',
          service: 'translator',
          event: 'translation_skipped_no_room_config',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          sourceMessageId: command.sourceMessageId,
        }),
      )
      return
    }

    if (!roomConfig.enabled) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_room_disabled',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          roomConfigId: roomConfig.id,
          sourceMessageId: command.sourceMessageId,
          nextExpectedAction: 'enable_room',
        }),
      )
      return
    }

    if (command.translatableText.trim() === '' && !hasMeaningfulLiteralStructure(command)) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_empty',
          timestamp: new Date().toISOString(),
          traceId,
          sourceMessageId: command.sourceMessageId,
          sourceEventType: command.sourceEventType,
          rawBodyLength: command.rawBody.length,
          rawBodyPreview: command.rawBody.slice(0, 300),
        }),
      )
      return
    }

    const cleanText = command.translatableText
    const aiApiToken = await deps.store.decryptApiToken(roomConfig.encryptedAiApiToken)
    const plugin = getProviderPlugin(roomConfig.aiProvider)
    const modelId = roomConfig.aiModel ?? plugin.manifest.defaultModel
    const translationStyle = roomConfig.translationStyle
    const ctx: ProviderCreateContext = {
      modelId,
      apiKey: aiApiToken,
    }
    const executor = plugin.create(ctx)
    const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
      envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
      hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
      providerTimeoutMs: plugin.manifest.timeoutMs,
    })

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'translation_room_resolved',
        timestamp: new Date().toISOString(),
        traceId,
        sourceMessageId: command.sourceMessageId,
        sourceRoomId: command.sourceRoomId,
        roomConfigId: roomConfig.id,
        destinationRoomId: roomConfig.destinationRoomId,
        enabled: roomConfig.enabled,
      }),
    )

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
        traceId,
        sourceMessageId: command.sourceMessageId,
        originType: origin.type,
        provider: roomConfig.aiProvider,
        model: modelId,
        translationStyle,
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
    observer.logEvent('info', 'translation_provider_selected', {
      aiProvider: roomConfig.aiProvider,
      resolvedModel: modelId,
      translationStyle,
    })
    observer.logEvent('info', 'translation_pipeline_started', {
      sourceMessageId: command.sourceMessageId,
    })

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
      const pipeline = new TranslationPipeline(executor, {
        timeoutMs: effectiveTimeoutMs,
        translationStyle,
      })
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
          apiToken: deps.chatworkApiToken,
          destinationRoomId: roomConfig.destinationRoomId,
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
            service: 'translator',
            event: 'output-rewrite-failed',
            timestamp: new Date().toISOString(),
            traceId,
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
          destinationRoomId: roomConfig.destinationRoomId,
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
}

export async function handleTranslateRequest(
  command: TranslationIngressCommand,
  context?: TranslateRequestContext,
): Promise<void> {
  if (translateRequestHandler === null) {
    throw new Error('Translate handler not initialized')
  }

  return translateRequestHandler(command, context)
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
