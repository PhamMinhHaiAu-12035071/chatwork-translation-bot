import { Elysia, t } from 'elysia'
import { TranslationIngressCommandSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'
import { handleFreeTranslateRequest } from './free-handler'

function logDispatchFailure(params: {
  traceId: string
  handlerType: 'standard' | 'free'
  command: {
    sourceMessageId: string
    sourceRoomId: number
  }
  error: unknown
}) {
  const { traceId, handlerType, command, error } = params

  console.error(
    JSON.stringify({
      level: 'error',
      service: 'translator',
      event: 'translation_ingress_dispatch_failed',
      timestamp: new Date().toISOString(),
      traceId,
      handlerType,
      sourceMessageId: command.sourceMessageId,
      sourceRoomId: command.sourceRoomId,
      errorCode: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    }),
  )
}

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

    void Promise.allSettled([
      handleTranslateRequest(body.command, { traceId }).catch((error: unknown) => {
        logDispatchFailure({
          traceId,
          handlerType: 'standard',
          command: body.command,
          error,
        })
      }),
      handleFreeTranslateRequest(body.command, { traceId }).catch((error: unknown) => {
        logDispatchFailure({
          traceId,
          handlerType: 'free',
          command: body.command,
          error,
        })
      }),
    ])
    return 'OK'
  },
  {
    body: t.Object({
      command: TranslationIngressCommandSchema,
    }),
  },
)
