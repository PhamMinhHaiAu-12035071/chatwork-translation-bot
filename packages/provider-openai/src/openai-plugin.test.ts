import { beforeAll, describe, expect, it, mock } from 'bun:test'
import type { openaiPlugin as openaiPluginType } from './openai-plugin'

let mockOutput: unknown = { sourceLang: 'English', translated: 'Xin chào thế giới' }

const generateTextMock = mock((_config: unknown) =>
  Promise.resolve({ output: mockOutput }),
)

const outputObjectMock = mock((config: unknown) => config)
const openaiMock = mock((_modelId: string) => ({ provider: 'openai', modelId: _modelId }))

void mock.module('ai', () => ({
  generateText: generateTextMock,
  Output: { object: outputObjectMock },
}))

void mock.module('@ai-sdk/openai', () => ({ openai: openaiMock }))

describe('openaiPlugin', () => {
  let openaiPlugin: typeof openaiPluginType

  beforeAll(async () => {
    const mod = await import('./openai-plugin')
    openaiPlugin = mod.openaiPlugin
  })

  it('manifest id is openai', () => {
    expect(openaiPlugin.manifest.id).toBe('openai')
  })

  it('manifest defaultModel is gpt-5.4', () => {
    expect(openaiPlugin.manifest.defaultModel).toBe('gpt-5.4')
  })

  it('manifest supportedModels contains gpt-5.4 and gpt-4o', () => {
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-5.4')
    expect(openaiPlugin.manifest.supportedModels).toContain('gpt-4o')
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
})
