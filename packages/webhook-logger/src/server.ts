import { env } from './env'
import { handleWebhookRoute } from './routes/webhook'

function router(request: Request): Response | Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  if (request.method === 'POST' && url.pathname === '/webhook') {
    return handleWebhookRoute(request)
  }

  return new Response('Not Found', { status: 404 })
}

export function createServer() {
  return Bun.serve({
    port: env.LOGGER_PORT,
    hostname: '0.0.0.0',
    fetch: router,
    error(error) {
      console.error('[server] Unhandled error:', error)
      return new Response('Internal Server Error', { status: 500 })
    },
  })
}
