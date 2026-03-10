import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { geminiPlugin as geminiPluginType } from './gemini-plugin'

let mockOutput: unknown = { sourceLang: 'English', translated: 'Xin chào thế giới' }

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({ output: mockOutput }),
)

const outputObjectMock = mock((config: unknown) => config)
const googleMock = mock((_modelId: string) => ({ provider: 'google', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/google', () => ({ google: googleMock }))

describe('geminiPlugin', () => {
  let geminiPlugin: typeof geminiPluginType

  beforeAll(async () => {
    const mod = await import('./gemini-plugin')
    geminiPlugin = mod.geminiPlugin
  })

  it('manifest id is gemini', () => {
    expect(geminiPlugin.manifest.id).toBe('gemini')
  })

  it('manifest defaultModel is gemini-2.5-pro', () => {
    expect(geminiPlugin.manifest.defaultModel).toBe('gemini-2.5-pro')
  })

  it('manifest supportedModels contains gemini-2.5-pro and gemini-2.0-flash', () => {
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.5-pro')
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.0-flash')
  })

  it('create returns an executor that calls generateText with prompts', async () => {
    mockOutput = { sourceLang: 'English', translated: 'Xin chào thế giới' }
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const schema = { parse: (d: unknown) => d as { sourceLang: string; translated: string } }
    const result = await executor.execute({ system: 'translate', user: 'Hello World' }, schema)
    expect(result.sourceLang).toBe('English')
    expect(result.translated).toBe('Xin chào thế giới')
  })

  it('passes the modelId through to google()', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    const schema = { parse: (d: unknown) => d }
    await executor.execute({ system: 'sys', user: 'test' }, schema)
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    try {
      await executor.execute({ system: 'sys', user: 'test' }, { parse: (d: unknown) => d })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
