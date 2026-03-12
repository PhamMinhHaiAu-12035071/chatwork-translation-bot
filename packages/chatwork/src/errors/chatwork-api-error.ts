export class ChatworkApiError extends Error {
  readonly statusCode: number
  readonly errors: string[]

  constructor(message: string, statusCode: number, errors: string[] = []) {
    super(message)
    this.name = 'ChatworkApiError'
    this.statusCode = statusCode
    this.errors = errors
  }
}

export class ChatworkRateLimitError extends ChatworkApiError {
  readonly retryAfter: number

  constructor(retryAfter: number, errors: string[] = []) {
    super(`Rate limit exceeded. Retry after ${retryAfter.toString()} seconds.`, 429, errors)
    this.name = 'ChatworkRateLimitError'
    this.retryAfter = retryAfter
  }
}
