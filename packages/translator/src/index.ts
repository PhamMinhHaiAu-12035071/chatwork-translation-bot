import { env } from './env'
import { createServer } from './server'

const server = createServer()

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
console.log(`[translator] Provider: ${env.AI_PROVIDER}`)
console.log(`[translator] Environment: ${env.NODE_ENV}`)
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(
  `[translator] Internal endpoint: http://localhost:${env.PORT.toString()}/internal/translate`,
)

function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
