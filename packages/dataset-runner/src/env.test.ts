import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

// We test the schema logic in isolation without importing env.ts (which calls process.exit on parse failure).
// The schema is re-defined here to test its validation rules.
const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1),
    CHATWORK_ORIGINAL_ROOM_ID: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
    DATASET_AUTORUN: z.coerce.boolean().default(false),
    DATASET_INPUT_DIR: z.string().min(1).default('./input'),
    DATASET_RESET_MODE: z.enum(['resume', 'from-start', 'from-line']).default('resume'),
    DATASET_RESET_FILE: z.string().min(1).optional(),
    DATASET_RESET_LINE: z.coerce.number().int().positive().optional(),
    DATASET_CLEAR_FAILED: z.coerce.boolean().default(false),
    DATASET_CLEAR_OUTPUT: z.coerce.boolean().default(false),
    DATASET_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(2000),
    DATASET_MAX_RETRIES: z.coerce.number().int().positive().default(3),
    DATASET_ITEM_TIMEOUT_MS: z.coerce.number().int().positive().default(900000),
    DATASET_RUNNER_PORT: z.coerce.number().int().positive().default(3002),
  })
  .superRefine((value, ctx) => {
    if (value.DATASET_RESET_MODE !== 'resume' && !value.DATASET_RESET_FILE) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATASET_RESET_FILE'],
        message: 'DATASET_RESET_FILE is required when DATASET_RESET_MODE is not resume',
      })
    }

    if (value.DATASET_RESET_MODE === 'from-line' && !value.DATASET_RESET_LINE) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATASET_RESET_LINE'],
        message: 'DATASET_RESET_LINE is required when DATASET_RESET_MODE=from-line',
      })
    }

    if (
      value.DATASET_RESET_MODE !== 'resume' &&
      value.NODE_ENV !== 'development' &&
      value.NODE_ENV !== 'local'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATASET_RESET_MODE'],
        message: 'reset/replay is allowed only in development or local mode',
      })
    }
  })

const validBase = {
  CHATWORK_API_TOKEN: 'test-token',
  CHATWORK_ORIGINAL_ROOM_ID: '12345',
}

describe('env schema', () => {
  it('parses valid minimal env', () => {
    const result = envSchema.safeParse(validBase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DATASET_AUTORUN).toBe(false)
      expect(result.data.DATASET_RUNNER_PORT).toBe(3002)
      expect(result.data.DATASET_RESET_MODE).toBe('resume')
    }
  })

  it('fails when CHATWORK_API_TOKEN is missing', () => {
    const result = envSchema.safeParse({ CHATWORK_ORIGINAL_ROOM_ID: '12345' })
    expect(result.success).toBe(false)
  })

  it('fails when CHATWORK_ORIGINAL_ROOM_ID is missing', () => {
    const result = envSchema.safeParse({ CHATWORK_API_TOKEN: 'tok' })
    expect(result.success).toBe(false)
  })

  it('fails when DATASET_RESET_MODE=from-line without DATASET_RESET_LINE', () => {
    const result = envSchema.safeParse({
      ...validBase,
      DATASET_RESET_MODE: 'from-line',
      DATASET_RESET_FILE: 'some-file.json',
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('DATASET_RESET_LINE')
    }
  })

  it('fails when DATASET_RESET_MODE=from-start in production', () => {
    const result = envSchema.safeParse({
      ...validBase,
      DATASET_RESET_MODE: 'from-start',
      DATASET_RESET_FILE: 'some-file.json',
      NODE_ENV: 'production',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('DATASET_RESET_MODE')
    }
  })

  it('fails when DATASET_RESET_MODE is not resume without DATASET_RESET_FILE', () => {
    const result = envSchema.safeParse({
      ...validBase,
      DATASET_RESET_MODE: 'from-start',
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('DATASET_RESET_FILE')
    }
  })
})
