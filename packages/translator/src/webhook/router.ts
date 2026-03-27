import { Elysia, t } from 'elysia'
import { TranslationIngressCommandSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  ({ body, headers }) => {
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

    void handleTranslateRequest(body.command, { traceId }).catch((err: unknown) => {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'translation_ingress_dispatch_failed',
          timestamp: new Date().toISOString(),
          traceId,
          sourceMessageId: body.command.sourceMessageId,
          sourceRoomId: body.command.sourceRoomId,
          errorCode: err instanceof Error ? err.name : 'UnknownError',
          errorMessage: err instanceof Error ? err.message : String(err),
        }),
      )
    })
    return 'OK'
  },
  {
    body: t.Object({
      command: TranslationIngressCommandSchema,
    }),
  },
)
