import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

export const providersRoute = new Elysia({ name: 'translator:providers' }).get(
  '/api/providers',
  () => {
    const providers = listProviderPlugins().map((plugin) => ({
      id: plugin.manifest.id,
      name: PROVIDER_LABELS[plugin.manifest.id] ?? plugin.manifest.id,
      models: [...plugin.manifest.supportedModels],
      defaultModel: plugin.manifest.defaultModel,
    }))

    return { success: true, data: providers }
  },
)
