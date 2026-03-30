import { DEFAULT_TRANSLATION_STYLE, TranslationError } from '@chatwork-bot/core'
import type { ILLMExecutor } from '@chatwork-bot/core'
import type { ISchema, PromptPair } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import type { TranslationStyle } from '@chatwork-bot/core'
import {
  buildSingleCallPrompts,
  buildStructuredTranslationPrompts,
  StructuredTranslationDraftSchema,
  TranslationDraftSchema,
} from '@chatwork-bot/translation-prompt'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  phaseObserver?: {
    onPhaseStarted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseCompleted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseFailed?: (params: { phase: 'translation'; error: unknown }) => Promise<void> | void
  }
}

export const DEFAULT_TIMEOUT_MS = DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS

export interface StructuredPipelineInput {
  cleanText: string
  translationInputs: string[]
}

export interface PipelineTranslationResult {
  translation: TranslationResult
  translatedSegments: string[]
  debug?: {
    prompts: PromptPair
    promptMode: 'single_text' | 'structured_segments'
  }
}

interface AutoSegmentedText {
  segments: string[]
  separators: string[]
}

function isHeadingLine(line: string): boolean {
  return /^\s*\d+\.\s/.test(line) || /^\s*[^:\n]{1,120}:\s*$/.test(line)
}

function splitParagraphByHeadings(paragraph: string): AutoSegmentedText {
  const lines = paragraph.split('\n')
  const segments: string[] = []
  const separators: string[] = []
  let currentLines: string[] = []

  for (const line of lines) {
    if (currentLines.length > 0 && isHeadingLine(line)) {
      segments.push(currentLines.join('\n'))
      separators.push('\n')
      currentLines = [line]
      continue
    }

    currentLines.push(line)
  }

  if (currentLines.length > 0) {
    segments.push(currentLines.join('\n'))
  }

  return { segments, separators }
}

function autoSegmentNaturalCasualText(text: string): AutoSegmentedText | null {
  if (!text.includes('\n')) return null

  const paragraphTokens = text.split(/(\n{2,})/)
  const segments: string[] = []
  const separators: string[] = []
  let pendingSeparator = ''

  for (const token of paragraphTokens) {
    if (token === '') continue

    if (/^\n{2,}$/.test(token)) {
      pendingSeparator = token
      continue
    }

    const paragraph = splitParagraphByHeadings(token)
    paragraph.segments.forEach((segment, index) => {
      if (segments.length > 0) {
        separators.push(
          index === 0 ? pendingSeparator || '\n' : (paragraph.separators[index - 1] ?? '\n'),
        )
      }
      segments.push(segment)
    })
    pendingSeparator = ''
  }

  if (segments.length < 2) return null

  return { segments, separators }
}

