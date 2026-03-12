import { Elysia } from 'elysia'
import {
  verifyWebhookSignature,
  normalizeWebhookPayload,
  mapWebhookToTranslationCommand,
  ChatworkWebhookSignatureError,
  ChatworkWebhookPayloadError,
} from '@chatwork-bot/chatwork'
import { env } from '~/env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
  .derive(async ({ request }) => ({
    rawBody: await request.clone().text(),
  }))
  .post('/webhook', ({ rawBody, headers }) => handleWebhook(rawBody, headers))
  .post('/', ({ rawBody, headers }) => handleWebhook(rawBody, headers))

async function handleWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<Response> {
  // --- Signature verification ---
  const signature = headers['x-chatworkwebhooksignature']
  if (!signature) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'webhook_signature_missing',
        timestamp: new Date().toISOString(),
        errorCode: 'WEBHOOK_SIGNATURE_MISSING',
        errorMessage: 'Missing X-ChatWorkWebhookSignature header',
      }),
    )
    return new Response('Missing signature header', { status: 422 })
  }

  const skipVerify = env.CHATWORK_SKIP_SIGNATURE_VERIFY && env.NODE_ENV !== 'production'
  if (skipVerify) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'webhook-logger',
        event: 'webhook_signature_verification_bypassed',
        timestamp: new Date().toISOString(),
        message: 'Signature verification bypassed (CHATWORK_SKIP_SIGNATURE_VERIFY=true)',
      }),
    )
  }

  try {
    verifyWebhookSignature(rawBody, signature, env.CHATWORK_WEBHOOK_SECRET, {
      skip: skipVerify,
      env: env.NODE_ENV,
    })
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookSignatureError) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'webhook_signature_invalid',
          timestamp: new Date().toISOString(),
          errorCode: 'WEBHOOK_SIGNATURE_INVALID',
          errorMessage: err.message,
        }),
      )
      return new Response('Invalid webhook signature', { status: 422 })
    }
    throw err
  }

  // --- Payload normalization ---
  let payload: ReturnType<typeof normalizeWebhookPayload>
  try {
    payload = normalizeWebhookPayload(rawBody)
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookPayloadError) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'webhook_payload_invalid',
          timestamp: new Date().toISOString(),
          errorCode: 'WEBHOOK_PAYLOAD_INVALID',
          errorMessage: err.message,
        }),
      )
      return new Response('Invalid webhook payload', { status: 422 })
    }
    throw err
  }

  // --- Map to neutral DTO ---
  const command = mapWebhookToTranslationCommand(payload, new Date().toISOString())

  const sourceMessageId = command.sourceMessageId
  const roomId = command.sourceRoomId

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'webhook_received',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId,
    }),
  )

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_started',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId,
    }),
  )

  // --- Forward neutral DTO to translator ---
  let response: Response
  try {
    response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        sourceMessageId,
        roomId,
        errorCode: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      }),
    )
    return new Response('Translator unavailable', { status: 503 })
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        sourceMessageId,
        roomId,
        errorCode: 'TRANSLATOR_HTTP',
        errorMessage: `Translator responded with ${String(response.status)}`,
        translatorStatus: response.status,
      }),
    )
    return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
  }

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_completed',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId,
      translatorStatus: response.status,
    }),
  )

  return new Response('OK', { status: 200 })
}
