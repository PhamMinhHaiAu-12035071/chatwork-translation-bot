import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'

export const providerHealthRoute = new Elysia().get('/health/provider', () => {
  const plugins = listProviderPlugins()
  return {
    status: 'ok',
    providers: plugins.map((p) => p.manifest.id),
    detail: plugins.map((p) => ({
      id: p.manifest.id,
      defaultModel: p.manifest.defaultModel,
      supportedModels: p.manifest.supportedModels,
    })),
  }
})
