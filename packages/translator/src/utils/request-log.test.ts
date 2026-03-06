import { describe, expect, it, spyOn } from 'bun:test'
import { logTranslationRequest } from './request-log'
import type { TranslationResult } from '@chatwork-bot/core'

function noop() {
  /* intentionally empty */
}

describe('logTranslationRequest', () => {
  it('logs a JSON object with required fields to console.log', () => {
    const consoleSpy = spyOn(console, 'log').mockImplementation(noop)

    const result: TranslationResult = {
      cleanText: 'Hello',
      translatedText: 'Xin chào',
      sourceLang: 'English',
      targetLang: 'Vietnamese',
      timestamp: '2026-03-06T00:00:00.000Z',
    }

    logTranslationRequest({
      requestId: 'req-123',
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      latencyMs: 450,
      outcome: 'success',
      result,
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const rawArg = consoleSpy.mock.calls[0]?.[0] as string | undefined
    const logged = JSON.parse(rawArg ?? '{}') as Record<string, unknown>
    expect(logged['requestId']).toBe('req-123')
    expect(logged['provider']).toBe('gemini')
    expect(logged['model']).toBe('gemini-2.5-pro')
    expect(logged['latencyMs']).toBe(450)
    expect(logged['outcome']).toBe('success')

    consoleSpy.mockRestore()
  })

  it('includes errorCode when outcome is error', () => {
    const consoleSpy = spyOn(console, 'log').mockImplementation(noop)

    logTranslationRequest({
      requestId: 'req-456',
      provider: 'openai',
      model: 'gpt-4o',
      latencyMs: 0,
      outcome: 'error',
      errorCode: 'API_ERROR',
    })

    const rawArg = consoleSpy.mock.calls[0]?.[0] as string | undefined
    const logged = JSON.parse(rawArg ?? '{}') as Record<string, unknown>
    expect(logged['outcome']).toBe('error')
    expect(logged['errorCode']).toBe('API_ERROR')

    consoleSpy.mockRestore()
  })
})
