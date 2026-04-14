import { KagiClient } from '@chatwork-bot/provider-kagi'
import { TranslationQueue } from '@chatwork-bot/message-queue'
import { join } from 'node:path'
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
import { asyncLogger } from '~/services/async-logger'
import { registerQueueSnapshotProvider } from '~/services/translator-observability-runtime'
import { initFreeTranslateHandler, handleFreeTranslateRequest } from '~/webhook/free-handler'
import { initTranslateHandler, handleTranslateRequest } from '~/webhook/handler'
import { initTranslationQueue } from '~/webhook/router'
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

// Initialize FIFO message queue
const queue = new TranslationQueue({
  dataDir: join(env.ROOM_CONFIG_DATA_DIR, 'queue'),
  maxDepth: env.QUEUE_MAX_DEPTH_PER_ROOM,
  processor: async (command, opts) => {
    await Promise.allSettled([
      handleTranslateRequest(command, opts),
      handleFreeTranslateRequest(command, opts),
    ])
  },
  resolveConcurrency: (roomId) => {
    if (freeStore.getByOriginalRoomId(roomId) !== null) return env.QUEUE_FREE_CONCURRENCY
    if (store.getByOriginalRoomId(roomId) !== null) return env.QUEUE_STANDARD_CONCURRENCY
    return env.QUEUE_STANDARD_CONCURRENCY
  },
})
await queue.startup()

// Inject queue into router and status endpoint
initTranslationQueue(queue)
registerQueueSnapshotProvider(() => queue.getSnapshot())

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

async function shutdown() {
  console.log('\n[translator] Shutting down gracefully...')

  // Drain queue first (30s timeout)
  await queue.shutdown()

  // Flush logs
  await asyncLogger.shutdown()

  // Close HTTP connection pool
  const { httpAgent } = await import('@chatwork-bot/chatwork')
  await httpAgent?.close()

  // Stop accepting new requests
  void server.stop()

  console.log('[translator] Server stopped cleanly')
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
