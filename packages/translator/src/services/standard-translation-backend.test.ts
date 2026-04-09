import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILLMExecutor, ISchema, PromptPair, ProviderPlugin } from '@chatwork-bot/core'
import type { RoomConfig } from '~/types/room-config'

const mockPipelineConstructor = mock((_executor: unknown, _opts: unknown) => undefined)
const mockRunStructured = mock((_input: unknown, _options: unknown) =>
  Promise.resolve({
    translation: {
      cleanText: 'Hello\nBye',
      translatedText: 'Xin chao\nTam biet',
      sourceLang: 'English',
      targetLang: 'Vietnamese',
      timestamp: '2026-04-01T00:00:00.000Z',
    },
    translatedSegments: ['Xin chao', 'Tam biet'],
    debug: {
      prompts: {
        system: 'system prompt',
        user: 'user prompt',
      },
      promptMode: 'structured_segments' as const,
    },
  }),
)

describe('StandardTranslationBackend', () => {
  let StandardTranslationBackend:
    | (new (deps: {
        decryptApiToken: (encryptedAiApiToken: string) => Promise<string>
        resolveProviderPlugin?: (providerId: string) => ProviderPlugin
        createPipeline?: (
          executor: ILLMExecutor,
          options: {
            timeoutMs: number
            translationStyle: RoomConfig['translationStyle']
            roomContext?: string
            keywordSystemHint?: string
            mentionHint?: string
          },
        ) => {
          runStructured(input: unknown, options: unknown): Promise<unknown>
        }
      }) => {
        translate(input: {
          cleanText: string
          translationInputs: string[]
          roomContext?: string
          keywordSystemHint?: string
          mentionHint?: string
          runtimeConfig: {
            roomConfig: RoomConfig
            timeoutMs: number
          }
        }): Promise<{
          sourceLang: string
          translatedText: string
          translatedSegments: string[]
        }>
      })
    | null = null

  beforeAll(async () => {
    const backendModule = (await import(
      `./standard-translation-backend?test=${crypto.randomUUID()}`
    )) as {
      StandardTranslationBackend: NonNullable<typeof StandardTranslationBackend>
    }

    StandardTranslationBackend = backendModule.StandardTranslationBackend
  })

  beforeEach(() => {
    mockPipelineConstructor.mockClear()
    mockRunStructured.mockClear()
  })

  it('resolves provider plugin, decrypts the token, and passes runtime options into the pipeline', async () => {
    if (StandardTranslationBackend === null) {
      throw new Error('StandardTranslationBackend not initialized')
    }

    const decryptApiToken = mock((_encrypted: string) => Promise.resolve('room-openai-token'))
    const mockExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>): Promise<T> {
        return Promise.resolve({} as T)
      },
      describeExecution: () => ({
        generation: {
          temperature: 0,
          maxOutputTokens: 4000,
          providerOptions: null,
          providerManaged: false,
        },
      }),
    } satisfies ILLMExecutor
    const pluginCreate = mock((_ctx: unknown) => mockExecutor)
    const mockGetProviderPlugin = mock(
      (_providerId: string) =>
        ({
          manifest: {
            id: 'openai',
            defaultModel: 'gpt-4o',
            supportedModels: ['gpt-4o', 'gpt-5.4'],
            capabilities: { streaming: false },
            timeoutMs: 1_800_000,
          },
          create: pluginCreate,
        }) satisfies ProviderPlugin,
    )
    const createPipeline = (executor: ILLMExecutor, opts: unknown) => {
      mockPipelineConstructor(executor, opts)

      return {
        runStructured: (input: unknown, options: unknown) => mockRunStructured(input, options),
      }
    }

    const backend = new StandardTranslationBackend({
      decryptApiToken,
      resolveProviderPlugin: mockGetProviderPlugin,
      createPipeline,
    })
    const roomConfig: RoomConfig = {
      id: 'room-1',
      originalRoomId: 1001,
      originalRoomName: 'Test Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: 'gpt-5.4',
      translationStyle: 'TECHNICAL',
      context: null,
      encryptedAiApiToken: 'encrypted-token',
      enabled: true,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    }

    const result = await backend.translate({
      cleanText: 'Hello\nBye',
      translationInputs: ['Hello', 'Bye'],
      roomContext: 'project room',
      keywordSystemHint: 'Preserve [COMPANY_1]',
      runtimeConfig: {
        roomConfig,
        timeoutMs: 12_345,
      },
    })

    expect(decryptApiToken.mock.calls).toEqual([['encrypted-token']])
    expect(mockGetProviderPlugin.mock.calls).toEqual([['openai']])
    expect(pluginCreate.mock.calls[0]?.[0]).toMatchObject({
      modelId: 'gpt-5.4',
      apiKey: 'room-openai-token',
      translationStyle: 'TECHNICAL',
    })
    expect(mockPipelineConstructor.mock.calls[0]?.[1]).toMatchObject({
      timeoutMs: 12_345,
      translationStyle: 'TECHNICAL',
      roomContext: 'project room',
      keywordSystemHint: 'Preserve [COMPANY_1]',
    })
    expect(mockRunStructured.mock.calls[0]?.[0]).toEqual({
      cleanText: 'Hello\nBye',
      translationInputs: ['Hello', 'Bye'],
    })
    expect(result).toMatchObject({
      sourceLang: 'English',
      translatedText: 'Xin chao\nTam biet',
      translatedSegments: ['Xin chao', 'Tam biet'],
    })
  })

  it('forwards mentionHint to pipeline options', async () => {
    if (StandardTranslationBackend === null) {
      throw new Error('StandardTranslationBackend not initialized')
    }

    const decryptApiToken = mock((_encrypted: string) => Promise.resolve('token'))
    const mockExecutor = {
      execute<T>(_prompts: PromptPair, _schema: ISchema<T>): Promise<T> {
        return Promise.resolve({} as T)
      },
      describeExecution: () => ({
        generation: {
          temperature: 0,
          maxOutputTokens: 4000,
          providerOptions: null,
          providerManaged: false,
        },
      }),
    } satisfies ILLMExecutor
    const pluginCreate = mock((_ctx: unknown) => mockExecutor)
    const mockGetProviderPlugin = mock(
      (_providerId: string) =>
        ({
          manifest: {
            id: 'openai',
            defaultModel: 'gpt-4o',
            supportedModels: ['gpt-4o'],
            capabilities: { streaming: false },
            timeoutMs: 1_800_000,
          },
          create: pluginCreate,
        }) satisfies ProviderPlugin,
    )
    const createPipeline = (executor: ILLMExecutor, opts: unknown) => {
      mockPipelineConstructor(executor, opts)
      return {
        runStructured: (input: unknown, options: unknown) => mockRunStructured(input, options),
      }
    }

    const backend = new StandardTranslationBackend({
      decryptApiToken,
      resolveProviderPlugin: mockGetProviderPlugin,
      createPipeline,
    })
    const roomConfig: RoomConfig = {
      id: 'room-1',
      originalRoomId: 1001,
      originalRoomName: 'Test Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'NATURAL_CASUAL',
      context: null,
      encryptedAiApiToken: 'encrypted-token',
      enabled: true,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    }

    await backend.translate({
      cleanText: 'Hello',
      translationInputs: ['Hello'],
      mentionHint: 'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
      runtimeConfig: { roomConfig, timeoutMs: 10_000 },
    })

    expect(mockPipelineConstructor.mock.calls[0]?.[1]).toMatchObject({
      mentionHint: 'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
    })
  })
})