function joinTranslatedSegments(segments: string[], separators: string[]): string {
  if (segments.length === 0) return ''

  let joined = segments[0] ?? ''
  for (let index = 1; index < segments.length; index += 1) {
    joined += `${separators[index - 1] ?? '\n'}${segments[index] ?? ''}`
  }
  return joined
}

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number; translationStyle?: TranslationStyle } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<TranslationResult> {
    const result = await this.runStructured({ cleanText: text, translationInputs: [text] }, options)
    return result.translation
  }

  async runStructured(
    input: StructuredPipelineInput,
    options: PipelineRunOptions = {},
  ): Promise<PipelineTranslationResult> {
    this.checkAbort(options.signal)

    const style = this.opts.translationStyle ?? DEFAULT_TRANSLATION_STYLE

    if (input.translationInputs.length === 0) {
      return {
        translation: this.buildTranslationResult(input.cleanText, '', 'Unknown'),
        translatedSegments: [],
      }
    }

    if (input.translationInputs.length === 1) {
      const [singleInput] = input.translationInputs
      const sourceText = singleInput ?? input.cleanText
      const autoSegmented =
        style === 'NATURAL_CASUAL' ? autoSegmentNaturalCasualText(sourceText) : null

      if (autoSegmented !== null) {
        const prompts = buildStructuredTranslationPrompts(autoSegmented.segments, style)
        const structuredTranslation = await this.executeTranslation(
          prompts,
          StructuredTranslationDraftSchema,
          options,
        )

        if (structuredTranslation.translatedSegments.length !== autoSegmented.segments.length) {
          throw new TranslationError('Translation segment count mismatch', 'INVALID_RESPONSE')
        }

        const joinedTranslation = joinTranslatedSegments(
          structuredTranslation.translatedSegments,
          autoSegmented.separators,
        )

        return {
          translation: this.buildTranslationResult(
            input.cleanText,
            joinedTranslation,
            structuredTranslation.sourceLang,
          ),
          translatedSegments: [joinedTranslation],
          debug: {
            prompts,
            promptMode: 'structured_segments',
          },
        }
      }

      const prompts = buildSingleCallPrompts(sourceText, style)

      const translation = await this.executeTranslation(prompts, TranslationDraftSchema, options)

      return {
        translation: this.buildTranslationResult(
          input.cleanText,
          translation.translated,
          translation.sourceLang,
        ),
        translatedSegments: [translation.translated],
        debug: {
          prompts,
          promptMode: 'single_text',
        },
      }
    }

    const prompts = buildStructuredTranslationPrompts(input.translationInputs, style)
    const structuredTranslation = await this.executeTranslation(
      prompts,
      StructuredTranslationDraftSchema,
      options,
    )

    if (structuredTranslation.translatedSegments.length !== input.translationInputs.length) {
      throw new TranslationError('Translation segment count mismatch', 'INVALID_RESPONSE')
    }

    return {
      translation: this.buildTranslationResult(
        input.cleanText,
        structuredTranslation.translatedSegments.join('\n'),
        structuredTranslation.sourceLang,
      ),
      translatedSegments: structuredTranslation.translatedSegments,
      debug: {
        prompts,
        promptMode: 'structured_segments',
      },
    }
  }

  private buildSignal(options: PipelineRunOptions): AbortSignal {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
    const upstreamSignal = options.signal
    const timer = setTimeout(() => {
      timeoutController.abort(
        new TranslationError(
          `Translation pipeline timed out after ${timeoutMs.toString()}ms`,
          'TIMEOUT',
        ),
      )
    }, timeoutMs)

    if (typeof timer.unref === 'function') timer.unref()
    timeoutController.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
      },
      { once: true },
    )

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        timeoutController.abort(this.toAbortReason(upstreamSignal.reason))
      } else {
        upstreamSignal.addEventListener(
          'abort',
          () => {
            timeoutController.abort(this.toAbortReason(upstreamSignal.reason))
          },
          { once: true },
        )
      }
    }
    return timeoutController.signal
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      if (signal.reason instanceof TranslationError) throw signal.reason
      throw new TranslationError('Translation pipeline aborted', 'ABORTED', signal.reason)
    }
  }

  private toAbortReason(reason: unknown): TranslationError {
    if (reason instanceof TranslationError) return reason
    return new TranslationError('Translation pipeline aborted', 'ABORTED', reason)
  }

  private async executeTranslation<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options: PipelineRunOptions,
  ): Promise<T> {
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const phase = 'translation' as const
    const phaseParams = { phase }

    await options.phaseObserver?.onPhaseStarted?.(phaseParams)

    try {
      const draft = await this.executor.execute(prompts, schema, { signal })
      await options.phaseObserver?.onPhaseCompleted?.(phaseParams)
      return draft
    } catch (error) {
      await options.phaseObserver?.onPhaseFailed?.({ ...phaseParams, error })
      throw error
    }
  }

  private buildTranslationResult(
    cleanText: string,
    translatedText: string,
    sourceLang: string,
  ): TranslationResult {
    return {
      cleanText,
      translatedText,
      sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }
}
