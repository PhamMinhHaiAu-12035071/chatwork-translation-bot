import { Elysia, t } from 'elysia'
import { TranslationIngressCommandSchema } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  ({ body }) => {
    void handleTranslateRequest(body.command).catch((err: unknown) => {
      console.error('[router] Background handler error:', err)
    })
    return 'OK'
  },
  {
    body: t.Object({
      command: TranslationIngressCommandSchema,
    }),
  },
)
