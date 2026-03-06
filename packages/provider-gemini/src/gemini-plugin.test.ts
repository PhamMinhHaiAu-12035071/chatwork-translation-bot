import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { geminiPlugin as geminiPluginType } from './gemini-plugin'

let mockSourceLang = 'English'
let mockTranslated = 'Xin chào thế giới'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
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

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'English'
    mockTranslated = 'Xin chào thế giới'
    const service = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const result = await service.translate('Hello World')
    expect(result.cleanText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes the modelId through to google()', async () => {
    const service = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    await service.translate('test')
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
