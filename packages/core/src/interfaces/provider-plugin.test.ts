import { describe, expect, it } from 'bun:test'
import type { ProviderPlugin, ProviderManifest, ProviderCreateContext } from './provider-plugin'
import type { ITranslationService, TranslationResult } from './translation'

describe('ProviderPlugin contract', () => {
  it('accepts a conforming plugin object', () => {
    const manifest: ProviderManifest = {
      id: 'test-provider',
      supportedModels: ['model-a', 'model-b'] as const,
      defaultModel: 'model-a',
      capabilities: { streaming: false },
    }

    const plugin: ProviderPlugin = {
      manifest,
      create(_ctx: ProviderCreateContext): ITranslationService {
        return {
          translate(_text: string): Promise<TranslationResult> {
            return Promise.resolve({
              cleanText: _text,
              translatedText: 'bản dịch',
              sourceLang: 'English',
              targetLang: 'Vietnamese',
              timestamp: new Date().toISOString(),
            })
          },
        }
      },
    }

    expect(plugin.manifest.id).toBe('test-provider')
    expect(plugin.manifest.supportedModels).toHaveLength(2)
    expect(plugin.manifest.defaultModel).toBe('model-a')
    expect(typeof plugin.create).toBe('function')
    expect(plugin.manifest.capabilities.streaming).toBe(false)
  })
})
