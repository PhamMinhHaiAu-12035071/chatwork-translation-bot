import { registerProviderPlugin } from '@chatwork-bot/core'
import { geminiPlugin } from '@chatwork-bot/provider-gemini'
import { openaiPlugin } from '@chatwork-bot/provider-openai'

export function registerAllProviders(): void {
  registerProviderPlugin(geminiPlugin)
  registerProviderPlugin(openaiPlugin)
}
