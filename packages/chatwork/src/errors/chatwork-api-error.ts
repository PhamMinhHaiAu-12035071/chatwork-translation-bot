export class ChatworkApiError extends Error {
  readonly statusCode: number
  readonly statusText: string
  readonly errors: string[]

  constructor(message: string, statusCode: number, statusText: string, errors: string[] = []) {
    super(message)
    this.name = 'ChatworkApiError'
    this.statusCode = statusCode
    this.statusText = statusText
    this.errors = errors
  }
}

export class ChatworkRateLimitError extends ChatworkApiError {
  readonly retryAfter: number

  constructor(retryAfter: number, errors: string[] = []) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter.toString()} seconds.`,
      429,
      'Too Many Requests',
      errors,
    )
    this.name = 'ChatworkRateLimitError'
    this.retryAfter = retryAfter
  }
}
