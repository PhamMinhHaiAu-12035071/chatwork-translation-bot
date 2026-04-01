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
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.ROOM_CONFIG_DATA_DIR).toBe('./data')
    expect(env.TRANSLATOR_PHASE_HEARTBEAT_MS).toBe(30_000)
    expect(env.TRANSLATOR_TRANSLATION_BUDGET_MS).toBe(60_000)
    expect(env.TRANSLATOR_DELIVERY_BUDGET_MS).toBe(45_000)
    expect(env.TRANSLATOR_ACK_CALLBACK_BUDGET_MS).toBe(10_000)
    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(1_800_000)
    expect(env.TRANSLATOR_STATUS_HISTORY_LIMIT).toBe(20)
  })

  it('allows overriding the pipeline timeout', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '45000'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.TRANSLATOR_PIPELINE_TIMEOUT_MS).toBe(45_000)
  })

  it('applies free-room Kagi safety defaults when optional vars are absent', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.KAGI_TRANSLATOR_URL).toBe('http://kagi-translator:3002')
    expect(env.KAGI_MAX_ENCODED_PAYLOAD_CHARS).toBe(12_000)
    expect(env.KAGI_MAX_SEGMENT_COUNT).toBe(50)
  })

  it('allows overriding free-room Kagi safety limits', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)
    process.env['KAGI_TRANSLATOR_URL'] = 'http://localhost:3999'
    process.env['KAGI_MAX_ENCODED_PAYLOAD_CHARS'] = '9000'
    process.env['KAGI_MAX_SEGMENT_COUNT'] = '24'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.KAGI_TRANSLATOR_URL).toBe('http://localhost:3999')
    expect(env.KAGI_MAX_ENCODED_PAYLOAD_CHARS).toBe(9_000)
    expect(env.KAGI_MAX_SEGMENT_COUNT).toBe(24)
  })

  it('accepts a valid custom room config data directory override', async () => {
    process.env['CHATWORK_API_TOKEN'] = 'token'
    process.env['CHATWORK_BOT_ACCOUNT_ID'] = '42'
    process.env['ROOM_CONFIG_ENCRYPTION_KEY'] = 'a'.repeat(64)
    process.env['ROOM_CONFIG_DATA_DIR'] = '/tmp/translator-room-configs'

    const { parseTranslatorEnv } = await import('./env-schema')
    const env = parseTranslatorEnv(process.env)

    expect(env.ROOM_CONFIG_DATA_DIR).toBe('/tmp/translator-room-configs')
  })

  it('rejects invalid ROOM_CONFIG_ENCRYPTION_KEY values at schema level', async () => {
    const { translatorEnvSchema } = await import('./env-schema')
    const result = translatorEnvSchema.safeParse({
      CHATWORK_API_TOKEN: 'token',
      CHATWORK_BOT_ACCOUNT_ID: '42',
      ROOM_CONFIG_ENCRYPTION_KEY: 'short-key',
    })

    expect(result.success).toBe(false)
  })
})
