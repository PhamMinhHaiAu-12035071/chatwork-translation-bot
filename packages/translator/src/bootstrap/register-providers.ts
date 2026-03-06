import { registerProviderPlugin } from '@chatwork-bot/core'
import { geminiPlugin } from '@chatwork-bot/provider-gemini'
import { openaiPlugin } from '@chatwork-bot/provider-openai'
import { cursorPlugin } from '@chatwork-bot/provider-cursor'

export function registerAllProviders(): void {
  registerProviderPlugin(geminiPlugin)
  registerProviderPlugin(openaiPlugin)
  registerProviderPlugin(cursorPlugin)
}
