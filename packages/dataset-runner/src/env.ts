import { z } from 'zod'
import { strictBooleanFromEnv } from '@chatwork-bot/core'

function optionalNonEmptyStringFromEnv() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return value

    const normalized = value.trim()
    return normalized === '' ? undefined : normalized
  }, z.string().min(1).optional())
}

function optionalPositiveIntFromEnv() {
  return z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return undefined
    return value
  }, z.coerce.number().int().positive().optional())
}

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1),
    CHATWORK_ORIGINAL_ROOM_ID: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
    DATASET_AUTORUN: strictBooleanFromEnv(false),
    DATASET_INPUT_DIR: z.string().min(1).default('./input'),
    DATASET_RESET_MODE: z.enum(['resume', 'from-start', 'from-line']).default('resume'),
    DATASET_RESET_FILE: optionalNonEmptyStringFromEnv(),
    DATASET_RESET_LINE: optionalPositiveIntFromEnv(),
    DATASET_RESET_CONFIRM: optionalNonEmptyStringFromEnv(),
    DATASET_CLEAR_FAILED: strictBooleanFromEnv(false),
    DATASET_CLEAR_OUTPUT: strictBooleanFromEnv(false),
    DATASET_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(2000),
    DATASET_MAX_RETRIES: z.coerce.number().int().positive().default(3),
    DATASET_ITEM_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
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

    if (value.DATASET_RESET_MODE !== 'resume' && !value.DATASET_RESET_CONFIRM) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATASET_RESET_CONFIRM'],
        message: 'DATASET_RESET_CONFIRM is required when DATASET_RESET_MODE is not resume',
      })
    }
  })

const result = envSchema.safeParse(process.env)
if (!result.success) {
  for (const issue of result.error.issues)
    console.error(`[env] ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

export const env = result.data
export type Env = z.infer<typeof envSchema>
