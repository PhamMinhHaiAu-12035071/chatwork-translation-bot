import { verifyWebhookSignature } from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'

export async function handleWebhookRoute(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const rawBody = await request.text()
  const headerSignature = request.headers.get('x-chatworkwebhooksignature')
  const querySignature = url.searchParams.get('chatwork_webhook_signature')
  const signature = headerSignature ?? querySignature

  if (!signature) {
    console.log('[webhook] Rejected: missing signature in header/query')
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifyWebhookSignature(rawBody, signature, env.CHATWORK_WEBHOOK_SECRET)
  if (!isValid) {
    const signatureSource = headerSignature ? 'header' : 'query'
    const userAgent = request.headers.get('user-agent') ?? 'unknown'
    console.log(
      `[webhook] Rejected: invalid signature (source=${signatureSource}, body_chars=${rawBody.length.toString()}, signature_chars=${signature.length.toString()}, user_agent=${userAgent})`,
    )
    return new Response('Unauthorized', { status: 401 })
  }

  let event: ChatworkWebhookEvent
  try {
    event = JSON.parse(rawBody) as ChatworkWebhookEvent
  } catch {
    console.log('[webhook] Rejected: invalid JSON')
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  console.log('\n------- WEBHOOK EVENT -------')
  console.log('Timestamp:', new Date().toISOString())
  console.log('Headers:', Object.fromEntries(request.headers))
  console.dir(event, { depth: null, colors: true })
  console.log('-----------------------------\n')

  // Forward to translator service (fire-and-forget)
  void fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch((err: unknown) => {
    console.error('[webhook] Failed to forward to translator:', err)
  })

  return new Response('OK', { status: 200 })
}
