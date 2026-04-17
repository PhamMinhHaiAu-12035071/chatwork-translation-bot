import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { resetProviderRegistryForTest, registerProviderPlugin } from '@chatwork-bot/core'

describe('logStartupBanner', () => {
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
      },
      create: () => ({
        execute: () => Promise.reject(new Error('noop')),
        describeExecution: () => ({
          generation: {
            temperature: 0,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }),
      }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      port: 3000,
      nodeEnv: 'development',
      effectiveTimeoutMs: 45_000,
      timeoutSource: 'env',
      roomCount: 3,
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('gemini')
    expect(output).toContain('gemini-2.5-pro')
    expect(output).toContain('gemini-2.0-flash')
    expect(output).toContain('configured per-room (3 rooms loaded)')
  })

  it('does not mark an active provider because provider selection is per-room', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'gemini',
        supportedModels: ['gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-pro',
        capabilities: { streaming: false },
      },
      create: () => ({
        execute: () => Promise.reject(new Error('noop')),
        describeExecution: () => ({
          generation: {
            temperature: 0,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }),
      }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      port: 3000,
      nodeEnv: 'development',
      effectiveTimeoutMs: 1_800_000,
      timeoutSource: 'provider',
      roomCount: 1,
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).not.toContain('active provider')
    expect(output).toContain('configured per-room (1 rooms loaded)')
  })

  it('logs the active effective timeout and its source', async () => {
    registerProviderPlugin({
      manifest: {
        id: 'openai',
        supportedModels: ['gpt-5.4'],
        defaultModel: 'gpt-5.4',
        capabilities: { streaming: false },
        timeoutMs: 1_800_000,
      },
      create: () => ({
        execute: () => Promise.reject(new Error('noop')),
        describeExecution: () => ({
          generation: {
            temperature: 0,
            maxOutputTokens: 4000,
            providerOptions: null,
            providerManaged: false,
          },
        }),
      }),
    })

    const { logStartupBanner } = await import('./startup-banner')
    logStartupBanner({
      port: 3000,
      nodeEnv: 'development',
      effectiveTimeoutMs: 45_000,
      timeoutSource: 'env',
      roomCount: 2,
    })

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('effective pipeline timeout')
    expect(output).toContain('45s')
    expect(output).toContain('source=env')
  })
})
