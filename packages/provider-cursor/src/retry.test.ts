import { describe, expect, it, mock } from 'bun:test'
import { TranslationError } from '@chatwork-bot/core'

describe('withRetry', () => {
  it('returns result immediately on first success', async () => {
    const { withRetry } = await import('./retry')
    const fn = mock(() => Promise.resolve('ok'))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const result = await withRetry(fn, { sleepFn })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('retries on API_ERROR and returns result on second attempt', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.resolve('ok'))
    fn.mockImplementationOnce(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const result = await withRetry(fn, { sleepFn })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenCalledTimes(1)
    expect(sleepFn).toHaveBeenCalledWith(240_000)
  })

  it('throws after exhausting all attempts', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    try {
      await withRetry(fn, { sleepFn })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
      expect((error as TranslationError).message).toBe('timeout')
    }
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2) // sleep between attempts, not after last
  })

  it('throws immediately on TIMEOUT — not retryable', async () => {
    const { withRetry } = await import('./retry')
    const timeoutError = new TranslationError('signal fired', 'TIMEOUT')
    const fn = mock(() => Promise.reject(timeoutError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    try {
      await withRetry(fn, { sleepFn })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
      expect((error as TranslationError).message).toBe('signal fired')
    }
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('throws immediately when custom isRetryable returns false', async () => {
    const { withRetry } = await import('./retry')
    const err = new Error('some error')
    const fn = mock(() => Promise.reject(err))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    try {
      await withRetry(fn, { sleepFn, isRetryable: () => false })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).toBe('some error')
    }
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('throws immediately if signal is aborted before sleep', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const sleepFn = mock((_ms: number) => Promise.resolve())
    const controller = new AbortController()
    controller.abort() // already aborted
    try {
      await withRetry(fn, { sleepFn, signal: controller.signal })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeDefined()
    }
    expect(sleepFn).not.toHaveBeenCalled()
  })

  it('does not proceed to next attempt if signal aborts after sleep', async () => {
    const { withRetry } = await import('./retry')
    const apiError = new TranslationError('timeout', 'API_ERROR')
    const fn = mock(() => Promise.reject(apiError))
    const controller = new AbortController()
    const sleepFn = mock((_ms: number) => {
      controller.abort()
      return Promise.resolve()
    })
    try {
      await withRetry(fn, { sleepFn, signal: controller.signal })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeDefined()
    }
    expect(fn).toHaveBeenCalledTimes(1) // no second attempt
    expect(sleepFn).toHaveBeenCalledTimes(1)
  })
})
