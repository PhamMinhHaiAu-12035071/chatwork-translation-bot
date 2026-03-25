import { afterEach, describe, expect, it } from 'bun:test'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) void Reflect.deleteProperty(process.env, key)
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
})

describe('translator env', () => {
  it('applies observability defaults when optional vars are absent', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
    process.env['AI_PROVIDER'] = 'cursor'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.TRANSLATOR_PHASE_HEARTBEAT_MS).toBe(30_000)
    expect(env.TRANSLATOR_TRANSLATION_BUDGET_MS).toBe(60_000)
    expect(env.TRANSLATOR_DELIVERY_BUDGET_MS).toBe(45_000)
    expect(env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS).toBe(10_000)
    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(1_800_000)
    expect(env.TRANSLATOR_STATUS_HISTORY_LIMIT).toBe(20)
  })

  it('allows overriding the pipeline timeout', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
    process.env['AI_PROVIDER'] = 'openai'
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '45000'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(45_000)
  })

  it('defaults AI_TRANSLATION_STYLE to PROFESSIONAL_BUSINESS', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
    process.env['AI_PROVIDER'] = 'openai'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.AI_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
  })

  it('accepts a valid AI_TRANSLATION_STYLE override', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
    process.env['AI_PROVIDER'] = 'openai'
    process.env['AI_TRANSLATION_STYLE'] = 'TECHNICAL'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.AI_TRANSLATION_STYLE).toBe('TECHNICAL')
  })

  it('rejects invalid AI_TRANSLATION_STYLE values at schema level', async () => {
    const { translatorEnvSchema } = await import('./env-schema')
    const result = translatorEnvSchema.safeParse({
      CHATWORK_API_TOKEN: 'token',
      CHATWORK_DESTINATION_ROOM_ID: '123',
      AI_PROVIDER: 'openai',
      AI_TRANSLATION_STYLE: 'whatever',
    })

    expect(result.success).toBe(false)
  })
})
