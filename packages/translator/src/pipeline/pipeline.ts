import type { ILLMExecutor } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import type { TranslationResult } from '@chatwork-bot/core'
import {
  buildAnalysisPrompts,
  buildTranslationPrompts,
  buildReviewPrompts,
  AnalysisSchema,
  TranslationDraftSchema,
  ReviewSchema,
  PipelineTraceSchema,
} from '@chatwork-bot/translation-prompt'
import type { AnalysisResult, ReviewResult, PipelineTrace } from '@chatwork-bot/translation-prompt'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  phaseObserver?: {
    onPhaseStarted?: (params: {
      phase: 'analysis' | 'translation' | 'review'
      round?: number
      escalated: boolean
    }) => Promise<void> | void
    onPhaseCompleted?: (params: {
      phase: 'analysis' | 'translation' | 'review'
      round?: number
      escalated: boolean
    }) => Promise<void> | void
    onPhaseFailed?: (params: {
      phase: 'analysis' | 'translation' | 'review'
      round?: number
      escalated: boolean
      error: unknown
    }) => Promise<void> | void
    onEscalationStarted?: (params: { round: number }) => Promise<void> | void
    onEscalationCompleted?: (params: { round: number }) => Promise<void> | void
  }
}

export interface PipelineRunResult {
  result: TranslationResult
  trace: PipelineTrace
}

const MAX_ROUNDS = 5
const ESCALATION_ROUND = 3
const SHORT_TEXT_THRESHOLD = 5 // grapheme count
export const DEFAULT_TIMEOUT_MS = DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS

