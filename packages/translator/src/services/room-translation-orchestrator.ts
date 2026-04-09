import { buildMentionHint, extractMentionContext } from '@chatwork-bot/chatwork'
import type { MessageDecorationSnapshot } from '@chatwork-bot/chatwork'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import { mask as maskKeywords, restore as restoreKeywords } from '~/services/keyword-redactor'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
import {
  buildDatasetRunnerAckPayload,
  notifyDatasetRunner,
} from '~/services/dataset-runner-callback'
import { hasMeaningfulLiteralStructure } from '~/services/message-structure'
import { resolveOutputOrigin } from '~/services/output-origin'
import { createPhaseObserver } from '~/services/phase-observer'
import {
  getTranslatorObservabilityConfig,
  getTranslatorStatusStore,
  logTranslatorEvent,
} from '~/services/translator-observability-runtime'
import { llmProviderBreaker, chatworkApiBreaker } from '~/services/circuit-breaker'
import type { KeywordEntry } from '~/types/keyword-entry'
import type {
  TranslatorLogEntry,
  TranslatorPhase,
  TranslatorRequestContext,
} from '~/types/observability'
import type { OutputDelivery, OutputLLM } from '~/types/output'
import type { RoomTranslationBackend, RoomTranslationBackendResult } from './translation-backend'
import { writeTranslationOutput } from '~/utils/output-writer'

interface RoomTranslationPhaseObserver {
  markRequestReceived(): void
  logEvent(
    level: TranslatorLogEntry['level'],
    event: string,
    extra?: Partial<TranslatorLogEntry>,
  ): void
  runPhase<T>(
    phase: TranslatorPhase,
    run: () => Promise<T>,
    options?: { phaseRound?: number },
  ): Promise<T>
  markPhaseStarted(phase: TranslatorPhase, options?: { phaseRound?: number }): void
  markPhaseCompleted(): void
  markPhaseFailed(error: unknown): void
  completeRequest(params: {
    finalPhase: TranslatorPhase
    deliveryStatus?: 'sent' | 'partial' | 'failed'
    ackStatus?: 'sent' | 'failed'
  }): void
  failRequest(params: {
    finalStatus: 'failed' | 'aborted'
    errorCode: string
    errorMessage: string
  }): void
}

interface RoomTranslationTarget {
  id: string
  enabled: boolean
  destinationRoomId: number
  context?: string | null
  protectedKeywords?: KeywordEntry[]
}

interface RoomTranslationMetadata {
  provider: string
  model: string
  translationStyle: string
  pipelineTimeoutMs?: number
  pipelineTimeoutSource?: 'env' | 'provider' | 'default'
  buildOutputLlm?: (params: {
    translation: TranslationResult
    backendResult: RoomTranslationBackendResult
  }) => OutputLLM | undefined
}

interface RoomTranslationOrchestratorDeps {
  chatworkApiToken: string
  outputBaseDir?: string
  datasetInputDir?: string
  datasetRunnerCallbackUrl?: string
  resolveOutputOrigin?: typeof resolveOutputOrigin
  writeTranslationOutput?: typeof writeTranslationOutput
  sendTranslatedMessage?: typeof sendTranslatedMessage
  notifyDatasetRunner?: typeof notifyDatasetRunner
  buildDatasetRunnerAckPayload?: typeof buildDatasetRunnerAckPayload
  createPhaseObserver?: (config: {
    logger: typeof logTranslatorEvent
    statusStore: ReturnType<typeof getTranslatorStatusStore>
    heartbeatMs: number
    phaseBudgets: Record<TranslatorPhase, number>
    request: TranslatorRequestContext
  }) => RoomTranslationPhaseObserver
}

interface OrchestrateRoomTranslationParams<TRuntimeConfig> {
  command: TranslationIngressCommand
  traceId?: string
  room: RoomTranslationTarget
  runtimeConfig: TRuntimeConfig
  backend: RoomTranslationBackend<TRuntimeConfig>
  metadata: RoomTranslationMetadata
}

function toDeliveryError(error: unknown): { errorCode: string; errorMessage: string } {
  if (error instanceof Error) {
    return {
      errorCode: error.constructor.name,
      errorMessage: error.message,
    }
  }

  return {
    errorCode: 'UnknownError',
    errorMessage: String(error),
  }
}

