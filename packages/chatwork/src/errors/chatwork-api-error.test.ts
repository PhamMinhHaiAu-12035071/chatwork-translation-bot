import { describe, expect, it } from 'bun:test'
import { ChatworkApiError, ChatworkRateLimitError } from './chatwork-api-error'

describe('ChatworkApiError', () => {
  it('stores statusCode, statusText, and errors', () => {
    const error = new ChatworkApiError('Something went wrong', 400, 'Bad Request', [
      'Invalid room id',
    ])
    expect(error.statusCode).toBe(400)
    expect(error.statusText).toBe('Bad Request')
    expect(error.errors).toEqual(['Invalid room id'])
    expect(error.message).toBe('Something went wrong')
    expect(error.name).toBe('ChatworkApiError')
  })

  it('defaults errors to empty array', () => {
    const error = new ChatworkApiError('Not found', 404, 'Not Found')
    expect(error.errors).toEqual([])
  })

  it('is instanceof Error', () => {
    const error = new ChatworkApiError('test', 500, 'Internal Server Error')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ChatworkApiError)
  })
})

describe('ChatworkRateLimitError', () => {
  it('extends ChatworkApiError with retryAfter', () => {
    const error = new ChatworkRateLimitError(60)
    expect(error).toBeInstanceOf(ChatworkApiError)
    expect(error).toBeInstanceOf(ChatworkRateLimitError)
    expect(error.statusCode).toBe(429)
    expect(error.retryAfter).toBe(60)
    expect(error.name).toBe('ChatworkRateLimitError')
  })

  it('stores errors array', () => {
    const error = new ChatworkRateLimitError(30, ['Rate limit exceeded'])
    expect(error.errors).toEqual(['Rate limit exceeded'])
    expect(error.retryAfter).toBe(30)
  })

  it('message includes retry-after seconds', () => {
    const error = new ChatworkRateLimitError(120)
    expect(error.message).toContain('120')
  })
})
