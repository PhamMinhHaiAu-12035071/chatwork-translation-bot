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

  it('checks cursor proxy reachability when cursor provider is registered', async () => {
    _plugins.push({
      manifest: {
        id: 'cursor',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))

    const { runStartupGuards } = await import('./startup-guards')
    await runStartupGuards()
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8765/v1/models')
  })

  it('warns (does not throw) when cursor proxy is unreachable', async () => {
    _plugins.push({
      manifest: {
        id: 'cursor',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
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
      // Should NOT throw — just warn so translator starts even if proxy isn't ready yet
      await runStartupGuards()

      expect(warnSpy).toHaveBeenCalled()
      const msg = warnSpy.mock.calls[0]?.[0] ?? ''
      expect(msg).toContain('Cursor proxy not reachable at http://cursor-proxy:8765/v1')
      expect(msg).toContain('Per-room configs using cursor provider will fail at runtime')
    } finally {
      if (previousCursorApiUrl === undefined) {
        delete process.env['CURSOR_API_URL']
      } else {
        process.env['CURSOR_API_URL'] = previousCursorApiUrl
      }
    }
  })
})
