import { describe, it, expect } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from '@chatwork-bot/core'
import { TranslationPipeline } from './pipeline'
import type { AnalysisResult, ReviewResult } from '@chatwork-bot/translation-prompt'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fakeAnalysis: AnalysisResult = {
  skopos: {
    purpose: 'informational',
    audience: 'Vietnamese engineer',
    strategy: 'instrumental',
    register: 'semi-formal',
  },
  extratextual: {
    sender: 'PM',
    intention: 'request confirmation',
    audience: 'developer',
    medium: 'chat',
    temporalContext: 'end of sprint',
  },
  intratextual: {
    subjectMatter: 'release schedule',
    contentSummary: 'asking deploy timing',
    presuppositions: 'reader knows the project',
    textStructure: 'single paragraph',
    lexisNotes: 'business Japanese',
    nonVerbalElements: 'none',
  },
  crossCutting: {
    textFunction: 'directive',
    registerTone: 'polite-formal',
    expectedEffect: 'reader confirms',
  },
}

const fakeDraft = { sourceLang: 'Japanese', translated: 'Bản dịch ban đầu.' }

const makeReview = (totalScore: number): ReviewResult => ({
  scores: {
    naturalFlow: Math.min(3, totalScore - 6) as 0 | 1 | 2 | 3,
    culturalFidelity: 2,
    readerExperience: 1,
    semanticAccuracy: 1,
    targetConventions: 1,
  },
  totalScore,
  passed: totalScore >= 9,
  critique: totalScore < 9 ? 'Needs improvement.' : 'Good.',
  refinedTranslation: `Bản dịch refined (score ${String(totalScore)}).`,
  personaFeedback: {
    freshReader: 'OK',
    linguist: 'OK',
    editor: 'OK',
  },
})

// ── Mock executor factory ─────────────────────────────────────────────────────

function makeMockExecutor(responses: unknown[]): ILLMExecutor {
  let callCount = 0
  return {
    execute<T>(_prompts: PromptPair, schema: ISchema<T>): Promise<T> {
      const response = responses[callCount++]
      return Promise.resolve(schema.parse(response) as T)
    },
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TranslationPipeline', () => {
  describe('happy path — passes round 1', () => {
    it('returns result and trace with 1 round', async () => {
      const passingReview = makeReview(9)
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft, passingReview])
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('こんにちは')

      expect(result.translatedText).toBe(passingReview.refinedTranslation)
      expect(result.sourceLang).toBe('Japanese')
      expect(result.targetLang).toBe('Vietnamese')
      expect(trace.rounds).toHaveLength(1)
      expect(trace.finalScore).toBe(9)
      expect(trace.escalated).toBe(false)
    })
  })

  describe('multi-round — passes at round 2', () => {
    it('returns result and trace with 2 rounds', async () => {
      const failReview = makeReview(8)
      const passReview = makeReview(9)
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft, failReview, passReview])
      const pipeline = new TranslationPipeline(executor)
      const { trace } = await pipeline.run('Hello')

      expect(trace.rounds).toHaveLength(2)
      expect(trace.finalScore).toBe(9)
      expect(trace.escalated).toBe(false)
    })
  })

  describe('escalation — stuck after 3 rounds', () => {
    it('marks escalated=true and continues for up to 2 more rounds', async () => {
      const failReview = makeReview(8)
      const passReview = makeReview(9)
      const executor = makeMockExecutor([
        fakeAnalysis,
        fakeDraft,
        failReview,
        failReview,
        failReview, // round 3 = stuck → escalation
        fakeDraft, // Phase 2 rebuilt with switched Skopos
        passReview, // round 4
      ])
      const pipeline = new TranslationPipeline(executor)
      const { trace } = await pipeline.run('テスト用のテキスト')

      expect(trace.escalated).toBe(true)
    })
  })

  describe('max rounds — returns best result', () => {
    it('returns best round when all 5 rounds fail', async () => {
      const review0 = makeReview(7)
      const review1 = makeReview(8) // best
      const review2 = makeReview(7)
      const review3 = makeReview(6)
      const review4 = makeReview(6)
      const executor = makeMockExecutor([
        fakeAnalysis,
        fakeDraft,
        review0,
        review1,
        review2, // round 3 = stuck → escalation
        fakeDraft, // Phase 2 rebuilt
        review3,
        review4,
      ])
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('テスト用のテキスト')

      expect(trace.totalRounds).toBeLessThanOrEqual(5)
      expect(result.translatedText).toBe(review1.refinedTranslation) // best was round 2
    })
  })

  describe('short-text fast path', () => {
    it('skips analysis for text shorter than 5 chars', async () => {
      const executor = makeMockExecutor([fakeDraft]) // only Phase 2 called
      const pipeline = new TranslationPipeline(executor)
      const { result, trace } = await pipeline.run('ok')

      expect(result.sourceLang).toBe('Japanese')
      expect(trace.rounds).toHaveLength(0)
    })
  })

  describe('abort signal', () => {
    it('throws TranslationError with ABORTED code when signal is already aborted', async () => {
      const controller = new AbortController()
      controller.abort()
      const executor = makeMockExecutor([fakeAnalysis, fakeDraft])
      const pipeline = new TranslationPipeline(executor)

      try {
        await pipeline.run('test', { signal: controller.signal })
        expect.unreachable('should have thrown')
      } catch (error) {
        const { TranslationError } = await import('@chatwork-bot/core')
        expect(error).toBeInstanceOf(TranslationError)
        expect((error as InstanceType<typeof TranslationError>).code).toBe('ABORTED')
      }
    })
  })
})
