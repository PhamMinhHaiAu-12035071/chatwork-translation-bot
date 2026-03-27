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
  it('parses TRANSLATOR_URL and applies defaults', async () => {
    process.env['TRANSLATOR_URL'] = 'http://localhost:3000'

    const envModuleUnknown: unknown = await import(
      `${import.meta.dir}/env.ts?${crypto.randomUUID()}`
    )
    const { parseEnv } = envModuleUnknown as { parseEnv: (input: NodeJS.ProcessEnv) => Env }
    const env = parseEnv(process.env)

    expect(env.TRANSLATOR_URL).toBe('http://localhost:3000')
    expect('INTERNAL_API_SECRET' in env).toBe(false)
    expect('TRANSLATOR_INTERNAL_URL' in env).toBe(false)
    expect('CHATWORK_SKIP_SIGNATURE_VERIFY' in env).toBe(false)
  })
})
