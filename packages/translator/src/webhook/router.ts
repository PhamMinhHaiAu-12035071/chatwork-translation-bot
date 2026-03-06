import { timingSafeEqual } from 'crypto'
import { Elysia, t } from 'elysia'
import { ChatworkWebhookEventSchema } from '@chatwork-bot/core'
import { env } from '~/env'
import { handleTranslateRequest } from './handler'

function isValidSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const translateRoutes = new Elysia({ name: 'translator:webhook' }).post(
  '/internal/translate',
  ({ body, request, set }) => {
    const secret = request.headers.get('x-internal-secret') ?? ''
    if (!isValidSecret(secret, env.INTERNAL_TRANSLATE_SECRET)) {
      set.status = 401
      return 'Unauthorized'
    }

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
