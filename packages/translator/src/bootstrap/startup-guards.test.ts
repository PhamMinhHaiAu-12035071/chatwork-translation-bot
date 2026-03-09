import { beforeEach, describe, expect, it, mock } from 'bun:test'

const mockFetch = mock((_url: string) => Promise.resolve({ ok: true }))
// @ts-expect-error — override global fetch for testing
global.fetch = mockFetch

// Module-level registry — closed over by mock functions so reassignment is visible
let _plugins: {
  manifest: {
    id: string
    supportedModels: readonly string[]
    defaultModel: string
    capabilities: { readonly streaming: boolean }
    requiredEnvKeys: readonly string[]
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
    mockFetch.mockReset()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))
    _plugins = []
  })

  it('passes without error when gemini provider is registered', async () => {
    _plugins.push({
      manifest: {
        id: 'gemini',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }
    await runStartupGuards(fakeEnv as never)
  })

  it('throws ProviderRegistryBootError when provider not registered', async () => {
    // _plugins is empty after beforeEach reset
    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }

    try {
      await runStartupGuards(fakeEnv as never)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderRegistryBootError)
    }
  })

  it('checks cursor proxy reachability when provider is cursor', async () => {
    _plugins.push({
      manifest: {
        id: 'cursor',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'cursor', CURSOR_API_URL: 'http://localhost:8765/v1' }
    await runStartupGuards(fakeEnv as never)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8765/v1/models')
  })

  it('warns (does not throw) when cursor proxy is unreachable', async () => {
    _plugins.push({
      manifest: {
        id: 'cursor',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    mockFetch.mockImplementation(() => Promise.reject(new Error('network error')))

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warnSpy = mock((_msg: string) => {})
    console.warn = warnSpy

    const previousCursorApiUrl = process.env['CURSOR_API_URL']
    process.env['CURSOR_API_URL'] = 'http://cursor-proxy:8765/v1'

    try {
      const { runStartupGuards } = await import('./startup-guards')
      const fakeEnv = { AI_PROVIDER: 'cursor' }
      // Should NOT throw — just warn so translator starts even if proxy isn't ready yet
      await runStartupGuards(fakeEnv as never)

      expect(warnSpy).toHaveBeenCalled()
      const msg = warnSpy.mock.calls[0]?.[0] ?? ''
      expect(msg).toContain('Cursor proxy not reachable at http://cursor-proxy:8765/v1')
      expect(msg).toContain('bun run dev')
    } finally {
      if (previousCursorApiUrl === undefined) {
        delete process.env['CURSOR_API_URL']
      } else {
        process.env['CURSOR_API_URL'] = previousCursorApiUrl
      }
    }
  })

  it('throws when required env key is missing for active provider', async () => {
    // Use a unique key that definitely won't be set in any test environment
    const uniqueRequiredKey = '__TEST_REQUIRED_KEY_THAT_WILL_NEVER_EXIST_IN_ENV__'
    _plugins.push({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: [uniqueRequiredKey],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }

    try {
      await runStartupGuards(fakeEnv as never)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderRegistryBootError)
      expect((error as Error).message).toContain(uniqueRequiredKey)
    }
  })

  it('logs warning when AI_MODEL is not in supportedModels (escape hatch)', async () => {
    _plugins.push({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warnSpy = mock((_msg: string) => {})
    console.warn = warnSpy

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini', AI_MODEL: 'custom-model-xyz' }
    await runStartupGuards(fakeEnv as never)

    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls[0]?.[0] ?? ''
    expect(msg).toContain('custom-model-xyz')
    expect(msg).toContain('gemini-2.5-pro')
  })
})
