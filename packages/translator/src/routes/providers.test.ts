import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { resetProviderRegistryForTest } from '@chatwork-bot/core'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { providersRoute } from './providers'

describe('GET /api/providers', () => {
  beforeAll(() => {
    resetProviderRegistryForTest()
    registerAllProviders()
  })

  afterAll(() => {
    resetProviderRegistryForTest()
  })

  it('returns dashboard-safe providers with models and excludes cursor', async () => {
    const app = new Elysia().use(providersRoute)
    const response = await app.handle(new Request('http://localhost/api/providers'))

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      providers: {
        id: string
        name: string
        models: string[]
        defaultModel: string
      }[]
    }

    expect(body.providers.length).toBeGreaterThan(0)
    expect(body.providers[0]).toHaveProperty('id')
    expect(body.providers[0]).toHaveProperty('name')
    expect(body.providers[0]).toHaveProperty('models')
    expect(body.providers[0]).toHaveProperty('defaultModel')
    expect(body.providers.map((provider) => provider.id)).toContain('openai')
    expect(body.providers.map((provider) => provider.id)).toContain('gemini')
    expect(body.providers.map((provider) => provider.id)).not.toContain('cursor')
  })
})