function buildTranslationResult(
  cleanText: string,
  translatedText: string,
  sourceLang: string,
): TranslationResult {
  return {
    cleanText,
    translatedText,
    sourceLang,
    targetLang: 'Vietnamese',
    timestamp: new Date().toISOString(),
  }
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()

  // HTTP status codes that should be retried
  const retryablePatterns = [
    '429', // Rate limit
    '503', // Service unavailable
    '504', // Gateway timeout
    'timeout',
    'econnreset',
    'econnrefused',
    'network',
  ]

  return retryablePatterns.some((pattern) => message.includes(pattern))
}

export function createRoomTranslationOrchestrator(deps: RoomTranslationOrchestratorDeps) {
  const resolveOrigin = deps.resolveOutputOrigin ?? resolveOutputOrigin
  const persistOutput = deps.writeTranslationOutput ?? writeTranslationOutput
  const deliverTranslation = deps.sendTranslatedMessage ?? sendTranslatedMessage
  const notifyAck = deps.notifyDatasetRunner ?? notifyDatasetRunner
  const buildAckPayload = deps.buildDatasetRunnerAckPayload ?? buildDatasetRunnerAckPayload
  const makeObserver = deps.createPhaseObserver ?? createPhaseObserver

  return async function orchestrateRoomTranslation<TRuntimeConfig>(
    params: OrchestrateRoomTranslationParams<TRuntimeConfig>,
  ): Promise<void> {
    const traceId = params.traceId ?? crypto.randomUUID()
    const { command, room, runtimeConfig, backend, metadata } = params

    if (!room.enabled) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_room_disabled',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
          roomConfigId: room.id,
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

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'translation_room_resolved',
        timestamp: new Date().toISOString(),
        traceId,
        sourceMessageId: command.sourceMessageId,
        sourceRoomId: command.sourceRoomId,
        roomConfigId: room.id,
        destinationRoomId: room.destinationRoomId,
        enabled: room.enabled,
      }),
    )

    const requestId = crypto.randomUUID()
    const origin = await resolveOrigin(
      command.sourceMessageId,
      deps.datasetInputDir ?? process.env['DATASET_INPUT_DIR'] ?? './input',
    )
    const observer = makeObserver({
      logger: logTranslatorEvent,
      statusStore: getTranslatorStatusStore(),
      ...getTranslatorObservabilityConfig(),
      request: {
        requestId,
        traceId,
        sourceMessageId: command.sourceMessageId,
        originType: origin.type,
        provider: metadata.provider,
        model: metadata.model,
        translationStyle: metadata.translationStyle,
        roomId: command.sourceRoomId,
        inputLength: Array.from(command.translatableText).length,
        ...(metadata.pipelineTimeoutMs !== undefined
          ? { pipelineTimeoutMs: metadata.pipelineTimeoutMs }
          : {}),
        ...(metadata.pipelineTimeoutSource !== undefined
          ? { pipelineTimeoutSource: metadata.pipelineTimeoutSource }
          : {}),
        ...(origin.datasetFile !== undefined ? { datasetFile: origin.datasetFile } : {}),
        ...(origin.datasetItemId !== undefined ? { datasetItemId: origin.datasetItemId } : {}),
        ...(origin.datasetLineNumber !== undefined
          ? { datasetLineNumber: origin.datasetLineNumber }
          : {}),
      },
    })

    observer.markRequestReceived()
    observer.logEvent('info', 'translation_provider_selected', {
      aiProvider: metadata.provider,
      resolvedModel: metadata.model,
      translationStyle: metadata.translationStyle,
    })
    observer.logEvent('info', 'translation_pipeline_started', {
      sourceMessageId: command.sourceMessageId,
    })

    const callbackUrl =
      deps.datasetRunnerCallbackUrl ??
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
          await notifyAck(
            buildAckPayload({
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
      const cleanText = command.translatableText
      const trimmedRoomContext = room.context?.trim()
      const hasRoomContextForPipeline =
        trimmedRoomContext !== undefined && trimmedRoomContext.length > 0

      if (hasRoomContextForPipeline) {
        observer.logEvent('info', 'translation_context_applied', {
          roomContextApplied: true,
          roomContextLength: Array.from(trimmedRoomContext).length,
        } as Partial<TranslatorLogEntry>)
      }

      const keywords = room.protectedKeywords ?? []
      const { maskedText, restoreMap, systemHint } = maskKeywords(cleanText, keywords)
      const maskedTranslationInputs = command.translationInputs.map(
        (segment) => maskKeywords(segment, keywords).maskedText,
      )

      const primaryTextChangedByMask = cleanText.normalize('NFC') !== maskedText
      const segmentsChangedByMaskCount = command.translationInputs.filter(
        (segment, index) => segment.normalize('NFC') !== maskedTranslationInputs[index],
      ).length

      observer.logEvent('info', 'translation_keywords_masked', {
        configuredKeywordCount: keywords.length,
        primaryTextChangedByMask,
        translationInputSegmentCount: command.translationInputs.length,
        segmentsChangedByMaskCount,
        hasSystemHint: systemHint.length > 0,
      } as Partial<TranslatorLogEntry>)

      const rawEnvelope = command.audit.rawSourceSnapshot as {
        snapshot?: MessageDecorationSnapshot
      }
      const mentionHint =
        rawEnvelope.snapshot !== undefined
          ? buildMentionHint(
              extractMentionContext(
                rawEnvelope.snapshot.renderTemplate,
                rawEnvelope.snapshot.metadata,
              ),
            )
          : undefined

      if (mentionHint !== undefined) {
        observer.logEvent('info', 'translation_mention_hint_applied', {
          mentionHint: mentionHint.slice(0, 100),
        } as Partial<TranslatorLogEntry>)
      }

      const backendResult =
        command.translationInputs.length === 0
          ? {
              sourceLang: 'Unknown',
              translatedText: '',
              translatedSegments: [],
            }
          : await llmProviderBreaker.execute(async () =>
              backend.translate({
                cleanText: maskedText,
                translationInputs: maskedTranslationInputs,
                ...(hasRoomContextForPipeline ? { roomContext: trimmedRoomContext } : {}),
                ...(systemHint ? { keywordSystemHint: systemHint } : {}),
                ...(mentionHint !== undefined ? { mentionHint } : {}),
                runtimeConfig,
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
              }),
            )

      if (backendResult.translatedSegments.length !== command.translationInputs.length) {
        throw new TranslationError('Translation segment count mismatch', 'INVALID_RESPONSE')
      }

      const result: TranslationResult = {
        ...buildTranslationResult(
          cleanText,
          restoreKeywords(backendResult.translatedText, restoreMap),
          backendResult.sourceLang,
        ),
      }
      const restoredTranslatedSegments = backendResult.translatedSegments.map((segment) =>
        restoreKeywords(segment, restoreMap),
      )

      const primaryTranslationChangedByRestore =
        backendResult.translatedText !== result.translatedText
      const segmentsChangedByRestoreCount = backendResult.translatedSegments.filter(
        (segment, index) => segment !== restoredTranslatedSegments[index],
      ).length

      observer.logEvent('info', 'translation_keywords_restored', {
        configuredKeywordCount: keywords.length,
        primaryTranslationChangedByRestore,
        segmentsChangedByRestoreCount,
      } as Partial<TranslatorLogEntry>)

      const llm = metadata.buildOutputLlm?.({
        translation: result,
        backendResult,
      })
      const outputRecord = {
        command,
        translation: result,
        origin,
        ...(llm !== undefined ? { llm } : {}),
      }

      const outputBaseDir = deps.outputBaseDir ?? process.env['OUTPUT_BASE_DIR']
      await persistOutput(outputRecord, ...(outputBaseDir ? [outputBaseDir] : []))

      // Async delivery helper with exponential backoff retry
      const deliverAsync = async (): Promise<void> => {
        const maxRetries = 3
        const baseDelayMs = 1000

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const delivery = await observer.runPhase('delivery', async () => {
              observer.logEvent('info', 'translation_delivery_started', {
                phase: 'delivery',
              })

              const deliveryResult = await chatworkApiBreaker.execute(async () =>
                deliverTranslation(command, result, {
                  apiToken: deps.chatworkApiToken,
                  destinationRoomId: room.destinationRoomId,
                  translatedSegments: restoredTranslatedSegments,
                }),
              )

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

            // Persist with delivery result
            try {
              await persistOutput(
                { ...outputRecord, delivery },
                ...(outputBaseDir ? [outputBaseDir] : []),
              )
              observer.logEvent('info', 'translation_output_persisted', {
                deliveryStatus: delivery.status,
              })
            } catch (error) {
              observer.logEvent('error', 'output-rewrite-failed', {
                phase: 'delivery',
                errorMessage: error instanceof Error ? error.message : String(error),
              })
              throw error
            }

            // Send ACK notification
            await notifyDatasetRunnerAck(delivery)

            observer.completeRequest({
              finalPhase: origin.type === 'automation' ? 'ack_callback' : 'delivery',
              deliveryStatus: delivery.status,
              ...(origin.type === 'automation' ? { ackStatus: 'sent' as const } : {}),
            })

            return // Success - exit retry loop
          } catch (error) {
            // Check if this is an output persistence error (not a delivery error)
            // Output persistence happens AFTER delivery succeeds, so if error occurs
            // after we have a valid delivery object, it's a persistence issue
            const isOutputPersistenceError =
              error instanceof Error &&
              (error.message.includes('rewrite') || error.stack?.includes('output-writer'))

            if (isOutputPersistenceError) {
              // Don't retry output persistence errors - they're not transient
              throw error
            }

            const isLastAttempt = attempt === maxRetries
            const isRetryable = isRetryableError(error)

            if (isLastAttempt || !isRetryable) {
              logTranslatorEvent({
                level: 'error',
                service: 'translator',
                event: 'translation_delivery_failed_permanently',
                timestamp: new Date().toISOString(),
                traceId,
                requestId: '',
                sourceMessageId: command.sourceMessageId,
                originType: origin.type,
                provider: '',
                model: '',
                translationStyle: '',
                roomId: room.destinationRoomId,
                inputLength: 0,
                errorMessage: error instanceof Error ? error.message : String(error),
              })

              // Send error notification to room (best effort)
              try {
                const errorMsg = `⚠️ Translation delivery failed after ${(attempt + 1).toString()} attempts. Please try again.`
                const errorResult = buildTranslationResult('', errorMsg, '')
                await chatworkApiBreaker.execute(async () =>
                  deliverTranslation(
                    { ...command, translatableText: errorMsg, translationInputs: [errorMsg] },
                    errorResult,
                    {
                      apiToken: deps.chatworkApiToken,
                      destinationRoomId: command.sourceRoomId,
                      translatedSegments: [errorMsg],
                    },
                  ),
                )
              } catch {
                // Swallow notification errors
              }

              return
            }

            // Retry with exponential backoff
            const delayMs = baseDelayMs * Math.pow(2, attempt)
            const jitter = Math.random() * 500

            logTranslatorEvent({
              level: 'warn',
              service: 'translator',
              event: 'translation_delivery_retrying',
              timestamp: new Date().toISOString(),
              traceId,
              requestId: '',
              sourceMessageId: command.sourceMessageId,
              originType: origin.type,
              provider: '',
              model: '',
              translationStyle: '',
              roomId: room.destinationRoomId,
              inputLength: 0,
              errorMessage: error instanceof Error ? error.message : String(error),
            })

            await new Promise((resolve) => setTimeout(resolve, delayMs + jitter))
          }
        }
      }

      // Feature flag for async vs blocking delivery
      const enableAsync = process.env['ENABLE_ASYNC_DELIVERY'] !== 'false'

      if (enableAsync) {
        // Fire-and-forget (return immediately, don't await)
        void deliverAsync()
        return
      } else {
        // Blocking fallback - await completion
        await deliverAsync()
      }
    } catch (error) {
      const { errorCode, errorMessage } =
        error instanceof TranslationError
          ? { errorCode: error.code, errorMessage: error.message }
          : toDeliveryError(error)

      if (origin.type === 'automation') {
        const failedDelivery: OutputDelivery = {
          status: 'failed',
          destinationRoomId: room.destinationRoomId,
          sentAt: new Date().toISOString(),
          errorCode,
          errorMessage,
        }

        try {
          await notifyDatasetRunnerAck(failedDelivery)
        } catch {
          // Ack callback failure is logged inside notifyDatasetRunnerAck.
        }
      }

      if (error instanceof TranslationError) {
        observer.failRequest({
          finalStatus: error.code === 'ABORTED' ? 'aborted' : 'failed',
          errorCode,
          errorMessage,
        })
        return
      }

      observer.failRequest({
        finalStatus: 'failed',
        errorCode,
        errorMessage,
      })
      throw error
    }
  }
}
