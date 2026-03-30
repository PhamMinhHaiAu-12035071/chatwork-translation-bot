import { describe, expect, it } from 'bun:test'
import type { ProviderPlugin, ProviderManifest, ProviderCreateContext } from './provider-plugin'
import type { ILLMExecutor, ISchema, PromptPair } from './llm-executor'

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
      create(_ctx: ProviderCreateContext): ILLMExecutor {
        return {
          execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
            return Promise.resolve(schema.parse({}))
          },
          describeExecution() {
            return {
              generation: {
                temperature: 0,
                maxOutputTokens: 4000,
                providerOptions: null,
                providerManaged: false,
              },
            }
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

  it('allows an optional per-request apiKey in the provider create context', () => {
    const ctx: ProviderCreateContext = {
      modelId: 'model-a',
      apiKey: 'room-scoped-key',
      translationStyle: 'NATURAL_CASUAL',
    }

    expect(ctx.apiKey).toBe('room-scoped-key')
    expect(ctx.translationStyle).toBe('NATURAL_CASUAL')
  })
})
