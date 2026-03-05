import { z } from 'zod'
import { AI_PROVIDER_VALUES } from '@chatwork-bot/core'

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
    AI_PROVIDER: z.enum(AI_PROVIDER_VALUES),
    AI_MODEL: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER === 'gemini' && !data.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini',
        path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      })
    }
    if (data.AI_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
        path: ['OPENAI_API_KEY'],
      })
    }
  })

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
