import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { openaiPlugin as openaiPluginType } from './openai-plugin'

let mockOutput: unknown = { sourceLang: 'English', translated: 'Xin chào thế giới' }

const generateTextMock = mock((_config: unknown) => Promise.resolve({ output: mockOutput }))

const outputObjectMock = mock((config: unknown) => config)
const scopedOpenaiClientMock = mock((_modelId: string) => ({
  provider: 'openai',
  modelId: _modelId,
}))
const createOpenAIMock = mock((_options?: unknown) => scopedOpenaiClientMock)
const openaiMock = mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId }))

function createAbortError(message: string): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai', () => ({
  createOpenAI: createOpenAIMock,
  openai: openaiMock,
}))

describe('openaiPlugin', () => {
  let openaiPlugin: typeof openaiPluginType

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  it('manifest id is openai', () => {
    expect(openaiPlugin.manifest.id).toBe('openai')
  })

  it('manifest defaultModel is gpt-5.4-pro', () => {
    expect(openaiPlugin.manifest.defaultModel).toBe('gpt-5.4-pro')
  })

  it('manifest supportedModels contains gpt-5.4 and gpt-4o', () => {
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-5.4')
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o')
  })

  it('uses a 30-minute provider timeout', () => {
    expect(openaiPlugin.manifest.timeoutMs).toBe(1_800_000)
  })

  it('create returns an executor that calls generateText with prompts', async () => {
    mockOutput = { sourceLang: 'English', translated: 'Xin chào thế giới' }
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    const schema = { parse: (d: unknown) => d as { sourceLang: string; translated: string } }
    const result = await executor.execute({ system: 'translate', user: 'Hello World' }, schema)
    expect(result.sourceLang).toBe('English')
    expect(result.translated).toBe('Xin chào thế giới')
  })

  it('passes the modelId through to openai()', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-4o' })
    const schema = { parse: (d: unknown) => d }
    await executor.execute({ system: 'sys', user: 'test' }, schema)
    expect(openaiMock.mock.calls.at(-1)?.[0]).toBe('gpt-4o')
  })

  it('uses a scoped OpenAI client when apiKey is provided in context', async () => {
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4', apiKey: 'room-openai-key' })
    const schema = { parse: (d: unknown) => d }

    await executor.execute({ system: 'sys', user: 'test' }, schema)

    expect(createOpenAIMock).toHaveBeenCalledWith({ apiKey: 'room-openai-key' })
    expect(scopedOpenaiClientMock).toHaveBeenCalledWith('gpt-5.4')
  })

  it('wraps API errors in TranslationError', async () => {
    generateTextMock.mockImplementationOnce(() => Promise.reject(new Error('network error')))
    const { TranslationError } = await import('@chatwork-bot/core')
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    try {
      await executor.execute({ system: 'sys', user: 'test' }, { parse: (d: unknown) => d })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationError)
    }
  })

  it('preserves abort reasons coming from the pipeline signal', async () => {
    const { TranslationError } = await import('@chatwork-bot/core')
    generateTextMock.mockImplementationOnce(() =>
      Promise.reject(createAbortError('The operation was aborted.')),
    )

    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
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

describe('OpenAI resolveThinking', () => {
  let openaiPlugin: typeof openaiPluginType
  const schema = { parse: (x: unknown) => x }

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  function getLastCallArg(): Record<string, unknown> {
    const call = generateTextMock.mock.calls.at(-1)
    if (!call) throw new Error('generateText was not called')
    return call[0] as Record<string, unknown>
  }

  it('adds reasoningEffort for gpt-5.4', async () => {
    mockOutput = { sourceLang: 'Japanese', translated: 'テスト' }
    const executor = openaiPlugin.create({ modelId: 'gpt-5.4' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const lastCall = getLastCallArg()
    expect((lastCall['providerOptions'] as { openai: unknown }).openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('adds reasoningEffort for gpt-5-mini', async () => {
    mockOutput = { sourceLang: 'Japanese', translated: 'テスト' }
    const executor = openaiPlugin.create({ modelId: 'gpt-5-mini' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const lastCall = getLastCallArg()
    expect((lastCall['providerOptions'] as { openai: unknown }).openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('adds reasoningEffort for o4-mini', async () => {
    mockOutput = { sourceLang: 'Japanese', translated: 'テスト' }
    const executor = openaiPlugin.create({ modelId: 'o4-mini' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const lastCall = getLastCallArg()
    expect((lastCall['providerOptions'] as { openai: unknown }).openai).toEqual({
      reasoningEffort: 'medium',
    })
  })

  it('does NOT add providerOptions for gpt-4.1', async () => {
    mockOutput = { sourceLang: 'Japanese', translated: 'テスト' }
    const executor = openaiPlugin.create({ modelId: 'gpt-4.1' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const lastCall = getLastCallArg()
    expect(lastCall['providerOptions']).toBeUndefined()
  })

  it('does NOT add providerOptions for gpt-4o', async () => {
    mockOutput = { sourceLang: 'Japanese', translated: 'テスト' }
    const executor = openaiPlugin.create({ modelId: 'gpt-4o' })
    await executor.execute({ system: 's', user: 'u' }, schema as never)
    const lastCall = getLastCallArg()
    expect(lastCall['providerOptions']).toBeUndefined()
  })
})
