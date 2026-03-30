import { describe, it, expect } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
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
  }
  return { executor, getCallCount: () => callCount }
}

describe('TranslationPipeline', () => {
  it('calls executor twice for any text (draft + polish)', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('お世話になっております。')
    expect(getCallCount()).toBe(2)
  })

  it('calls executor twice for short text (draft + polish)', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('OK')
    expect(getCallCount()).toBe(2)
  })

  it('returns TranslationResult with translatedText from executor', async () => {
    const { executor } = makeExecutor({ sourceLang: 'Japanese', translated: 'Xin chào' })
    const pipeline = new TranslationPipeline(executor)
    const result = await pipeline.run('こんにちは')
    expect(result.translatedText).toBe('Xin chào')
    expect(result.sourceLang).toBe('Japanese')
    expect(result.targetLang).toBe('Vietnamese')
  })

  it('passes the source text to buildSingleCallPrompts (text appears in executor prompts)', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({ sourceLang: 'Japanese', translated: 'テスト' } as unknown as T)
      },
    }
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('リリース予定について')
    expect(captured.prompts).toBeDefined()
    expect(captured.prompts?.user).toContain('リリース予定について')
  })

  it('passes the selected style into the single-call prompt path', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({ sourceLang: 'Japanese', translated: 'Xin chào' } as T)
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

  it('still skips the LLM for zero-input requests even when a style is configured', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor, {
      translationStyle: 'TECHNICAL',
    })

    const result = await pipeline.runStructured({
      cleanText: '[code]const x = 1[/code]',
      translationInputs: [],
    })

    expect(getCallCount()).toBe(0)
    expect(result.translatedSegments).toEqual([])
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

  it('uses the structured prompt path for multiple translation inputs', async () => {
    const captured: { prompts?: PromptPair } = {}
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
        captured.prompts = prompts
        return Promise.resolve({
          sourceLang: 'Japanese',
          translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
        } as T)
      },
    }
    const pipeline = new TranslationPipeline(executor)

    const result = await pipeline.runStructured({
      cleanText: 'こんにちは\n資料をご確認ください。',
      translationInputs: ['こんにちは', '資料をご確認ください。'],
    })

    expect(captured.prompts?.user).toContain('translatedSegments')
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

  describe('two-step pipeline (draft → polish)', () => {
    it('calls executor twice for single text — draft then polish', async () => {
      let callCount = 0
      const executor: ILLMExecutor = {
        execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
          }
          return Promise.resolve({ translated: 'Bản hoàn thiện' } as T)
        },
      }
      const pipeline = new TranslationPipeline(executor)
      const result = await pipeline.run('テスト')
      expect(callCount).toBe(2)
      expect(result.translatedText).toBe('Bản hoàn thiện')
      expect(result.sourceLang).toBe('Japanese')
    })

    it('calls executor twice for structured multi-segment translation', async () => {
      let callCount = 0
      const executor: ILLMExecutor = {
        execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              sourceLang: 'Japanese',
              translatedSegments: ['Nháp 1', 'Nháp 2'],
            } as T)
          }
          return Promise.resolve({ translatedSegments: ['Hoàn thiện 1', 'Hoàn thiện 2'] } as T)
        },
      }
      const pipeline = new TranslationPipeline(executor)
      const result = await pipeline.runStructured({
        cleanText: 'こんにちは\n資料をご確認ください。',
        translationInputs: ['こんにちは', '資料をご確認ください。'],
      })
      expect(callCount).toBe(2)
      expect(result.translatedSegments).toEqual(['Hoàn thiện 1', 'Hoàn thiện 2'])
    })

    it('passes source text and draft to polish prompt (second call)', async () => {
      const calls: PromptPair[] = []
      const executor: ILLMExecutor = {
        execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
          calls.push(prompts)
          if (calls.length === 1) {
            return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
          }
          return Promise.resolve({ translated: 'Bản hoàn thiện' } as T)
        },
      }
      const pipeline = new TranslationPipeline(executor)
      await pipeline.run('テスト')
      expect(calls).toHaveLength(2)
      // Polish call (second) should contain both source and draft
      if (calls[1]) {
        expect(calls[1].user).toContain('テスト')
        expect(calls[1].user).toContain('Bản nháp')
      }
    })

    it('falls back to draft when polish step fails', async () => {
      let callCount = 0
      const executor: ILLMExecutor = {
        execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({ sourceLang: 'Japanese', translated: 'Bản nháp' } as T)
          }
          return Promise.reject(new Error('Polish LLM failed'))
        },
      }
      const pipeline = new TranslationPipeline(executor)
      const result = await pipeline.run('テスト')
      expect(result.translatedText).toBe('Bản nháp')
      expect(result.sourceLang).toBe('Japanese')
    })

    it('falls back to draft segments when structured polish step fails', async () => {
      let callCount = 0
      const executor: ILLMExecutor = {
        execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              sourceLang: 'Japanese',
              translatedSegments: ['Nháp 1', 'Nháp 2'],
            } as T)
          }
          return Promise.reject(new Error('Polish LLM failed'))
        },
      }
      const pipeline = new TranslationPipeline(executor)
      const result = await pipeline.runStructured({
        cleanText: 'こんにちは\n資料',
        translationInputs: ['こんにちは', '資料'],
      })
      expect(result.translatedSegments).toEqual(['Nháp 1', 'Nháp 2'])
    })

    it('still skips LLM entirely for zero-input structured requests', async () => {
      const { executor, getCallCount } = makeExecutor()
      const pipeline = new TranslationPipeline(executor)
      const result = await pipeline.runStructured({
        cleanText: '[code]x[/code]',
        translationInputs: [],
      })
      expect(getCallCount()).toBe(0)
      expect(result.translatedSegments).toEqual([])
    })
  })
})
