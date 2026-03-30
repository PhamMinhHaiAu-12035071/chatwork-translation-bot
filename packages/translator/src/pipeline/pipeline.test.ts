import { describe, expect, it } from 'bun:test'
import type { ILLMExecutor, ISchema, PromptPair } from '@chatwork-bot/core'
import { TranslationPipeline } from './pipeline'

function makeExecutor(
  result: unknown = { sourceLang: 'Japanese', translated: 'こんにちは→xin chào' },
) {
  let callCount = 0
  const executor: ILLMExecutor = {
    execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
      callCount++
      return Promise.resolve(result as T)
    },
    describeExecution() {
      return {
        generation: {
          temperature: 0.35,
          maxOutputTokens: 4000,
          providerOptions: null,
          providerManaged: false,
        },
      }
    },
  }
  return { executor, getCallCount: () => callCount }
}

describe('TranslationPipeline', () => {
  it('calls executor once for any text in the one-step pipeline', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('お世話になっております。')
    expect(getCallCount()).toBe(1)
  })

  it('calls executor once for short text in the one-step pipeline', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('OK')
    expect(getCallCount()).toBe(1)
  })

  it('returns TranslationResult with translatedText from executor', async () => {
    const { executor } = makeExecutor({ sourceLang: 'Japanese', translated: 'Xin chào' })
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.run('こんにちは')
    expect(result.translatedText).toBe('Xin chào')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
  })

  it('passes the source text in TRANSLATE_TEXT tags to the executor prompt', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({ sourceLang: 'Japanese', translated: 'テスト' } as unknown as T)
      },
      describeExecution() {
        return {
          generation: {
            temperature: 0.35,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }
      },
    }
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('リリース予定について')

    expect(captured.prompts).toBeDefined()
    expect(captured.prompts?.user).toContain('<TRANSLATE_TEXT>')
    expect(captured.prompts?.user).toContain('リリース予定について')
    expect(captured.prompts?.user).not.toContain('Draft translation:')
  })

  it('passes the selected style into the one-step prompt path', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({ sourceLang: 'Japanese', translated: 'Xin chào' } as T)
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

    const pipeline = new TranslationPipeline(executor, {
      translationStyle: 'TECHNICAL',
    })

    await pipeline.run('テスト')
    expect(captured.prompts?.system).toContain('TECHNICAL')
  })

  it('throws TranslationError on abort', async () => {
    const controller = new AbortController()
    controller.abort()
    const { executor } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)

    try {
      await pipeline.run('テスト', { signal: controller.signal })
      expect.unreachable('expected pipeline to abort')
    } catch (error) {
      expect(error).toMatchObject({ code: 'ABORTED' })
    }
  })

  it('propagates the executor error directly because there is no polish fallback', async () => {
    const executor: ILLMExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
        return Promise.reject(new Error('LLM failed'))
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
    const pipeline = new TranslationPipeline(executor)

    try {
      await pipeline.run('テスト')
      expect.unreachable('expected pipeline to reject the executor error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('LLM failed')
    }
  })

  it('skips the LLM and returns empty translatedSegments when translationInputs is empty', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)

    const result = await pipeline.runStructured({
      cleanText: '[code]const x = 1[/code]',
      translationInputs: [],
    })

    expect(getCallCount()).toBe(0)
    expect(result.translatedSegments).toEqual([])
    expect(result.translation.cleanText).toBe('[code]const x = 1[/code]')
  })

  it('wraps a single translated segment when there is exactly one translation input', async () => {
    const { executor } = makeExecutor({ sourceLang: 'Japanese', translated: 'Xin chào' })
    const pipeline = new TranslationPipeline(executor)

    const result = await pipeline.runStructured({
      cleanText: 'こんにちは',
      translationInputs: ['こんにちは'],
    })

    expect(result.translation.translatedText).toBe('Xin chào')
    expect(result.translatedSegments).toEqual(['Xin chào'])
  })

  it('uses the structured prompt path for multiple translation inputs with one executor call', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({
          sourceLang: 'Japanese',
          translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
        } as T)
      },
      describeExecution() {
        return {
          generation: {
            temperature: 0.35,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }
      },
    }
    const pipeline = new TranslationPipeline(executor)

    const result = await pipeline.runStructured({
      cleanText: '[info][title]こんにちは[/title]資料をご確認ください。[/info]',
      translationInputs: ['こんにちは', '資料をご確認ください。'],
    })

    expect(captured.prompts?.user).toContain('<TRANSLATE_SEGMENTS>')
    expect(captured.prompts?.user).toContain('<MESSAGE_CONTEXT>')
    expect(captured.prompts?.user).toContain(
      '[info][title]こんにちは[/title]資料をご確認ください。[/info]',
    )
    expect(result.translatedSegments).toEqual(['Xin chào', 'Vui lòng xem tài liệu.'])
  })

  it('throws INVALID_RESPONSE when the structured response segment count mismatches the input', async () => {
    const { executor } = makeExecutor({
      sourceLang: 'Japanese',
      translatedSegments: ['Xin chào'],
    })
    const pipeline = new TranslationPipeline(executor)

    try {
      await pipeline.runStructured({
        cleanText: 'こんにちは\n資料をご確認ください。',
        translationInputs: ['こんにちは', '資料をご確認ください。'],
      })
      expect.unreachable('expected pipeline to reject invalid structured response')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_RESPONSE',
        message: 'Translation segment count mismatch',
      })
    }
  })

  it('returns the actual prompt snapshot and prompt mode for structured translation runs', async () => {
    const { executor } = makeExecutor({
      sourceLang: 'Japanese',
      translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
    })
    const pipeline = new TranslationPipeline(executor, {
      translationStyle: 'NATURAL_CASUAL',
    })

    const result = await pipeline.runStructured({
      cleanText: 'こんにちは\n資料をご確認ください。',
      translationInputs: ['こんにちは', '資料をご確認ください。'],
    })

    expect(result.debug).toBeDefined()
    const debug = result.debug
    expect(debug?.promptMode).toBe('structured_segments')
    expect(debug?.prompts.user).toContain('<TRANSLATE_SEGMENTS>')
    expect(debug?.prompts.system).toContain('NATURAL_CASUAL')
  })

  it('keeps a long natural-casual single message in single_text mode so style can work across the whole note', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({
          sourceLang: 'Japanese',
          translated: 'Bản dịch liền mạch',
        } as T)
      },
      describeExecution() {
        return {
          generation: {
            temperature: 0.55,
            maxOutputTokens: 4000,
            providerOptions: { openai: { reasoningEffort: 'low' } },
            providerManaged: false,
          },
        }
      },
    }
    const pipeline = new TranslationPipeline(executor, {
      translationStyle: 'NATURAL_CASUAL',
    })
    const source =
      '動画を一定時間のチャンクに分割する\n\n2. 圧縮技術による最適化\nエンコード処理\n\nフレームサンプリング:\nすべてを送る必要はない。'

    const result = await pipeline.runStructured({
      cleanText: source,
      translationInputs: [source],
    })

    expect(captured.prompts?.user).toContain('<TRANSLATE_TEXT>')
    expect(result.debug?.promptMode).toBe('single_text')
    expect(result.translatedSegments).toEqual(['Bản dịch liền mạch'])
    expect(result.translation.translatedText).toBe('Bản dịch liền mạch')
  })
})
