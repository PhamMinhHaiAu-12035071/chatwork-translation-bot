import { beforeAll, describe, expect, it } from 'bun:test'
import { listProviderPlugins, resetProviderRegistryForTest } from '@chatwork-bot/core'

describe('registerAllProviders', () => {
  beforeAll(async () => {
    resetProviderRegistryForTest()
    const { registerAllProviders } = await import('./register-providers')
    registerAllProviders()
  })

  it('registers exactly 2 providers', () => {
    expect(listProviderPlugins()).toHaveLength(2)
  })

  it('registers gemini provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('gemini')
  })

  it('registers openai provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('openai')
  })
})
