import { env } from './env'
import { createServer } from './server'

const server = createServer()

console.log(`[webhook-logger] Listening on http://0.0.0.0:${env.LOGGER_PORT.toString()}`)
console.log(`[webhook-logger] Health check: http://localhost:${env.LOGGER_PORT.toString()}/health`)
console.log(
  `[webhook-logger] Webhook endpoint: http://localhost:${env.LOGGER_PORT.toString()}/webhook`,
)
console.log('[webhook-logger] Waiting for Chatwork webhook events...\n')

function shutdown() {
  console.log('\n[webhook-logger] Shutting down...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
