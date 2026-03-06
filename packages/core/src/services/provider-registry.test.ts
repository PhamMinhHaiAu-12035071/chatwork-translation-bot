import { beforeEach, describe, expect, it } from 'bun:test'
import {
  registerProviderPlugin,
  getProviderPlugin,
  listProviderPlugins,
  resetProviderRegistryForTest,
  ProviderRegistryBootError,
} from './provider-registry'
import type { ProviderPlugin } from '~/interfaces/provider-plugin'

function makePlugin(id: string): ProviderPlugin {
  return {
    manifest: {
      id,
      supportedModels: ['model-x'] as const,
      defaultModel: 'model-x',
      capabilities: { streaming: false },
    },
    create: () => ({ translate: () => Promise.reject(new Error('not implemented')) }),
  }
}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    resetProviderRegistryForTest()
  })

  it('registers a plugin and resolves it by id', () => {
    const plugin = makePlugin('test')
    registerProviderPlugin(plugin)
    expect(getProviderPlugin('test')).toBe(plugin)
  })

  it('throws ProviderRegistryBootError on duplicate registration', () => {
    registerProviderPlugin(makePlugin('dupe'))
    expect(() => {
      registerProviderPlugin(makePlugin('dupe'))
    }).toThrow(ProviderRegistryBootError)
    expect(() => {
      registerProviderPlugin(makePlugin('dupe'))
    }).toThrow(/already registered/)
  })

  it('throws ProviderRegistryBootError when provider not found', () => {
    registerProviderPlugin(makePlugin('gemini'))
    expect(() => getProviderPlugin('cursor')).toThrow(ProviderRegistryBootError)
    expect(() => getProviderPlugin('cursor')).toThrow(/cursor/)
  })

  it('error message lists registered providers when provider not found', () => {
    registerProviderPlugin(makePlugin('gemini'))
    registerProviderPlugin(makePlugin('openai'))
    expect(() => getProviderPlugin('missing')).toThrow(/gemini/)
  })

  it('lists all registered providers', () => {
    registerProviderPlugin(makePlugin('gemini'))
    registerProviderPlugin(makePlugin('openai'))
    const list = listProviderPlugins()
    expect(list).toHaveLength(2)
    expect(list.map((p) => p.manifest.id)).toContain('gemini')
    expect(list.map((p) => p.manifest.id)).toContain('openai')
  })

  it('resetProviderRegistryForTest clears all providers', () => {
    registerProviderPlugin(makePlugin('x'))
    resetProviderRegistryForTest()
    expect(listProviderPlugins()).toHaveLength(0)
  })
})
