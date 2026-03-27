import { Elysia } from 'elysia'
import {
  normalizeWebhookPayload,
  mapWebhookToTranslationCommand,
  ChatworkWebhookPayloadError,
} from '@chatwork-bot/chatwork'
import { env } from '~/env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
  .post('/webhook', ({ request }) => handleWebhook(request))
  .post('/', ({ request }) => handleWebhook(request))

type WebhookLogLevel = 'info' | 'warn' | 'error'

function logWebhookEvent(
  level: WebhookLogLevel,
  event: string,
  context: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    level,
    service: 'webhook-logger',
    event,
    timestamp: new Date().toISOString(),
    ...context,
  })

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

async function handleWebhook(request: Request): Promise<Response> {
  const traceId = crypto.randomUUID()
  const rawBody = await request.text()

  // --- Payload normalization ---
  let payload: ReturnType<typeof normalizeWebhookPayload>
  try {
    payload = normalizeWebhookPayload(rawBody)
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookPayloadError) {
      logWebhookEvent('error', 'webhook_payload_invalid', {
        traceId,
        errorCode: 'WEBHOOK_PAYLOAD_INVALID',
        errorMessage: err.message,
      })
      return new Response('Invalid webhook payload', { status: 422 })
    }
    throw err
  }

  // --- Map to neutral DTO ---
  const command = mapWebhookToTranslationCommand(payload, new Date().toISOString())

  const sourceMessageId = command.sourceMessageId
  const sourceRoomId = command.sourceRoomId

  logWebhookEvent('info', 'webhook_received', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
  })

  logWebhookEvent('info', 'translation_forward_started', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
  })

  // --- Forward neutral DTO to translator ---
  let response: Response
  try {
    response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': traceId,
      },
      body: JSON.stringify({ command }),
    })
  } catch (err: unknown) {
    logWebhookEvent('error', 'translation_forward_failed', {
      traceId,
      sourceMessageId,
      roomId: sourceRoomId,
      errorCode: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return new Response('Translator unavailable', { status: 503 })
  }

  if (!response.ok) {
    logWebhookEvent('error', 'translation_forward_failed', {
      traceId,
      sourceMessageId,
      roomId: sourceRoomId,
      errorCode: 'TRANSLATOR_HTTP',
      errorMessage: `Translator responded with ${String(response.status)}`,
      translatorStatus: response.status,
    })
    return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
  }

  logWebhookEvent('info', 'translation_forward_completed', {
    traceId,
    sourceMessageId,
    roomId: sourceRoomId,
    translatorStatus: response.status,
  })

  return new Response('OK', { status: 200 })
}
