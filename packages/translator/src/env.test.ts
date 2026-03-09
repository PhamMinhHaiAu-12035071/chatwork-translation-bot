import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

const envSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  AI_PROVIDER: z.string().min(1, 'AI_PROVIDER is required'),
  AI_MODEL: z.string().min(1).optional(),
})

const base = {
  CHATWORK_API_TOKEN: 'tok-123',
  CHATWORK_DESTINATION_ROOM_ID: '12345',
}

describe('env schema - flat', () => {
  it('accepts valid config with AI_PROVIDER only', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(true)
  })

  it('accepts config with AI_PROVIDER and AI_MODEL', () => {
    const result = envSchema.safeParse({
      ...base,
      AI_PROVIDER: 'openai',
      AI_MODEL: 'gpt-4o',
    })
    expect(result.success).toBe(true)
  })

  it('accepts any string as AI_PROVIDER', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'groq' })
    expect(result.success).toBe(true)
  })

  it('rejects missing AI_PROVIDER', () => {
    const result = envSchema.safeParse(base)
    expect(result.success).toBe(false)
  })

  it('rejects empty AI_PROVIDER', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: '' })
    expect(result.success).toBe(false)
  })

  it('applies default PORT and NODE_ENV', () => {
    const result = envSchema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3000)
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('rejects missing CHATWORK_API_TOKEN', () => {
    const result = envSchema.safeParse({
      CHATWORK_DESTINATION_ROOM_ID: '12345',
      AI_PROVIDER: 'gemini',
    })
    expect(result.success).toBe(false)
  })
})
