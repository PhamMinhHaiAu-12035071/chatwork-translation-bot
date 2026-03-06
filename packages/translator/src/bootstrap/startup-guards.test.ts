import { beforeEach, describe, expect, it, mock } from 'bun:test'

const mockFetch = mock((_url: string) => Promise.resolve({ ok: true }))
// @ts-expect-error — override global fetch for testing
global.fetch = mockFetch

describe('runStartupGuards', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(() => Promise.resolve({ ok: true }))
  })

  it('passes without error when gemini provider is registered', async () => {
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    const fakeEnv = { AI_PROVIDER: 'gemini' }
    await runStartupGuards(fakeEnv as never)
  })

  it('throws ProviderRegistryBootError when provider not registered', async () => {
    const { resetProviderRegistryForTest, ProviderRegistryBootError } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()

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
    const { resetProviderRegistryForTest, registerProviderPlugin } =
      await import('@chatwork-bot/core')
    resetProviderRegistryForTest()
    registerProviderPlugin({
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
    const fakeEnv = { AI_PROVIDER: 'cursor', CURSOR_API_URL: 'http://localhost:8765' }
    await runStartupGuards(fakeEnv as never)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8765/v1/models')
  })
})
