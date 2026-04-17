import { beforeAll, describe, expect, it } from 'bun:test'
import { listProviderPlugins, resetProviderRegistryForTest } from '@chatwork-bot/core'

describe('registerAllProviders', () => {
  beforeAll(async () => {
    resetProviderRegistryForTest()
    const { registerAllProviders } = await import('./register-providers')
    registerAllProviders()
  })

  it('registers at least gemini and openai', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(ids).toContain('gemini')
    expect(ids).toContain('openai')
  })
})
