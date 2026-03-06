import type { ITranslationService } from '@chatwork-bot/core'
import { CURSOR_MODEL_VALUES, DEFAULT_CURSOR_MODEL } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { CursorTranslationService } from './cursor-translation'

export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
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
