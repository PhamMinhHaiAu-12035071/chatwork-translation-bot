import { beforeEach, describe, expect, it, mock } from 'bun:test'

// Module-level registry — closed over by mock functions so reassignment is visible
let _plugins: {
  manifest: {
    id: string
    supportedModels: readonly string[]
    defaultModel: string
    capabilities: { readonly streaming: boolean }
  }
  create: () => { translate: () => Promise<never> }
}[] = []

class ProviderRegistryBootError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRegistryBootError'
  }
}

// Use mock.module at top level so startup-guards.ts static imports resolve to this mock.
// Without this, router.test.ts / handler.test.ts mocks pollute the shared module cache
// and cause instanceof checks + registry state to use different instances.
void mock.module('@chatwork-bot/core', () => ({
  listProviderPlugins: () => _plugins,
  getProviderPlugin: (id: string) => {
    const plugin = _plugins.find((p) => p.manifest.id === id)
    if (!plugin) throw new ProviderRegistryBootError(`Provider '${id}' not found`)
    return plugin
  },
  registerProviderPlugin: (plugin: (typeof _plugins)[number]) => {
    _plugins.push(plugin)
  },
  resetProviderRegistryForTest: () => {
    _plugins = []
  },
  ProviderRegistryBootError,
}))

describe('runStartupGuards', () => {
  beforeEach(() => {
    _plugins = []
  })

  it('passes without error when at least one provider is registered', async () => {
    _plugins.push({
      manifest: {
        id: 'gemini',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    await runStartupGuards()
  })

  it('throws when no providers are registered', async () => {
    // _plugins is empty after beforeEach reset
    const { runStartupGuards } = await import('./startup-guards')

    try {
      await runStartupGuards()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('No providers registered')
    }
  })
})
