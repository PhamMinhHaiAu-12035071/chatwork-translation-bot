import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { handleTranslateRequest } from './handler'

export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  if (request.method === 'POST' && url.pathname === '/internal/translate') {
    return handleInternalTranslate(request)
  }

  return new Response('Not Found', { status: 404 })
}

async function handleInternalTranslate(request: Request): Promise<Response> {
  let event: ChatworkWebhookEvent
  try {
    const body = (await request.json()) as { event: ChatworkWebhookEvent }
    event = body.event
  } catch {
    return new Response('Bad Request: Invalid JSON', { status: 400 })
  }

  // Return 200 immediately, process async (fire-and-forget)
  void handleTranslateRequest(event).catch((error: unknown) => {
    console.error('[router] Background handler error:', error)
  })

  return new Response('OK', { status: 200 })
}
