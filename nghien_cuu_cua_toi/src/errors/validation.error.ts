/**
 * Custom error class for validation failures
 *
 * Part of Clean Code refactor - meaningful error types instead of generic Error
 */

/**
 * Validation error with detailed context
 * @example
 * throw new ValidationError('readingLevel', 'x99', ['standard', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
 * // Error: Invalid readingLevel: "x99". Allowed: standard, a1, a2, b1, b2, c1, c2
 */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly allowedValues: readonly string[],
  ) {
    super(`Invalid ${field}: "${String(value)}". Allowed values: ${allowedValues.join(', ')}`)
    this.name = 'ValidationError'

    // Maintains proper stack trace (Bun/V8/Node.js)
    Error.captureStackTrace(this, ValidationError)
  }
}
