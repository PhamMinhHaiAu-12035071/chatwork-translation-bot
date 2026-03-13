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
      effectiveTimeoutMs: 45_000,
      timeoutSource: 'env',
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
      effectiveTimeoutMs: 1_800_000,
      timeoutSource: 'provider',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('*')
  })

  it('logs the active effective timeout and its source', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'openai',
        supportedModels: ['gpt-5.4'],
        defaultModel: 'gpt-5.4',
        capabilities: { streaming: false },
        timeoutMs: 1_800_000,
        requiredEnvKeys: ['OPENAI_API_KEY'],
      },
      create: () => ({ execute: () => Promise.reject(new Error('noop')) }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      provider: 'openai',
      model: 'gpt-5.4',
      port: 3000,
      nodeEnv: 'development',
      effectiveTimeoutMs: 45_000,
      timeoutSource: 'env',
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('effective pipeline timeout')
    expect(output).toContain('45s')
    expect(output).toContain('source=env')
  })
})
