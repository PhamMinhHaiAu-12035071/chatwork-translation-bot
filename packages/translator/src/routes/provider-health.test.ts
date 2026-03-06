import { beforeAll, describe, expect, it } from 'bun:test'

describe('GET /health/provider', () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeAll(async () => {
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'] as readonly string[],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { providerHealthRoute } = await import('./provider-health')
    const { Elysia } = await import('elysia')
    app = new Elysia().use(providerHealthRoute)
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
})
