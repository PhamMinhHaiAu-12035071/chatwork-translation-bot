import type { TranslationTrace } from '~/types/trace'

/**
 * TraceBuilder - Fluent API for building comprehensive translation traces.
 *
 * Usage:
 *   const builder = new TraceBuilder({ traceId, requestId, sourceMessageId })
 *
 *   builder.markStageStart('preprocessing')
 *   // ... do work ...
 *   builder.markStageEnd('preprocessing')
 *
 *   builder.setLLMDetails({ provider, model, tokens, ... })
 *   const trace = builder.build()
 */
export class TraceBuilder {
  private trace: Partial<TranslationTrace>
  private stageTimers: Map<string, number>

  constructor(init: { traceId: string; requestId: string; sourceMessageId: string }) {
    this.trace = {
      traceId: init.traceId,
      requestId: init.requestId,
      sourceMessageId: init.sourceMessageId,
      originType: 'manual', // Default
      timing: {
        preprocessing: 0,
        llmCall: 0,
        postprocessing: 0,
        delivery: 0,
        totalEndToEnd: 0,
      } as TranslationTrace['timing'],
      llm: {} as TranslationTrace['llm'],
      performance: {
        isSlowRequest: false,
        slowStages: [],
        bottleneckStage: '',
        bottleneckPercentage: 0,
      },
      opportunities: {
        cacheCandidate: false,
        fastModelCandidate: false,
        keywordOptimizationNeeded: false,
      },
    }
    this.stageTimers = new Map()
  }

  // ─── Origin Type ────────────────────────────────────────────────────────────

  setOriginType(type: 'manual' | 'automation'): void {
    this.trace.originType = type
  }

  // ─── Stage Timing ───────────────────────────────────────────────────────────

  markStageStart(stage: string): void {
    this.stageTimers.set(stage, performance.now())
    // Dynamic property assignment - ESLint accepts this pattern with Record
    const timing = this.trace.timing as Record<string, unknown>
    timing[`${stage}StartedAt`] = new Date().toISOString()
  }

  markStageEnd(stage: string): number {
    const startTime = this.stageTimers.get(stage)
    if (startTime === undefined) {
      throw new Error(`Stage ${stage} was not started`)
    }

    const duration = Math.round(performance.now() - startTime)
    // Dynamic property assignment - ESLint accepts this pattern with Record
    const timing = this.trace.timing as Record<string, unknown>
    timing[stage] = duration
    timing[`${stage}CompletedAt`] = new Date().toISOString()

    return duration
  }

  /**
   * Set timing manually (useful for testing or when timing is computed externally).
   */
  setTiming(durations: {
    preprocessing: number
    llmCall: number
    postprocessing: number
    delivery: number
  }): void {
    if (!this.trace.timing) return

    this.trace.timing.preprocessing = durations.preprocessing
    this.trace.timing.llmCall = durations.llmCall
    this.trace.timing.postprocessing = durations.postprocessing
    this.trace.timing.delivery = durations.delivery
  }

  // ─── LLM Details ────────────────────────────────────────────────────────────

  setLLMDetails(details: TranslationTrace['llm']): void {
    this.trace.llm = details
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────

  setMetadata(metadata: NonNullable<TranslationTrace['metadata']>): void {
    this.trace.metadata = metadata
  }

  // ─── Build Final Trace ──────────────────────────────────────────────────────

  build(): TranslationTrace {
    this.computeTotalTime()
    this.computePerformanceAnalysis()
    this.detectOptimizationOpportunities()

    // Set completion timestamp
    if (this.trace.timing) {
      this.trace.timing.completedAt = new Date().toISOString()
    }

    return this.trace as TranslationTrace
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private computeTotalTime(): void {
    const timing = this.trace.timing
    if (!timing) return

    timing.totalEndToEnd =
      timing.preprocessing + timing.llmCall + timing.postprocessing + timing.delivery
  }

  private computePerformanceAnalysis(): void {
    const timing = this.trace.timing
    if (!timing) return

    // Define slow request threshold (25 seconds)
    const SLOW_REQUEST_THRESHOLD_MS = 25000
    const SLOW_STAGE_THRESHOLD_MS = 1000

    // Check if overall request is slow
    const isSlowRequest = timing.totalEndToEnd > SLOW_REQUEST_THRESHOLD_MS

    // Identify slow stages
    const stages: { name: string; duration: number }[] = [
      { name: 'preprocessing', duration: timing.preprocessing },
      { name: 'llmCall', duration: timing.llmCall },
      { name: 'postprocessing', duration: timing.postprocessing },
      { name: 'delivery', duration: timing.delivery },
    ]

    const slowStages = stages.filter((s) => s.duration > SLOW_STAGE_THRESHOLD_MS).map((s) => s.name)

    // Find bottleneck (stage with highest duration)
    const bottleneck = stages.reduce((max, stage) => (stage.duration > max.duration ? stage : max))

    const bottleneckPercentage =
      timing.totalEndToEnd > 0 ? (bottleneck.duration / timing.totalEndToEnd) * 100 : 0

    this.trace.performance = {
      isSlowRequest,
      slowStages,
      bottleneckStage: bottleneck.name,
      bottleneckPercentage: Math.round(bottleneckPercentage * 10) / 10, // 1 decimal
    }
  }

  private detectOptimizationOpportunities(): void {
    const timing = this.trace.timing
    const llm = this.trace.llm
    if (!timing) return

    // Cache candidate: Slow enough to benefit from caching overhead
    const cacheCandidate = timing.totalEndToEnd > 10000 // > 10 seconds

    // Fast model candidate: Simple text but slow LLM response
    // Only evaluate if LLM details are set
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: llm may be empty object from constructor
    const inputTokens = llm?.tokens?.input
    const fastModelCandidate =
      inputTokens !== undefined && inputTokens < 500 && timing.llmCall > 10000

    // Keyword optimization needed: High preprocessing overhead
    const keywordOptimizationNeeded = timing.preprocessing > 500

    this.trace.opportunities = {
      cacheCandidate,
      fastModelCandidate,
      keywordOptimizationNeeded,
    }
  }
}
