import { env } from './env'
import { getProviderPlugin } from '@chatwork-bot/core'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards(env)

const activePlugin = getProviderPlugin(env.AI_PROVIDER)
const activeModel = env.AI_MODEL ?? activePlugin.manifest.defaultModel
const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
  envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
  providerTimeoutMs: activePlugin.manifest.timeoutMs,
})

const server = createServer()

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
logStartupBanner({
  provider: env.AI_PROVIDER,
  model: activeModel,
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  effectiveTimeoutMs,
  timeoutSource,
})
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(`[translator] Status endpoint: http://localhost:${env.PORT.toString()}/status`)
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
