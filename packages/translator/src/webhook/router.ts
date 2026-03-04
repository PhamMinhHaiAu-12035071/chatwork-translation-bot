import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  ({ body }) => {
    // body.event is typed as ChatworkWebhookEvent — validated by Elysia automatically
    void handleTranslateRequest(body.event).catch((err: unknown) => {
      console.error('[router] Background handler error:', err)
    })
    return 'OK'
  },
  {
    body: t.Object({
      event: ChatworkWebhookEventSchema,
    }),
  },
)
