import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const originalTimeoutEnv = process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS']

describe('GET /health/provider', () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeAll(async () => {
    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = '9000'
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'] as readonly string[],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        timeoutMs: 1_800_000,
        requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      },
      create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
    })

    const { providerHealthRoute } = await import('./provider-health')
    const { Elysia } = await import('elysia')
    app = new Elysia().use(providerHealthRoute)
  })

  afterAll(() => {
    if (originalTimeoutEnv === undefined) {
      delete process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS']
      return
    }

    process.env['TRANSLATOR_PIPELINE_TIMEOUT_MS'] = originalTimeoutEnv
  })

  it('returns 200 with registered providers', async () => {
    const res = await app.handle(new Request('http://localhost/health/provider'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { providers: string[]; status: string }
    expect(body.providers).toBeDefined()
    expect(Array.isArray(body.providers)).toBe(true)
    expect(body.providers).toContain('gemini')
  })

  it('returns status field', async () => {
    const res = await app.handle(new Request('http://localhost/health/provider'))
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('returns effective timeout details for each provider', async () => {
    const res = await app.handle(new Request('http://localhost/health/provider'))
    const body = (await res.json()) as {
      detail: {
        id: string
        providerDefaultTimeoutMs: number | null
        effectiveTimeoutMs: number
        timeoutSource: string
      }[]
    }

    expect(body.detail[0]).toMatchObject({
      id: 'gemini',
      providerDefaultTimeoutMs: 1_800_000,
      effectiveTimeoutMs: 9_000,
      timeoutSource: 'env',
    })
  })
})
