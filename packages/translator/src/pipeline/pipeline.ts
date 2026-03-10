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

export interface PipelineRunOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface PipelineRunResult {
  result: TranslationResult
  trace: PipelineTrace
}

const MAX_ROUNDS = 5
const ESCALATION_ROUND = 3
const SHORT_TEXT_THRESHOLD = 5 // grapheme count
const DEFAULT_TIMEOUT_MS = 120_000

export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: { timeoutMs?: number } = {},
  ) {}

  async run(text: string, options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
    const startMs = Date.now()
    const signal = this.buildSignal(options)

    this.checkAbort(signal)

    const isShortText = [...text].length < SHORT_TEXT_THRESHOLD

    // ── Phase 0+1: Analysis (skip for short text) ──────────────────────────
    let analysis: AnalysisResult

    if (isShortText) {
      analysis = this.buildFastPathAnalysis()
    } else {
      this.checkAbort(signal)
      analysis = await this.executor.execute(buildAnalysisPrompts(text), AnalysisSchema, { signal })
    }

    // ── Phase 2: Translation ───────────────────────────────────────────────
    this.checkAbort(signal)
    const draft = await this.executor.execute(
      buildTranslationPrompts(text, analysis),
      TranslationDraftSchema,
      { signal },
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
        escalated = true
        const switchedAnalysis = this.switchSkopos(analysis)
        this.checkAbort(signal)
        const rebuiltDraft = await this.executor.execute(
          buildTranslationPrompts(text, switchedAnalysis),
          TranslationDraftSchema,
          { signal },
        )
        currentDraft = rebuiltDraft.translated
        analysis = switchedAnalysis
      }

      const review = await this.executor.execute(
        buildReviewPrompts(text, analysis, currentDraft, round, escalated),
        ReviewSchema,
        { signal },
      )
      rounds.push(review)
      currentDraft = review.refinedTranslation

      if (review.totalScore > (bestRound.totalScore ?? 0)) {
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

  private buildSignal(options: PipelineRunOptions): AbortSignal | undefined {
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
    setTimeout(() => timeoutController.abort(), timeoutMs)

    if (options.signal) {
      // Combine external signal + timeout signal
      options.signal.addEventListener('abort', () => timeoutController.abort())
      return timeoutController.signal
    }
    return timeoutController.signal
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new TranslationError('Translation pipeline aborted', 'ABORTED')
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
