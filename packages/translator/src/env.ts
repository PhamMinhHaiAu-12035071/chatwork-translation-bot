import { z } from 'zod'
import {
  AI_PROVIDER_VALUES,
  GEMINI_MODEL_VALUES,
  OPENAI_MODEL_VALUES,
  CURSOR_MODEL_VALUES,
} from '@chatwork-bot/core'

const baseEnv = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  INTERNAL_TRANSLATE_SECRET: z
    .string()
    .min(16, 'INTERNAL_TRANSLATE_SECRET must be at least 16 characters'),
})

const providerUnion = z.discriminatedUnion('AI_PROVIDER', [
  z.object({
    AI_PROVIDER: z.literal('gemini'),
    AI_MODEL: z.enum(GEMINI_MODEL_VALUES).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .min(1, 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini'),
  }),
  z.object({
    AI_PROVIDER: z.literal('openai'),
    AI_MODEL: z.enum(OPENAI_MODEL_VALUES).optional(),
    OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required when AI_PROVIDER=openai'),
  }),
  z.object({
    AI_PROVIDER: z.literal('cursor'),
    AI_MODEL: z.enum(CURSOR_MODEL_VALUES).or(z.string().min(1)).optional(),
    CURSOR_API_URL: z
      .url('CURSOR_API_URL must be a valid URL')
      .refine((u) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(u), {
        message: 'CURSOR_API_URL must point to localhost or 127.0.0.1 (LOCAL DEV ONLY)',
      }),
  }),
])

const envSchema = baseEnv.and(providerUnion)

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const supported = AI_PROVIDER_VALUES.join(' | ')
    console.error('[env] Invalid environment variables:')
    console.error(`  Supported providers: ${supported}`)
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()
export type Env = z.infer<typeof envSchema>
