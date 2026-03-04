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

const envSchema = z.object({
  CHATWORK_WEBHOOK_SECRET: webhookSecretSchema,
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z
    .string()
    .url('TRANSLATOR_URL must be a valid URL')
    .default('http://localhost:3000'),
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
