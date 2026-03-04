import { z } from 'zod'

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const webhookSecretSchema = z
  .string()
  .trim()
  .min(1, 'CHATWORK_WEBHOOK_SECRET is required')
  .superRefine((value, ctx) => {
    if (!base64Pattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'CHATWORK_WEBHOOK_SECRET must be a valid Base64 webhook token from Chatwork Webhook settings',
      })
      return
    }

    try {
      const decoded = atob(value)
      if (decoded.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CHATWORK_WEBHOOK_SECRET cannot decode to an empty value',
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CHATWORK_WEBHOOK_SECRET is not decodable Base64',
      })
    }
  })

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
    CHATWORK_WEBHOOK_SECRET: webhookSecretSchema,
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AI_PROVIDER: z.enum(['gemini', 'openai']),
    AI_MODEL: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AI_PROVIDER === 'gemini' && !data.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=gemini',
        path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      })
    }
    if (data.AI_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
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
