import { KagiClientError } from '@chatwork-bot/provider-kagi'
import type { KagiClient } from '@chatwork-bot/provider-kagi'
import type { FreeRoomKagiStyle } from '~/types/free-room-config'
import type {
  RoomTranslationBackend,
  RoomTranslationBackendInput,
  RoomTranslationBackendResult,
} from './translation-backend'
import { KagiSegmentCodecError, decodeKagiSegments, encodeKagiSegments } from './kagi-segment-codec'

export interface FreeTranslationRuntimeConfig {
  kagiStyle: FreeRoomKagiStyle
  context?: string | null
  maxEncodedPayloadChars?: number
  maxSegmentCount?: number
}

interface FreeTranslationBackendDeps {
  client: Pick<KagiClient, 'translate'>
  generateToken?: () => string
  defaultMaxEncodedPayloadChars?: number
  defaultMaxSegmentCount?: number
}

export class FreeTranslationBackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'FreeTranslationBackendError'
  }
}

export class FreeTranslationBackend implements RoomTranslationBackend<FreeTranslationRuntimeConfig> {
  readonly kind = 'free' as const
  private readonly client: Pick<KagiClient, 'translate'>
  private readonly generateToken: (() => string) | undefined
  private readonly defaultMaxEncodedPayloadChars: number
  private readonly defaultMaxSegmentCount: number

  constructor(deps: FreeTranslationBackendDeps) {
    this.client = deps.client
    this.generateToken = deps.generateToken
    this.defaultMaxEncodedPayloadChars = deps.defaultMaxEncodedPayloadChars ?? 12_000
    this.defaultMaxSegmentCount = deps.defaultMaxSegmentCount ?? 50
  }

  async translate(
    input: RoomTranslationBackendInput<FreeTranslationRuntimeConfig>,
  ): Promise<RoomTranslationBackendResult> {
    if (input.translationInputs.length === 0) {
      return {
        sourceLang: 'auto',
        translatedText: '',
        translatedSegments: [],
      }
    }

    const maxEncodedPayloadChars =
      input.runtimeConfig.maxEncodedPayloadChars ?? this.defaultMaxEncodedPayloadChars
    const maxSegmentCount = input.runtimeConfig.maxSegmentCount ?? this.defaultMaxSegmentCount

    if (input.translationInputs.length > maxSegmentCount) {
      throw new FreeTranslationBackendError(
        'SEGMENT_COUNT_OVERFLOW',
        `Segment count ${input.translationInputs.length.toString()} exceeds configured maximum`,
      )
    }

    if (input.translationInputs.length === 1) {
      const [singleInput] = input.translationInputs
      const sourceText = singleInput ?? input.cleanText

      if (Array.from(sourceText).length > maxEncodedPayloadChars) {
        throw new FreeTranslationBackendError(
          'PAYLOAD_TOO_LARGE',
          'Kagi single-segment payload exceeds configured size limit',
        )
      }

      const translatedText = await this.translateRawText(sourceText, input.runtimeConfig)

      return {
        sourceLang: 'auto',
        translatedText,
        translatedSegments: [translatedText],
      }
    }

    let encoded: { encodedText: string; messageToken: string }
    try {
      const options = {
        ...(this.generateToken !== undefined ? { generateToken: this.generateToken } : {}),
        maxEncodedPayloadChars,
        maxSegmentCount,
      }
      encoded = encodeKagiSegments(input.translationInputs, options)
    } catch (error) {
      if (error instanceof KagiSegmentCodecError) {
        throw new FreeTranslationBackendError(error.code, error.message, { cause: error })
      }

      throw error
    }

    let translatedPayload: string
    try {
      const response = await this.client.translate({
        text: encoded.encodedText,
        style: input.runtimeConfig.kagiStyle,
        ...(input.runtimeConfig.context !== null &&
        input.runtimeConfig.context !== undefined &&
        input.runtimeConfig.context.trim() !== ''
          ? { context: input.runtimeConfig.context.trim() }
          : {}),
      })
      translatedPayload = response.translated
    } catch (error) {
      if (error instanceof KagiClientError) {
        throw new FreeTranslationBackendError(error.code, error.message, { cause: error })
      }

      throw new FreeTranslationBackendError(
        'KAGI_TRANSLATE_FAILED',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }

    try {
      const translatedSegments = decodeKagiSegments(translatedPayload, {
        messageToken: encoded.messageToken,
        expectedSegmentCount: input.translationInputs.length,
      })

      return {
        sourceLang: 'auto',
        translatedText: translatedSegments.join('\n'),
        translatedSegments,
      }
    } catch (error) {
      if (error instanceof KagiSegmentCodecError) {
        throw new FreeTranslationBackendError(error.code, error.message, { cause: error })
      }

      throw error
    }
  }

  private async translateRawText(
    text: string,
    runtimeConfig: FreeTranslationRuntimeConfig,
  ): Promise<string> {
    try {
      const response = await this.client.translate({
        text,
        style: runtimeConfig.kagiStyle,
        ...(runtimeConfig.context !== null &&
        runtimeConfig.context !== undefined &&
        runtimeConfig.context.trim() !== ''
          ? { context: runtimeConfig.context.trim() }
          : {}),
      })

      return response.translated
    } catch (error) {
      if (error instanceof KagiClientError) {
        throw new FreeTranslationBackendError(error.code, error.message, { cause: error })
      }

      throw new FreeTranslationBackendError(
        'KAGI_TRANSLATE_FAILED',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }
}
