import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { openaiPlugin as openaiPluginType } from './openai-plugin'

let mockSourceLang = 'Japanese'
let mockTranslated = 'おはようございます、世界！'

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({
    output: { sourceLang: mockSourceLang, translated: mockTranslated },
  }),
)

const outputObjectMock = mock((config: unknown) => config)
const openaiMock = mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai', () => ({ openai: openaiMock }))

describe('openaiPlugin', () => {
  let openaiPlugin: typeof openaiPluginType

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  it('manifest id is openai', () => {
    expect(openaiPlugin.manifest.id).toBe('openai')
  })

  it('manifest defaultModel is gpt-4o', () => {
    expect(openaiPlugin.manifest.defaultModel).toBe('gpt-4o')
  })

  it('manifest supportedModels contains gpt-4o and gpt-4o-mini', () => {
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o')
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o-mini')
  })

  it('create returns a service that translates text', async () => {
    mockSourceLang = 'Japanese'
    mockTranslated = 'おはようございます、世界！'
    const service = openaiPlugin.create({ modelId: 'gpt-4o' })
    const result = await service.translate('おはようございます、世界！')
    expect(result.cleanText).toBe('おはようございます、世界！')
    expect(result.translatedText).toBe('おはようございます、世界！')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes the modelId through to openai()', async () => {
    const service = openaiPlugin.create({ modelId: 'gpt-4o-mini' })
    await service.translate('test')
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o-mini')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('quota exceeded')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = openaiPlugin.create({ modelId: 'gpt-4o' })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
