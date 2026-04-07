import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { logTranslatorEvent } from './translator-observability-runtime'
import { asyncLogger } from './async-logger'
import type { TranslatorLogEntry } from '~/types/observability'

describe('logTranslatorEvent with AsyncLogger', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env['USE_ASYNC_LOGGING']
    process.env['USE_ASYNC_LOGGING'] = 'true'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['USE_ASYNC_LOGGING'] = originalEnv
    } else {
      delete process.env['USE_ASYNC_LOGGING']
    }
  })

  it('should delegate to async logger', () => {
    const logSpy = mock(() => {
      // Mock implementation - no-op
    })
    asyncLogger.log = logSpy

    const testEntry: Partial<TranslatorLogEntry> = {
      level: 'info',
      service: 'translator',
      event: 'test_event',
      requestId: 'req-123',
      traceId: 'trace-123',
      sourceMessageId: 'msg-123',
      originType: 'manual',
      provider: 'gemini',
      model: 'gemini-2.0-flash-exp',
      translationStyle: 'NATURAL_CASUAL',
      roomId: 12345,
      inputLength: 100,
    }

    logTranslatorEvent(testEntry as TranslatorLogEntry)

    expect(logSpy).toHaveBeenCalled()
    expect(logSpy.mock.calls.length).toBeGreaterThan(0)
  })
})