const CJK_HIRAGANA = /[\u3040-\u309F]/
const CJK_KATAKANA = /[\u30A0-\u30FF]/
const CJK_KANJI = /[\u4E00-\u9FFF]/
const URL_LIKE = /https?:\/\//
const CODE_LIKE = /[`{}/]|\/\//
const NUMERIC_SLASH_WORD = /\d+\s*\/\s*\w/
const CHATWORK_MARKUP = /\[(?:To:|info|code)/i

function shouldUseFastPath(text: string): boolean {
  if (Array.from(text).length >= SHORT_TEXT_THRESHOLD) return false
  if (CJK_HIRAGANA.test(text)) return false
  if (CJK_KATAKANA.test(text)) return false
  if (CJK_KANJI.test(text)) return false
  if (URL_LIKE.test(text)) return false
  if (CODE_LIKE.test(text)) return false
  if (NUMERIC_SLASH_WORD.test(text)) return false
  if (CHATWORK_MARKUP.test(text)) return false
  return true
}

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    const startMs = Date.now()
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const isShortText = shouldUseFastPath(text)

    // ── Phase 0+1: Analysis (skip for short text) ──────────────────────────
    let analysis: AnalysisResult

    if (isShortText) {
      analysis = this.buildFastPathAnalysis()
    } else {
      this.checkAbort(signal)
      analysis = await this.runObservedPhase(
        'analysis',
        async () => this.executor.execute(buildAnalysisPrompts(text), AnalysisSchema, { signal }),
        options,
      )
    }

    // ── Phase 2: Translation ───────────────────────────────────────────────
    this.checkAbort(signal)
    const draft = await this.runObservedPhase(
      'translation',
      async () =>
        this.executor.execute(buildTranslationPrompts(text, analysis), TranslationDraftSchema, {
          signal,
        }),
      options,
    )

    // Fast path: return immediately for short text (no review loop)
    if (isShortText) {
      const result = this.buildTranslationResult(text, draft.translated, draft.sourceLang)
      const trace = PipelineTraceSchema.parse({
        analysis,
        rounds: [],
        finalScore: 10,
        totalRounds: 0,
        escalated: false,
        durationMs: Date.now() - startMs,
      })
      return { result, trace }
    }

    // ── Phase 3: Review loop ───────────────────────────────────────────────
    const rounds: ReviewResult[] = []
    let currentDraft = draft.translated
    let escalated = false
    // Initialize bestRound with Phase 2 draft so a total failure path never produces empty output
    let bestRound: ReviewResult = { ...makeNullReview(), refinedTranslation: draft.translated }

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      this.checkAbort(signal)

      // Escalation: after ESCALATION_ROUND stuck rounds, switch Skopos + rebuild Phase 2
      if (round === ESCALATION_ROUND + 1 && !escalated && rounds.every((r) => !r.passed)) {
        await options.phaseObserver?.onEscalationStarted?.({ round })
        escalated = true
        const switchedAnalysis = this.switchSkopos(analysis)
        this.checkAbort(signal)
        const rebuiltDraft = await this.runObservedPhase(
          'translation',
          async () =>
            this.executor.execute(
              buildTranslationPrompts(text, switchedAnalysis),
              TranslationDraftSchema,
              { signal },
            ),
          options,
          { escalated: true, round },
        )
        currentDraft = rebuiltDraft.translated
        analysis = switchedAnalysis
        await options.phaseObserver?.onEscalationCompleted?.({ round })
      }

      const review = await this.runObservedPhase(
        'review',
        async () =>
          this.executor.execute(
            buildReviewPrompts(text, analysis, currentDraft, round, escalated),
            ReviewSchema,
            { signal },
          ),
        options,
        { round, escalated },
      )
      rounds.push(review)
      currentDraft = review.refinedTranslation

      if (review.totalScore > bestRound.totalScore) {
        bestRound = review
      }

      if (review.passed) break
    }

    const winner = rounds.find((r) => r.passed) ?? bestRound
    const finalScore = winner.totalScore

    const result = this.buildTranslationResult(text, winner.refinedTranslation, draft.sourceLang)
    const trace = PipelineTraceSchema.parse({
      analysis,
      rounds,
      finalScore,
      totalRounds: rounds.length,
      escalated,
      durationMs: Date.now() - startMs,
    })

    return { result, trace }
  }

  private buildSignal(options: PipelineRunOptions): AbortSignal {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
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

    if (options.signal) {
      if (options.signal.aborted) {
        timeoutController.abort(this.toAbortReason(options.signal.reason))
      } else {
        options.signal.addEventListener(
          'abort',
          () => {
            timeoutController.abort(this.toAbortReason(options.signal?.reason))
          },
          { once: true },
        )
      }
    }
    return timeoutController.signal
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      if (signal.reason instanceof TranslationError) {
        throw signal.reason
      }
      throw new TranslationError('Translation pipeline aborted', 'ABORTED', signal.reason)
    }
  }

  private toAbortReason(reason: unknown): TranslationError {
    if (reason instanceof TranslationError) return reason
    return new TranslationError('Translation pipeline aborted', 'ABORTED', reason)
  }

  private async runObservedPhase<T>(
    phase: 'analysis' | 'translation' | 'review',
    run: () => Promise<T>,
    options: PipelineRunOptions,
    meta: { round?: number; escalated?: boolean } = {},
  ): Promise<T> {
    const params = {
      phase,
      ...(meta.round !== undefined ? { round: meta.round } : {}),
      escalated: meta.escalated ?? false,
    }

    await options.phaseObserver?.onPhaseStarted?.(params)
    try {
      const result = await run()
      await options.phaseObserver?.onPhaseCompleted?.(params)
      return result
    } catch (error) {
      await options.phaseObserver?.onPhaseFailed?.({ ...params, error })
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

  private buildFastPathAnalysis(): AnalysisResult {
    return AnalysisSchema.parse({
      skopos: {
        purpose: 'casual',
        audience: 'general',
        strategy: 'instrumental',
        register: 'casual',
      },
      extratextual: {
        sender: 'unknown',
        intention: 'quick message',
        audience: 'colleague',
        medium: 'chat',
        temporalContext: 'real-time chat',
      },
      intratextual: {
        subjectMatter: 'short message',
        contentSummary: 'brief casual communication',
        presuppositions: 'none',
        textStructure: 'single token',
        lexisNotes: 'minimal',
        nonVerbalElements: 'possible emoji',
      },
      crossCutting: {
        textFunction: 'phatic',
        registerTone: 'casual',
        expectedEffect: 'acknowledgment',
      },
      structuredHints: {
        sourceProfile: {
          language: 'japanese',
          medium: 'chat',
          domain: 'general',
          hasCode: false,
          hasUrl: false,
          hasJapaneseName: false,
          hasSpecialFormatting: false,
        },
        intentLabels: { phraseType: 'general_statement', confidence: 'high' },
        renderingPolicy: {
          strategy: 'functional_vietnamese',
          targetStyle: 'natural_office_vi',
          preserveAmbiguity: false,
          allowNaturalAdaptation: true,
          avoidLiteralFormulaTranslation: true,
        },
        preservationRules: {
          preserveUrl: false,
          preserveCode: false,
          preserveUnits: false,
          preserveChatworkMarkup: false,
          preserveJapaneseNameScript: false,
          allowRomajiGloss: false,
          forbidGenderInference: false,
        },
        reviewFocus: [],
      },
    })
  }

  private switchSkopos(analysis: AnalysisResult): AnalysisResult {
    return {
      ...analysis,
      skopos: {
        ...analysis.skopos,
        strategy: analysis.skopos.strategy === 'instrumental' ? 'documentary' : 'instrumental',
      },
    }
  }
}

function makeNullReview(): ReviewResult {
  return {
    scores: {
      naturalFlow: 0,
      culturalFidelity: 0,
      readerExperience: 0,
      semanticAccuracy: 0,
      targetConventions: 0,
    },
    totalScore: 0,
    passed: false,
    critique: '',
    refinedTranslation: '',
    personaFeedback: { freshReader: '', linguist: '', editor: '' },
  }
}
