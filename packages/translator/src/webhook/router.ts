import { Elysia, t } from 'elysia'
import { TranslationIngressCommandSchema } from '@chatwork-bot/core'
import type { TranslationQueue } from '@chatwork-bot/message-queue'

let translationQueue: TranslationQueue | null = null

export function initTranslationQueue(queue: TranslationQueue): void {
  translationQueue = queue
}

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  async ({ body, headers }) => {
    const traceId = headers['x-trace-id'] ?? crypto.randomUUID()

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'translation_ingress_received',
        timestamp: new Date().toISOString(),
        traceId,
        sourceMessageId: body.command.sourceMessageId,
        sourceRoomId: body.command.sourceRoomId,
      }),
    )

    if (translationQueue === null) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'translation_queue_not_initialized',
          timestamp: new Date().toISOString(),
          traceId,
        }),
      )
      return 'OK'
    }

    const result = await translationQueue.enqueue(body.command.sourceRoomId, body.command, traceId)

    if (!result.accepted) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'translation_ingress_dispatch_failed',
          timestamp: new Date().toISOString(),
          traceId,
          sourceMessageId: body.command.sourceMessageId,
          sourceRoomId: body.command.sourceRoomId,
          errorCode: 'BACKPRESSURE',
          errorMessage: `Queue rejected message: ${result.reason}`,
        }),
      )
    }

    return 'OK'
  },
  {
    body: t.Object({
      command: TranslationIngressCommandSchema,
    }),
  },
)
