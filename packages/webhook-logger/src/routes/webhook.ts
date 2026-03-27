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

const ROOM_SECRET_TTL_MS = 60_000

interface CachedRoomSecret {
  expiresAt: number
  secret: string
}

const roomSecretCache = new Map<number, CachedRoomSecret>()

type WebhookLogLevel = 'info' | 'warn' | 'error'

export function resetRoomSecretCacheForTest(): void {
  roomSecretCache.clear()
}

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

function getCachedRoomSecret(roomId: number): string | null {
  const cached = roomSecretCache.get(roomId)

  if (cached === undefined) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    roomSecretCache.delete(roomId)
    return null
  }

  return cached.secret
}

async function fetchRoomSecret(roomId: number, traceId: string): Promise<string | null> {
  const cachedSecret = getCachedRoomSecret(roomId)
  if (cachedSecret !== null) {
    return cachedSecret
  }

  const url = `${env.TRANSLATOR_INTERNAL_URL}/internal/room-secret?room_id=${roomId.toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'x-internal-secret': env.INTERNAL_API_SECRET },
    })
  } catch (error) {
    logWebhookEvent('error', 'room_secret_fetch_failed', {
      traceId,
      roomId,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw new RoomSecretFetchError('Failed to fetch room secret')
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    logWebhookEvent('error', 'room_secret_fetch_error', {
      traceId,
      roomId,
      status: response.status,
    })
    throw new RoomSecretFetchError(
      `Room secret fetch failed with status ${response.status.toString()}`,
    )
  }

  const body = (await response.json()) as { secret: string }
  roomSecretCache.set(roomId, {
    secret: body.secret,
    expiresAt: Date.now() + ROOM_SECRET_TTL_MS,
  })

  return body.secret
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
  const traceId = crypto.randomUUID()

  // --- Signature verification ---
  const signature = headers['x-chatworkwebhooksignature']
  if (!signature) {
    logWebhookEvent('error', 'webhook_signature_missing', {
      traceId,
      errorCode: 'WEBHOOK_SIGNATURE_MISSING',
      errorMessage: 'Missing X-ChatWorkWebhookSignature header',
    })
    return new Response('Missing signature header', { status: 422 })
  }

  const roomId = extractRoomId(rawBody)
  if (roomId === null) {
    return new Response('Cannot extract room_id from payload', { status: 422 })
  }

  logWebhookEvent('info', 'room_secret_lookup_started', {
    traceId,
    roomId,
  })

  let webhookSecret: string | null
  try {
    webhookSecret = await fetchRoomSecret(roomId, traceId)
  } catch (error) {
    if (error instanceof RoomSecretFetchError) {
      return new Response('Translator internal API unavailable', { status: 503 })
    }

    throw error
  }

  if (webhookSecret === null) {
    logWebhookEvent('info', 'room_secret_lookup_not_found_or_disabled', {
      traceId,
      roomId,
      skipReason: 'room_missing_or_disabled',
      nextExpectedAction: 'check_room_status',
    })
    logWebhookEvent('info', 'webhook_skipped_no_room_config', {
      traceId,
      roomId,
      skipReason: 'room_missing_or_disabled',
      nextExpectedAction: 'check_room_status',
    })
    return new Response('OK', { status: 200 })
  }

  logWebhookEvent('info', 'room_secret_lookup_resolved', {
    traceId,
    roomId,
  })

  const skipVerify = env.CHATWORK_SKIP_SIGNATURE_VERIFY && env.NODE_ENV !== 'production'
  if (skipVerify) {
    logWebhookEvent('warn', 'webhook_signature_verification_bypassed', {
      traceId,
      message: 'Signature verification bypassed (CHATWORK_SKIP_SIGNATURE_VERIFY=true)',
    })
  }

  try {
    verifyWebhookSignature(rawBody, signature, webhookSecret, {
      skip: skipVerify,
      env: env.NODE_ENV,
    })
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookSignatureError) {
      logWebhookEvent('error', 'webhook_signature_invalid', {
        traceId,
        errorCode: 'WEBHOOK_SIGNATURE_INVALID',
        errorMessage: err.message,
      })
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
