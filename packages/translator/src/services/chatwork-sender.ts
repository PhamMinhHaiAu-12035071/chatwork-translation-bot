import {
  ChatworkApiError,
  ChatworkRateLimitError,
  composeTranslatedMessagePair,
  sendRoomMessage,
} from '@chatwork-bot/chatwork'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery, OutputDeliveryMessage } from '~/types/output'

const MAX_RETRIES = 2
// Matches Bun fetch error messages for network/connection failures.
// Observed variants: "Unable to connect..." (contains "connect"),
// "Was there a typo in the url or port?" (contains "typo"),
// "fetch failed" (contains "fetch"), ECONNREFUSED, timeout.
const NETWORK_ERROR_PATTERN = /connect|fetch|ECONNREFUSED|timeout|typo/i

interface SendTranslatedMessageConfig {
  apiToken: string
  destinationRoomId: number
  translatedSegments?: string[]
}

type DeliveryStage = 'metadata' | 'body'

// MUST check ChatworkRateLimitError before ChatworkApiError (subclass ordering):
// ChatworkRateLimitError extends ChatworkApiError — checking the base class first
// would match rate-limit errors as non-retriable before the subclass check is reached.
// Error (not TypeError) is used because Bun throws plain Error for TCP connection
// failures (e.g. "Unable to connect..."), not TypeError as originally assumed.
// ChatworkApiError is explicitly excluded before the pattern check so that HTTP
// errors (auth, 4xx/5xx) are never retried even if their messages match the pattern.
function isRetriable(error: unknown): boolean {
  if (error instanceof ChatworkRateLimitError) return true
  if (error instanceof ChatworkApiError) return false
  if (error instanceof Error && NETWORK_ERROR_PATTERN.test(error.message)) return true
  return false
}

function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof ChatworkRateLimitError) {
    return Math.min(error.retryAfter * 1000, 10_000)
  }
  if (error instanceof Error) {
    return 1000 * Math.pow(2, attempt - 1)
  }
  throw new Error('unreachable: retryDelayMs called with non-retriable error')
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

function getTranslatedSegments(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: SendTranslatedMessageConfig,
): string[] {
  if (config.translatedSegments !== undefined) {
    return config.translatedSegments
  }

  if (command.translationInputs.length === 0) {
    return []
  }

  return [result.translatedText]
}

async function sendStageMessage(
  stage: DeliveryStage,
  message: string,
  config: SendTranslatedMessageConfig,
  sleepFn: (ms: number) => Promise<void>,
): Promise<OutputDeliveryMessage> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await sendRoomMessage(config.destinationRoomId, message, config.apiToken)

      return {
        kind: stage,
        status: 'sent',
        destinationMessageId: response.message_id,
      }
    } catch (error) {
      if (attempt <= MAX_RETRIES && isRetriable(error)) {
        const delayMs = retryDelayMs(error, attempt)
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'translator',
            event: 'translation_delivery_retrying',
            stage,
            attempt: attempt + 1,
            maxAttempts: MAX_RETRIES + 1,
            delayMs,
            errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
          }),
        )
        await sleepFn(delayMs)
        continue
      }

      const { errorCode, errorMessage } = toDeliveryError(error)
      return {
        kind: stage,
        status: 'failed',
        errorCode,
        errorMessage,
      }
    }
  }

  throw new Error('unreachable: retry loop exited without returning')
}

/**
 * Sends the translated output to the destination Chatwork room as two messages:
 * a compact metadata/context message followed by the translated body.
 * Retries still apply only to transient failures and are scoped per stage so that
 * a successful metadata send is never repeated if the body stage later retries.
 *
 * sleepFn is injectable for testing: Bun has no clean way to mock Bun.sleep()
 * without parameter injection.
 */
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: SendTranslatedMessageConfig,
  sleepFn: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<OutputDelivery> {
  const sentAt = new Date().toISOString()

  try {
    const translatedSegments = getTranslatedSegments(command, result, config)
    const { metadataMessage, bodyMessage } = await composeTranslatedMessagePair(command, {
      apiToken: config.apiToken,
      translatedSegments,
    })

    const metadataDelivery = await sendStageMessage('metadata', metadataMessage, config, sleepFn)
    if (metadataDelivery.status === 'failed') {
      return {
        status: 'failed',
        destinationRoomId: config.destinationRoomId,
        messages: [metadataDelivery],
        ...(metadataDelivery.errorCode !== undefined
          ? { errorCode: metadataDelivery.errorCode }
          : {}),
        ...(metadataDelivery.errorMessage !== undefined
          ? { errorMessage: metadataDelivery.errorMessage }
          : {}),
        sentAt,
      }
    }

    const bodyDelivery = await sendStageMessage('body', bodyMessage, config, sleepFn)
    if (bodyDelivery.status === 'failed') {
      return {
        status: 'partial',
        destinationRoomId: config.destinationRoomId,
        messages: [metadataDelivery, bodyDelivery],
        ...(bodyDelivery.errorCode !== undefined ? { errorCode: bodyDelivery.errorCode } : {}),
        ...(bodyDelivery.errorMessage !== undefined
          ? { errorMessage: bodyDelivery.errorMessage }
          : {}),
        sentAt,
      }
    }

    return {
      status: 'sent',
      destinationRoomId: config.destinationRoomId,
      messages: [metadataDelivery, bodyDelivery],
      ...(bodyDelivery.destinationMessageId !== undefined
        ? { destinationMessageId: bodyDelivery.destinationMessageId }
        : {}),
      sentAt,
    }
  } catch (error) {
    const { errorCode, errorMessage } = toDeliveryError(error)
    return {
      status: 'failed',
      destinationRoomId: config.destinationRoomId,
      errorCode,
      errorMessage,
      sentAt,
    }
  }
}
