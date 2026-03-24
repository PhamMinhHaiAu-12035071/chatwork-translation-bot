import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { geminiPlugin as geminiPluginType } from './gemini-plugin'

let mockOutput: unknown = { sourceLang: 'English', translated: 'Xin chào thế giới' }
let lastGenerateTextCall: Record<string, unknown> = {}

const generateTextMock = mock((config: unknown) => {
  lastGenerateTextCall = config as Record<string, unknown>
  return Promise.resolve({ output: mockOutput })
})

const outputObjectMock = mock((config: unknown) => config)
const googleMock = mock((_modelId: string) => ({ provider: 'google', modelId: _modelId }))

function createAbortError(message: string): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/google', () => ({ google: googleMock }))

describe('geminiPlugin', () => {
  let geminiPlugin: typeof geminiPluginType

  beforeAll(async () => {
    const mod = await import('./gemini-plugin')
    geminiPlugin = mod.geminiPlugin
  })

  it('manifest id is gemini', () => {
    expect(geminiPlugin.manifest.id).toBe('gemini')
  })

  it('manifest defaultModel is gemini-2.5-pro', () => {
    expect(geminiPlugin.manifest.defaultModel).toBe('gemini-2.5-pro')
  })

  it('manifest supportedModels contains gemini-2.5-pro and gemini-2.0-flash', () => {
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.5-pro')
    expect(geminiPlugin.manifest.supportedModels).toContain('gemini-2.0-flash')
  })

  it('uses a 30-minute provider timeout', () => {
    expect(geminiPlugin.manifest.timeoutMs).toBe(1_800_000)
  })

  it('create returns an executor that calls generateText with prompts', async () => {
    mockOutput = { sourceLang: 'English', translated: 'Xin chào thế giới' }
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const schema = { parse: (d: unknown) => d as { sourceLang: string; translated: string } }
    const result = await executor.execute({ system: 'translate', user: 'Hello World' }, schema)
    expect(result.sourceLang).toBe('English')
    expect(result.translated).toBe('Xin chào thế giới')
  })

  it('passes the modelId through to google()', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    const schema = { parse: (d: unknown) => d }
    await executor.execute({ system: 'sys', user: 'test' }, schema)
    expect(googleMock.mock.calls.at(-1)?.[0]).toBe('gemini-2.0-flash')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    try {
      await executor.execute({ system: 'sys', user: 'test' }, { parse: (d: unknown) => d })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })

  it('preserves timeout abort reasons coming from the pipeline signal', async () => {
    const { TranslationError } = await import('@chatwork-bot/core')
    generateTextMock.mockImplementationOnce(() =>
      Promise.reject(createAbortError('The operation was aborted.')),
    )

    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    const controller = new AbortController()
    controller.abort(new TranslationError('Translation pipeline timed out after 5ms', 'TIMEOUT'))

    try {
      await executor.execute(
        { system: 'sys', user: 'test' },
        { parse: (d: unknown) => d },
        { signal: controller.signal },
      )
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
      expect((error as InstanceType<typeof TranslationError>).code).toBe('TIMEOUT')
    }
  })
})

describe('Gemini resolveThinking', () => {
  let geminiPlugin: typeof geminiPluginType

  beforeAll(async () => {
    const mod = await import('./gemini-plugin')
    geminiPlugin = mod.geminiPlugin
  })

  const schema = { parse: (x: unknown) => x }

  it('adds thinkingBudget for gemini-2.5-pro', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-pro' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall['providerOptions'] as { google?: { thinkingConfig?: unknown } }
    expect(po.google?.thinkingConfig).toEqual({ thinkingBudget: 8192 })
  })

  it('adds thinkingBudget for gemini-2.5-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.5-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall['providerOptions'] as { google?: { thinkingConfig?: unknown } }
    expect(po.google?.thinkingConfig).toEqual({ thinkingBudget: 8192 })
  })

  it('adds thinkingLevel for gemini-3-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall['providerOptions'] as { google?: { thinkingConfig?: unknown } }
    expect(po.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('adds thinkingLevel for gemini-3-pro-preview', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3-pro-preview' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall['providerOptions'] as { google?: { thinkingConfig?: unknown } }
    expect(po.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('adds thinkingLevel for gemini-3.1-pro-preview', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-3.1-pro-preview' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const po = lastGenerateTextCall['providerOptions'] as { google?: { thinkingConfig?: unknown } }
    expect(po.google?.thinkingConfig).toEqual({ thinkingLevel: 'medium' })
  })

  it('does NOT add providerOptions for gemini-2.0-flash', async () => {
    const executor = geminiPlugin.create({ modelId: 'gemini-2.0-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect(lastGenerateTextCall['providerOptions']).toBeUndefined()
  })

  it('does NOT add providerOptions for gemini-30-flash (not a gemini-3.x)', async () => {
    // gemini-30-flash: char after "3" is "0", not "." or "-" → should NOT match
    const executor = geminiPlugin.create({ modelId: 'gemini-30-flash' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    expect(lastGenerateTextCall['providerOptions']).toBeUndefined()
  })
})
