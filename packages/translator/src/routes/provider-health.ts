import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'

export const providerHealthRoute = new Elysia().get('/health/provider', () => {
  const plugins = listProviderPlugins()
  const hasEnvOverride = hasExplicitPipelineTimeoutOverride()
  const envTimeoutMs = hasEnvOverride
    ? Number(process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'])
    : undefined

  return {
    status: 'ok',
    providers: plugins.map((p) => p.manifest.id),
    detail: plugins.map((p) => {
      const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
        envTimeoutMs,
        hasEnvOverride,
        providerTimeoutMs: p.manifest.timeoutMs,
      })

      return {
        id: p.manifest.id,
        defaultModel: p.manifest.defaultModel,
        supportedModels: p.manifest.supportedModels,
        capabilities: p.manifest.capabilities,
        timeoutMs: p.manifest.timeoutMs ?? null,
        providerDefaultTimeoutMs: p.manifest.timeoutMs ?? null,
        effectiveTimeoutMs,
        timeoutSource,
      }
    }),
  }
})
