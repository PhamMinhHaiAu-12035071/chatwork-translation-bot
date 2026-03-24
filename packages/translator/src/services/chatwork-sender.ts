import {
  sendRoomMessage,
  resolveRoomMemberDisplayName,
  ChatworkApiError,
  ChatworkRateLimitError,
} from '@chatwork-bot/chatwork'
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

const MAX_RETRIES = 2
const NETWORK_ERROR_PATTERN = /connect|fetch|ECONNREFUSED|timeout/i

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

/**
 * Builds the translated message string to send to the destination Chatwork room.
 * Preserves [To:xxx] and [cc:xxx] markup tags from the original body.
 * Wraps content in Chatwork [info][title] block with metadata.
 */
export function buildTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  senderName: string,
): string {
  const { rawBody, sendTime } = command

  const timeStr = new Date(sendTime * 1000).toISOString().slice(0, 16).replace('T', ' ')
  const title = `📨 From: ${senderName} | ${timeStr}`

  const markupTags = (rawBody.match(/\[(?:To|cc):\d+\]/g) ?? []).join('')
  const content = markupTags ? `${markupTags}\n${result.translatedText}` : result.translatedText

  return `[info][title]${title}[/title]\n${content}[/info]`
}

async function deliverMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery> {
  const cache = new Map<number, string>()
  const senderName = await resolveRoomMemberDisplayName(
    command.sourceRoomId,
    command.senderAccountId,
    config.apiToken,
    cache,
  )

  const message = buildTranslatedMessage(command, result, senderName)
  const response = await sendRoomMessage(config.destinationRoomId, message, config.apiToken)

  return {
    status: 'sent',
    destinationRoomId: config.destinationRoomId,
    destinationMessageId: response.message_id,
    sentAt: new Date().toISOString(),
  }
}

/**
 * Looks up the sender's name, builds the translated message, and sends it
 * to the configured destination Chatwork room.
 * Retries on transient network errors (TypeError with network message) and
 * rate limit errors (429) with exponential backoff. Max 3 total attempts.
 * Returns delivery metadata — never throws; errors are captured in the returned status.
 *
 * sleepFn is injectable for testing: Bun has no clean way to mock Bun.sleep()
 * without parameter injection.
 */
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
  sleepFn: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<OutputDelivery> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await deliverMessage(command, result, config)
    } catch (error) {
      if (attempt <= MAX_RETRIES && isRetriable(error)) {
        const delayMs = retryDelayMs(error, attempt)
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'translator',
            event: 'translation_delivery_retrying',
            attempt: attempt + 1, // next attempt number: attempt=1 failed, retrying as attempt 2
            maxAttempts: MAX_RETRIES + 1,
            delayMs,
            errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
          }),
        )
        await sleepFn(delayMs)
        continue
      }
      return {
        status: 'failed',
        destinationRoomId: config.destinationRoomId,
        errorCode: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        sentAt: new Date().toISOString(),
      }
    }
  }
  // Unreachable: loop always returns inside try or catch
  throw new Error('unreachable: retry loop exited without returning')
}
