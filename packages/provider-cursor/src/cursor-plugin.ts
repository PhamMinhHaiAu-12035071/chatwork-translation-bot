import type { ITranslationService } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'

export const CURSOR_MODEL_VALUES = [
  // Anthropic
  'claude-sonnet-4',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-6',
  'claude-sonnet-4-6-thinking',
  'claude-opus-4-5',
  'claude-opus-4-5-thinking',
  'claude-opus-4-6',
  'claude-opus-4-6-thinking',
  // Google (Gemini 3 GA Nov 2025)
  'gemini-2.5-flash',
  'gemini-3-flash',
  'gemini-3-pro',
  // OpenAI (GPT-5 API available 2026)
  'gpt-5.2',
  'gpt-5.3-codex',
  // Cursor native
  'composer-1',
  'composer-1.5',
  'cursor-small',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]
export const DEFAULT_CURSOR_MODEL: CursorModel = 'claude-sonnet-4-5'
import { CursorTranslationService } from './cursor-translation'

export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
    timeoutMs: 120_000,
    requiredEnvKeys: ['CURSOR_API_URL'],
  },
  create(ctx: ProviderCreateContext): ITranslationService {
    if (!ctx.baseUrl) {
      throw new Error(
        'cursor provider requires baseUrl in ProviderCreateContext (set CURSOR_API_URL)',
      )
    }
    return new CursorTranslationService(ctx.modelId, ctx.baseUrl)
  },
}
