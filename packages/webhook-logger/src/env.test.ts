import { afterEach, describe, expect, it } from 'bun:test'
import type { Env } from './env'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      void Reflect.deleteProperty(process.env, key)
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
})

describe('webhook-logger env', () => {
  it('parses internal translator settings without CHATWORK_WEBHOOK_SECRET', async () => {
    process.env['INTERNAL_API_SECRET'] = 'internal-secret'
    process.env['TRANSLATOR_URL'] = 'http://localhost:3000'
    delete process.env['CHATWORK_WEBHOOK_SECRET']

    const envModuleUnknown: unknown = await import(
      `${import.meta.dir}/env.ts?${crypto.randomUUID()}`
    )
    const { parseEnv } = envModuleUnknown as { parseEnv: (input: NodeJS.ProcessEnv) => Env }
    const env = parseEnv(process.env)

    expect(env.TRANSLATOR_URL).toBe('http://localhost:3000')
    expect(env.TRANSLATOR_INTERNAL_URL).toBe('http://localhost:3000')
    expect(env.INTERNAL_API_SECRET).toBe('internal-secret')
    expect('CHATWORK_WEBHOOK_SECRET' in env).toBe(false)
  })
})
