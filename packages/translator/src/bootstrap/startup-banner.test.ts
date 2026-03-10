import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { resetProviderRegistryForTest, registerProviderPlugin } from '@chatwork-bot/core'

describe('logStartupBanner', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const logSpy = mock((..._args: unknown[]) => {})
  const originalLog = console.log

  beforeEach(() => {
    resetProviderRegistryForTest()
    logSpy.mockReset()
    console.log = logSpy
  })

  afterEach(() => {
    console.log = originalLog
  })

  it('logs table with provider info', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro', 'gemini-2.0-flash'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: ['GOOGLE_GENERATIVE_AI_API_KEY'],
      },
      create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      port: 3000,
      nodeEnv: 'development',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('gemini')
    expect(output).toContain('gemini-2.5-pro')
    expect(output).toContain('gemini-2.0-flash')
  })

  it('marks active provider with asterisk', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
        requiredEnvKeys: [],
      },
      create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      port: 3000,
      nodeEnv: 'development',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('*')
  })
})
