import { describe, expect, it, mock } from 'bun:test'
import { TranslationError } from '~/interfaces/translation'
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'

function makeService(impl: () => Promise<TranslationResult>): ITranslationService {
  return { translate: mock(impl) }
}

const okResult = {
  cleanText: 'Hello',
  translatedText: 'Xin chào',
  sourceLang: 'English',
  targetLang: 'Vietnamese' as const,
  timestamp: new Date().toISOString(),
}

describe('translateWithPolicy', () => {
  async function getPolicy() {
    const { translateWithPolicy } = await import('./translation-execution-policy')
    return translateWithPolicy
  }

  it('returns result on first attempt', async () => {
    const policy = await getPolicy()
    const service = makeService(() => Promise.resolve(okResult))
    const result = await policy(service, 'Hello')
    expect(result.translatedText).toBe('Xin chào')
  })

  it('retries on API_ERROR and eventually succeeds', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new TranslationError('transient', 'API_ERROR'))
      }
      return Promise.resolve(okResult)
    })
    const result = await policy(service, 'Hello')
    expect(result.translatedText).toBe('Xin chào')
    expect(attempt).toBe(3)
  })

  it('does not retry on QUOTA_EXCEEDED (non-transient)', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('quota', 'QUOTA_EXCEEDED'))
    })
    try {
      await policy(service, 'Hello')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
    expect(attempt).toBe(1)
  })

  it('does not retry on INVALID_RESPONSE (non-transient)', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('bad resp', 'INVALID_RESPONSE'))
    })
    try {
      await policy(service, 'Hello')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
    expect(attempt).toBe(1)
  })

  it('stops retrying after 2 retries (3 total attempts) on persistent API_ERROR', async () => {
    const policy = await getPolicy()
    let attempt = 0
    const service = makeService(() => {
      attempt++
      return Promise.reject(new TranslationError('always fails', 'API_ERROR'))
    })
    try {
      await policy(service, 'Hello')
      expect.unreachable('should have thrown')
    } catch {
      // expected
    }
    expect(attempt).toBe(3)
  })
})
