import { describe, it, expect } from 'bun:test'
import { KagiSidecarError } from './errors'

describe('KagiSidecarError', () => {
  it('should support UI_INTERACTION error code', () => {
    const error = new KagiSidecarError('UI_INTERACTION', 'URL verification failed', {
      step: 'verifyUrlContains',
      expectedFragment: 'speaker_gender=unknown',
    })

    expect(error.code).toBe('UI_INTERACTION')
    expect(error.retryable).toBe(false) // UI failures are not retryable
    expect(error.context).toEqual({
      step: 'verifyUrlContains',
      expectedFragment: 'speaker_gender=unknown',
    })
  })
})
