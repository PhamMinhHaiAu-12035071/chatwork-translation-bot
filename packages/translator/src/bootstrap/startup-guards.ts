import { listProviderPlugins } from '@chatwork-bot/core'

export function runStartupGuards(): void {
  const plugins = listProviderPlugins()

  if (plugins.length === 0) {
    throw new Error('[startup] No providers registered. Did registerAllProviders() run?')
  }
}
