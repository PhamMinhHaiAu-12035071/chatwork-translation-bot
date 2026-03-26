import { env } from './env'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import {
  DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { RoomConfigStore } from '~/services/room-config-store'
import { initTranslateHandler } from '~/webhook/handler'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards()

const store = new RoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
  encryptionKeyHex: env.ROOM_CONFIG_ENCRYPTION_KEY,
})
await store.init()

initTranslateHandler({
  store,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
})

const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
  envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
  providerTimeoutMs: DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
})

const server = createServer({ store })

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
logStartupBanner({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  effectiveTimeoutMs,
  timeoutSource,
  roomCount: store.list().length,
})
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(`[translator] Status endpoint: http://localhost:${env.PORT.toString()}/status`)
console.log(`[translator] Room config API: http://localhost:${env.PORT.toString()}/api/rooms`)
console.log(`[translator] Providers API: http://localhost:${env.PORT.toString()}/api/providers`)
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
