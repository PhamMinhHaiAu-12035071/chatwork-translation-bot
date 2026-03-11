import { z } from 'zod'

export const translatorEnvSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_DESTINATION_ROOM_ID: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  AI_PROVIDER: z.string().min(1, 'AI_PROVIDER is required'),
  AI_MODEL: z.string().min(1).optional(),
  TRANSLATOR_PHASE_HEARTBEAT_MS: z.coerce.number().int().positive().default(30_000),
  TRANSLATOR_ANALYSIS_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_TRANSLATION_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_REVIEW_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(15_000),
  TRANSLATOR_ACK_CALLBACK_BUDGET_MS: z.coerce.number().int().positive().default(10_000),
  TRANSLATOR_STATUS_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
})

export function parseTranslatorEnv(input: NodeJS.ProcessEnv) {
  const result = translatorEnvSchema.safeParse(input)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}
