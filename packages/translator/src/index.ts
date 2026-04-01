import { KagiClient } from '@chatwork-bot/provider-kagi'
import { env } from './env'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import { FreeTranslationBackend } from '~/services/free-translation-backend'
import { FreeRoomConfigStore } from '~/services/free-room-config-store'
import {
  DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { RoomConfigStore } from '~/services/room-config-store'
import { initFreeTranslateHandler } from '~/webhook/free-handler'
import { initTranslateHandler } from '~/webhook/handler'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards()

const store = new RoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
  encryptionKeyHex: env.ROOM_CONFIG_ENCRYPTION_KEY,
})
await store.init()
const freeStore = new FreeRoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
})
await freeStore.init()

initTranslateHandler({
  store,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
})
initFreeTranslateHandler({
  store: freeStore,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
  backend: new FreeTranslationBackend({
    client: new KagiClient(env.KAGI_TRANSLATOR_URL),
    defaultMaxEncodedPayloadChars: env.KAGI_MAX_ENCODED_PAYLOAD_CHARS,
    defaultMaxSegmentCount: env.KAGI_MAX_SEGMENT_COUNT,
  }),
})

const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
  envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
  providerTimeoutMs: DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
})

const server = createServer({ store, freeStore })

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
console.log(`[translator] Free Room API: http://localhost:${env.PORT.toString()}/api/free-rooms`)
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
