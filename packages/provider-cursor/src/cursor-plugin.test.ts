import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { cursorPlugin as cursorPluginType } from './cursor-plugin'

let mockSourceLang = 'English'
let mockTranslated = 'Xin chào từ Cursor'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const createOpenAICompatibleMock = mock((_config: unknown) => {
  return (_modelId: string) => ({ provider: 'cursor', modelId: _modelId })
})

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

describe('cursorPlugin', () => {
  let cursorPlugin: typeof cursorPluginType

  beforeAll(async () => {
    const mod = await import('./cursor-plugin')
    cursorPlugin = mod.cursorPlugin
  })

  it('manifest id is cursor', () => {
    expect(cursorPlugin.manifest.id).toBe('cursor')
  })

  it('manifest defaultModel is claude-sonnet-4-5', () => {
    expect(cursorPlugin.manifest.defaultModel).toBe('claude-sonnet-4-5')
  })

  it('manifest supportedModels contains all cursor models', () => {
    expect(cursorPlugin.manifest.supportedModels).toContain('claude-sonnet-4-5')
    expect(cursorPlugin.manifest.supportedModels).toContain('gpt-4o')
    expect(cursorPlugin.manifest.supportedModels).toContain('cursor-small')
  })

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'English'
    mockTranslated = 'Xin chào từ Cursor'
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://localhost:3040',
    })
    const result = await service.translate('Hello from Cursor')
    expect(result.cleanText).toBe('Hello from Cursor')
    expect(result.translatedText).toBe('Xin chào từ Cursor')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
  })

  it('throws if baseUrl is missing', () => {
    expect(() => cursorPlugin.create({ modelId: 'claude-sonnet-4-5' })).toThrow(/baseUrl/)
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('proxy down')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://localhost:3040',
    })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
