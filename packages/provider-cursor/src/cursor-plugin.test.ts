import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { CURSOR_MODEL_VALUES, DEFAULT_CURSOR_MODEL } from './cursor-plugin'
import type { cursorPlugin as cursorPluginType } from './cursor-plugin'

let mockResponseText = '{"sourceLang": "Japanese", "translated": "Xin chào thế giới"}'

const generateTextMock = mock((_config: unknown) => Promise.resolve({ text: mockResponseText }))

const createOpenAICompatibleMock = mock((_opts: unknown) =>
  mock((_modelId: string) => ({ provider: 'cursor', modelId: _modelId })),
)

void mock.module('ai', () => ({
  generateText: generateTextMock,
}))

void mock.module('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

describe('cursor model values', () => {
  it('includes Cursor Native models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('auto')
    expect(CURSOR_MODEL_VALUES).toContain('composer-1')
    expect(CURSOR_MODEL_VALUES).toContain('composer-1.5')
  })

  it('includes Slow Request models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.5')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3-flash')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3-pro')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3.1-pro')
    expect(CURSOR_MODEL_VALUES).toContain('kimi-k2.5')
    expect(CURSOR_MODEL_VALUES).toContain('grok')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.1-codex-mini')
  })

  it('includes Fast Request models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.6')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.5')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.6')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.2')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.3-codex')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.4-high')
  })

  it('includes Max Mode models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.6-thinking')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.6-thinking')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.3-codex-xhigh')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.1-codex-max')
  })

  it('does NOT include invalid models removed from proxy', () => {
    expect(CURSOR_MODEL_VALUES).not.toContain('gpt-5-mini')
    expect(CURSOR_MODEL_VALUES).not.toContain('cursor-small')
    expect(CURSOR_MODEL_VALUES).not.toContain('claude-sonnet-4-5')
    expect(CURSOR_MODEL_VALUES).not.toContain('gemini-2.5-flash')
  })

  it('default model is in supported list', () => {
    expect(CURSOR_MODEL_VALUES).toContain(DEFAULT_CURSOR_MODEL)
    expect(DEFAULT_CURSOR_MODEL).toBe('sonnet-4.6')
  })

  it('contains exactly 45 models', () => {
    expect(CURSOR_MODEL_VALUES).toHaveLength(45)
  })
})

describe('cursorPlugin', () => {
  let cursorPlugin: typeof cursorPluginType

  beforeAll(async () => {
    const mod = await import('./cursor-plugin')
    cursorPlugin = mod.cursorPlugin
  })

  it('manifest id is cursor', () => {
    expect(cursorPlugin.manifest.id).toBe('cursor')
  })

  it('create requires baseUrl', () => {
    expect(() => cursorPlugin.create({ modelId: 'claude-sonnet-4-5' })).toThrow(
      'cursor provider requires baseUrl',
    )
  })

  it('translates pure JSON response', async () => {
    mockResponseText = '{"sourceLang": "English", "translated": "Xin chào"}'
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://127.0.0.1:8765/v1',
    })
    const result = await service.translate('Hello')
    expect(result.cleanText).toBe('Hello')
    expect(result.translatedText).toBe('Xin chào')
    expect(result.sourceLang).toBe('English')
    expect(result.targetLang).toBe('Vietnamese')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('translates JSON wrapped in markdown code block', async () => {
    mockResponseText =
      'Here is the translation:\n```json\n{"sourceLang": "Japanese", "translated": "Xin chào"}\n```'
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://127.0.0.1:8765/v1',
    })
    const result = await service.translate('こんにちは')
    expect(result.translatedText).toBe('Xin chào')
    expect(result.sourceLang).toBe('Japanese')
  })

  it('throws INVALID_RESPONSE on invalid JSON schema', async () => {
    mockResponseText = '{"wrong_field": "value"}'
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://127.0.0.1:8765/v1',
    })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
      expect((error as InstanceType<typeof TranslationError>).code).toBe('INVALID_RESPONSE')
    }
  })

  it('throws API_ERROR on network failure', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('connection refused')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://127.0.0.1:8765/v1',
    })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
      expect((error as InstanceType<typeof TranslationError>).code).toBe('API_ERROR')
    }
  })

  it('throws API_ERROR when response contains no JSON', async () => {
    mockResponseText = 'Sorry, I cannot translate that text.'
    const { TranslationError } = await import('@chatwork-bot/core')
    const service = cursorPlugin.create({
      modelId: 'claude-sonnet-4-5',
      baseUrl: 'http://127.0.0.1:8765/v1',
    })
    try {
      await service.translate('test')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })
})
