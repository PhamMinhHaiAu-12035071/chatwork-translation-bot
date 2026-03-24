import { describe, it, expect } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationPipeline } from './pipeline'

function makeExecutor(result = { sourceLang: 'Japanese', translated: 'こんにちは→xin chào' }) {
  let callCount = 0
  const executor: ILLMExecutor = {
    execute<T>(_prompts: PromptPair, _schema: ISchema<T>) {
      callCount++
      return Promise.resolve(result as unknown as T)
    },
  }
  return { executor, getCallCount: () => callCount }
}

describe('TranslationPipeline', () => {
  it('calls executor exactly once for any text', async () => {
    const { executor, getCallCount } = makeExecutor()
    const pipeline = new TranslationPipeline(executor)
    await pipeline.run('お世話になっております。')
    expect(getCallCount()).toBe(1)
  })

  it('calls executor exactly once for short text', async () => {
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
})
