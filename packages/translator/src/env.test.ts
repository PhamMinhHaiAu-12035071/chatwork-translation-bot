import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { GEMINI_MODEL_VALUES, OPENAI_MODEL_VALUES, CURSOR_MODEL_VALUES } from '@chatwork-bot/core'

const baseEnv = z.object({
  CHATWORK_API_TOKEN: z.string().min(1),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
})

const providerUnion = z.discriminatedUnion('AI_PROVIDER', [
  z.object({
    AI_PROVIDER: z.literal('gemini'),
    AI_MODEL: z.enum(GEMINI_MODEL_VALUES).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  }),
  z.object({
    AI_PROVIDER: z.literal('openai'),
    AI_MODEL: z.enum(OPENAI_MODEL_VALUES).optional(),
    OPENAI_API_KEY: z.string().min(1),
  }),
  z.object({
    AI_PROVIDER: z.literal('cursor'),
    AI_MODEL: z.enum(CURSOR_MODEL_VALUES).or(z.string().min(1)).optional(),
    CURSOR_API_URL: z.url().refine((u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u), {
      message: 'CURSOR_API_URL must be a localhost URL (local dev only)',
    }),
  }),
])

const schema = baseEnv.and(providerUnion)

const base = {
  CHATWORK_API_TOKEN: 'tok-123',
  CHATWORK_DESTINATION_ROOM_ID: '12345',
}

describe('env schema - gemini branch', () => {
  it('accepts valid gemini config', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey-xxx',
    })
    expect(result.success).toBe(true)
  })

  it('accepts gemini with explicit model', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey-xxx',
      AI_MODEL: 'gemini-2.0-flash',
    })
    expect(result.success).toBe(true)
  })

  it('rejects gemini without GOOGLE_GENERATIVE_AI_API_KEY', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'gemini' })
    expect(result.success).toBe(false)
  })

  it('rejects gemini with invalid AI_MODEL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'gemini',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey',
      AI_MODEL: 'gpt-4o',
    })
    expect(result.success).toBe(false)
  })
})

describe('env schema - openai branch', () => {
  it('accepts valid openai config', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-xxx',
    })
    expect(result.success).toBe(true)
  })

  it('rejects openai without OPENAI_API_KEY', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'openai' })
    expect(result.success).toBe(false)
  })
})

describe('env schema - cursor branch', () => {
  it('accepts valid cursor config with localhost URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://localhost:8765/v1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts cursor with 127.0.0.1 URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://127.0.0.1:8765/v1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects cursor with non-localhost URL', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'https://api.example.com',
    })
    expect(result.success).toBe(false)
  })

  it('accepts cursor with custom model string (escape hatch)', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'cursor',
      CURSOR_API_URL: 'http://localhost:8765/v1',
      AI_MODEL: 'my-custom-local-model',
    })
    expect(result.success).toBe(true)
  })

  it('rejects cursor without CURSOR_API_URL', () => {
    const result = schema.safeParse({ ...base, AI_PROVIDER: 'cursor' })
    expect(result.success).toBe(false)
  })
})

describe('env schema - base fields', () => {
  it('rejects unknown AI_PROVIDER', () => {
    const result = schema.safeParse({
      ...base,
      AI_PROVIDER: 'unknown-provider',
      GOOGLE_GENERATIVE_AI_API_KEY: 'gkey',
    })
    expect(result.success).toBe(false)
  })
})
