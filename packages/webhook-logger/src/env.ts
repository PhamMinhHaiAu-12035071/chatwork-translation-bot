import { z } from 'zod'
import { strictBooleanFromEnv } from '@chatwork-bot/core'

const envSchema = z.object({
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z.string().pipe(z.url()).default('http://localhost:3000'),
  TRANSLATOR_INTERNAL_URL: z.string().pipe(z.url()).default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  INTERNAL_API_SECRET: z.string().min(1, 'INTERNAL_API_SECRET is required'),
  CHATWORK_SKIP_SIGNATURE_VERIFY: strictBooleanFromEnv(false),
})

export function parseEnv(input: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(input)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = parseEnv(process.env)

export type Env = z.infer<typeof envSchema>
