import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { GeminiTranslationService as GeminiTranslationServiceType } from './gemini-translation'

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
  Output: {
    object: outputObjectMock,
  },
}))

void mock.module('@ai-sdk/google', () => ({
  google: googleMock,
}))

describe('GeminiTranslationService', () => {
  let GeminiTranslationService: typeof GeminiTranslationServiceType

  beforeAll(async () => {
    const mod = await import('./gemini-translation')
    GeminiTranslationService = mod.GeminiTranslationService
  })

  it('translates text and returns TranslationResult', async () => {
    mockSourceLang = 'English'
    mockTranslated = 'Xin chào thế giới'

    const service = new GeminiTranslationService()
    const result = await service.translate('Hello World')

    expect(result.cleanText).toBe('Hello World')
    expect(result.translatedText).toBe('Xin chào thế giới')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes through translated text without newline post-processing', async () => {
    const service = new GeminiTranslationService()
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
      mockSourceLang = 'English'
      mockTranslated = testCase.translated

      const result = await service.translate(testCase.input)
      expect(result.translatedText).toBe(testCase.translated)

      const callArg = generateTextMock.mock.calls.at(-1)?.[0] as { prompt?: string } | undefined
      expect(callArg?.prompt).toContain(testCase.input)
    }
  })

  it('uses default model gemini-2.5-pro when no modelId given', async () => {
    const service = new GeminiTranslationService()
    await service.translate('test')
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.5-pro')
  })

  it('uses custom modelId when provided', async () => {
    const service = new GeminiTranslationService('gemini-2.0-flash')
    await service.translate('test')
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })
})
