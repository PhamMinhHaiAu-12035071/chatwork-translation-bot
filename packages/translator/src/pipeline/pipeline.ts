import type { ILLMExecutor } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import { buildSingleCallPrompts, TranslationDraftSchema } from '@chatwork-bot/translation-prompt'
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

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<TranslationResult> {
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const phase = 'translation' as const
    const phaseParams = { phase }

    await options.phaseObserver?.onPhaseStarted?.(phaseParams)

    let draft: { sourceLang: string; translated: string }
    try {
      draft = await this.executor.execute(buildSingleCallPrompts(text), TranslationDraftSchema, {
        signal,
      })
      await options.phaseObserver?.onPhaseCompleted?.(phaseParams)
    } catch (error) {
      await options.phaseObserver?.onPhaseFailed?.({ ...phaseParams, error })
      throw error
    }

    return {
      cleanText: text,
      translatedText: draft.translated,
      sourceLang: draft.sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
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
}
