import { env } from './env'
import { router } from './webhook/router'

export function createServer() {
  const server = Bun.serve({
    port: env.PORT,
    hostname: '0.0.0.0',
    fetch: router,
    error(error) {
      console.error('[server] Unhandled error:', error)
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  return server
}
