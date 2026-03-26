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

class RoomSecretFetchError extends Error {}

async function fetchRoomSecret(roomId: number): Promise<string | null> {
  const url = `${env.TRANSLATOR_INTERNAL_URL}/internal/room-secret?room_id=${roomId.toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'x-internal-secret': env.INTERNAL_API_SECRET },
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'room_secret_fetch_failed',
        timestamp: new Date().toISOString(),
        roomId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
    throw new RoomSecretFetchError('Failed to fetch room secret')
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'room_secret_fetch_error',
        timestamp: new Date().toISOString(),
        roomId,
        status: response.status,
      }),
    )
    throw new RoomSecretFetchError(
      `Room secret fetch failed with status ${response.status.toString()}`,
    )
  }

  const body = (await response.json()) as { webhookSecret: string }
  return body.webhookSecret
}

function extractRoomId(rawBody: string): number | null {
  try {
    const parsed = JSON.parse(rawBody) as {
      webhook_setting?: { room_id?: unknown }
      webhook_event?: { room_id?: unknown }
    }

    const webhookEventRoomId = parsed.webhook_event?.room_id
    if (typeof webhookEventRoomId === 'number') {
      return webhookEventRoomId
    }

    const webhookSettingRoomId = parsed.webhook_setting?.room_id
    if (typeof webhookSettingRoomId === 'number') {
      return webhookSettingRoomId
    }
  } catch {
    // Ignore parse failures here; payload validation happens later.
  }

  return null
}

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

  const roomId = extractRoomId(rawBody)
  if (roomId === null) {
    return new Response('Cannot extract room_id from payload', { status: 422 })
  }

  let webhookSecret: string | null
  try {
    webhookSecret = await fetchRoomSecret(roomId)
  } catch (error) {
    if (error instanceof RoomSecretFetchError) {
      return new Response('Translator internal API unavailable', { status: 503 })
    }

    throw error
  }

  if (webhookSecret === null) {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'webhook-logger',
        event: 'webhook_skipped_no_room_config',
        timestamp: new Date().toISOString(),
        roomId,
      }),
    )
    return new Response('OK', { status: 200 })
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
    verifyWebhookSignature(rawBody, signature, webhookSecret, {
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
  const sourceRoomId = command.sourceRoomId

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'webhook_received',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId: sourceRoomId,
    }),
  )

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_started',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId: sourceRoomId,
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
        roomId: sourceRoomId,
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
        roomId: sourceRoomId,
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
      roomId: sourceRoomId,
      translatorStatus: response.status,
    }),
  )

  return new Response('OK', { status: 200 })
}
