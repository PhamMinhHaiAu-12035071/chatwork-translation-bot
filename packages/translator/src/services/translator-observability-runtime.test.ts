import { describe, it, expect, mock } from 'bun:test'
import { logTranslatorEvent } from './translator-observability-runtime'
import { asyncLogger } from './async-logger'

describe('logTranslatorEvent with AsyncLogger', () => {
  it('should delegate to async logger', () => {
    const logSpy = mock(asyncLogger, 'log')
    
    logTranslatorEvent({
      level: 'info',
      event: 'test_event',
      data: { key: 'value' },
    })
    
    expect(logSpy).toHaveBeenCalledWith({
      level: 'info',
      event: 'test_event',
      data: { key: 'value' },
    })
  })
})
