import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { OpenAITranslationService as OpenAITranslationServiceType } from './openai-translation'

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
  Output: {
    object: outputObjectMock,
  },
}))

void mock.module('@ai-sdk/openai', () => ({
  openai: openaiMock,
}))

describe('OpenAITranslationService', () => {
  let OpenAITranslationService: typeof OpenAITranslationServiceType

  beforeAll(async () => {
    const mod = await import('./openai-translation')
    OpenAITranslationService = mod.OpenAITranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    mockSourceLang = 'Japanese'
    mockTranslated = 'おはようございます、世界！'

    const service = new OpenAITranslationService()
    const result = await service.translate('おはようございます、世界！')

    expect(result.cleanText).toBe('おはようございます、世界！')
    expect(result.translatedText).toBe('おはようございます、世界！')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes through translated text without newline post-processing', async () => {
    const service = new OpenAITranslationService()
    const cases = [
      {
        name: 'no newline',
        input: 'Hello world',
        translated: 'Xin chào thế giới',
      },
      {
        name: 'single newline',
        input: 'Line one\nLine two',
        translated: 'Dòng một\nDòng hai',
      },
      {
        name: 'double newline',
        input: 'Paragraph one\n\nParagraph two',
        translated: 'Đoạn một\n\nĐoạn hai',
      },
      {
        name: 'mixed newlines',
        input: 'A\nB\n\nC\nD',
        translated: 'Một\nHai\n\nBa\nBốn',
      },
      {
        name: 'leading and trailing newline',
        input: '\nStart\n\nEnd\n',
        translated: '\nMở đầu\n\nKết thúc\n',
      },
      {
        name: 'literal [[NL]] text stays literal',
        input: 'Token [[NL]] should stay as text',
        translated: 'Token [[NL]] nên được giữ nguyên dạng text',
      },
    ] as const

    for (const testCase of cases) {
      mockSourceLang = 'Japanese'
      mockTranslated = testCase.translated

      const result = await service.translate(testCase.input)
      expect(result.translatedText).toBe(testCase.translated)

      const callArg = generateTextMock.mock.calls.at(-1)?.[0] as { prompt?: string } | undefined
      expect(callArg?.prompt).toContain(testCase.input)
    }
  })

  it('uses default model gpt-4o when no modelId given', async () => {
    const service = new OpenAITranslationService()
    await service.translate('test')
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o')
  })

  it('uses custom modelId when provided', async () => {
    const service = new OpenAITranslationService('gpt-4o-mini')
    await service.translate('test')
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o-mini')
  })
})
