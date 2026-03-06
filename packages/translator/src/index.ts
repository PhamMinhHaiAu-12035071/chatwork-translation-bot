import { env } from './env'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards(env)

const server = createServer()

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
console.log(`[translator] Provider: ${env.AI_PROVIDER}`)
console.log(`[translator] Environment: ${env.NODE_ENV}`)
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(
  `[translator] Internal endpoint: http://localhost:${env.PORT.toString()}/internal/translate`,
)
if (env.NODE_ENV === 'development') {
  console.log(`[translator] Swagger UI: http://localhost:${env.PORT.toString()}/docs`)
}

function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')
  void server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
