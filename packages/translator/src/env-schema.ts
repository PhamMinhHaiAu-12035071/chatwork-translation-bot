import { z } from 'zod'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export const translatorEnvSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  CHATWORK_BOT_ACCOUNT_ID: z.coerce
    .number()
    .int()
    .positive('CHATWORK_BOT_ACCOUNT_ID must be a positive integer'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  ROOM_CONFIG_ENCRYPTION_KEY: z
    .string()
    .length(64, 'ROOM_CONFIG_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  ROOM_CONFIG_DATA_DIR: z.string().default('./data'),
  KAGI_TRANSLATOR_URL: z.url().default('http://kagi-translator:3002'),
  KAGI_MAX_ENCODED_PAYLOAD_CHARS: z.coerce.number().int().positive().default(12_000),
  KAGI_MAX_SEGMENT_COUNT: z.coerce.number().int().positive().default(50),
  TRANSLATOR_PHASE_HEARTBEAT_MS: z.coerce.number().int().positive().default(30_000),
  TRANSLATOR_TRANSLATION_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(45_000),
  TRANSLATOR_ACK_CALLBACK_BUDGET_MS: z.coerce.number().int().positive().default(10_000),
  TRANSLATOR_PIPELINE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS),
  TRANSLATOR_STATUS_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
  USE_ASYNC_LOGGING: z.coerce.boolean().default(true),
  ENABLE_ASYNC_DELIVERY: z.coerce.boolean().default(false), // TODO: Enable after updating tests
  
  // Circuit breaker config
  CHATWORK_API_FAILURE_THRESHOLD: z.coerce.number().default(5),
  CHATWORK_API_RESET_TIMEOUT_MS: z.coerce.number().default(30000),
  LLM_PROVIDER_FAILURE_THRESHOLD: z.coerce.number().default(3),
  LLM_PROVIDER_RESET_TIMEOUT_MS: z.coerce.number().default(60000),
  
  // HTTP connection pooling
  ENABLE_HTTP_KEEPALIVE: z.coerce.boolean().default(true),
  
  // Keyword processing optimization
  KEYWORD_PATTERN_CACHE_MAX: z.coerce.number().default(100),
  ENABLE_KEYWORD_CACHE: z.coerce.boolean().default(true),
  
  // Prompt optimization (Phase 2)
  // Default: 'optimized' (-41% tokens, -38% response time, A/B tested ✓)
  // Rollback: Set to 'baseline' if issues occur
  TRANSLATION_PROMPT_VERSION: z.enum(['baseline', 'optimized']).default('optimized'),
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
