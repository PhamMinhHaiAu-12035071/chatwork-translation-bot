import { describe, expect, it } from 'bun:test'
import { strictBooleanFromEnv } from './env-boolean'

describe('strictBooleanFromEnv', () => {
  it('parses strict truthy and falsy string values', () => {
    const schema = strictBooleanFromEnv()

    expect(schema.parse('true')).toBe(true)
    expect(schema.parse('false')).toBe(false)
    expect(schema.parse('1')).toBe(true)
    expect(schema.parse('0')).toBe(false)
  })

  it('applies default when env value is missing or empty', () => {
    const schema = strictBooleanFromEnv(false)

    expect(schema.parse(undefined)).toBe(false)
    expect(schema.parse('')).toBe(false)
    expect(schema.parse('   ')).toBe(false)
  })

  it('rejects ambiguous string values', () => {
    const schema = strictBooleanFromEnv()
    const result = schema.safeParse('yes')

    expect(result.success).toBe(false)
  })
})
