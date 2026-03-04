import { Elysia } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '../env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' }).post(
  '/webhook',
  ({ body }) => {
    // body is typed as ChatworkWebhookEvent — validated by Elysia automatically
    void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: body }),
    }).catch((err: unknown) => {
      console.error('[webhook] Failed to forward to translator:', err)
    })

    return 'OK'
  },
  {
    body: ChatworkWebhookEventSchema,
  },
)
