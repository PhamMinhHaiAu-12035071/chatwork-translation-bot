/**
 * Comprehensive trace schema for translation pipeline observability.
 *
 * Purpose: Track timing, token usage, and performance across all stages
 * from webhook receipt to Chatwork delivery completion.
 */

export interface TranslationTrace {
  // ─── Identity ───────────────────────────────────────────────────────────────

  traceId: string // UUID for this translation request
  requestId: string // Request ID from translator service
  sourceMessageId: string // Original Chatwork message ID
  originType: 'manual' | 'automation' // Source of request

  // ─── Timing ─────────────────────────────────────────────────────────────────

  timing: {
    // ISO timestamps for each stage
    webhookReceivedAt: string // When webhook hit the endpoint
    translatorReceivedAt: string // When translator started processing
    preprocessingStartedAt: string
    preprocessingCompletedAt: string
    llmCallStartedAt: string
    llmCallCompletedAt: string
    postprocessingStartedAt: string
    postprocessingCompletedAt: string
    deliveryStartedAt: string
    deliveryCompletedAt: string
    completedAt: string // Overall completion timestamp

    // Durations in milliseconds
    preprocessing: number // Keyword masking, parsing
    llmCall: number // LLM API call latency
    postprocessing: number // Keyword restore, tag addition
    delivery: number // Chatwork API call
    totalEndToEnd: number // Total pipeline time
  }

  // ─── LLM Details ────────────────────────────────────────────────────────────

  llm: {
    provider: string // 'gemini' | 'openai' | 'cursor'
    model: string // Model identifier
    translationStyle: string // NATURAL_CASUAL | PROFESSIONAL_BUSINESS | TECHNICAL
    promptVersion: 'baseline' | 'optimized' // Prompt version used
    tokens: {
      input: number // Prompt tokens
      output: number // Generated tokens
      total: number // Sum
    }
    generation: {
      temperature: number // Generation temperature
      maxOutputTokens: number // Max output token limit
      thinkingConfig?: unknown // Extended thinking config (if applicable)
    }
  }

  // ─── Performance Analysis ───────────────────────────────────────────────────

  performance: {
    isSlowRequest: boolean // totalEndToEnd > 25 seconds
    slowStages: string[] // Stages with duration > 1 second
    bottleneckStage: string // Stage with highest duration
    bottleneckPercentage: number // Bottleneck duration / total (%)
  }

  // ─── Optimization Hints ─────────────────────────────────────────────────────

  opportunities: {
    cacheCandidate: boolean // True if request is slow enough to benefit from caching
    fastModelCandidate: boolean // True if simple text but slow response
    keywordOptimizationNeeded: boolean // True if preprocessing overhead high
  }

  // ─── Metadata (Optional) ────────────────────────────────────────────────────

  metadata?: {
    roomId: number
    sourceLang?: string
    textLength?: number
    keywordCount?: number
    error?: string
  }
}

/**
 * Stage names used in tracing.
 */
export type TracingStage = 'preprocessing' | 'llmCall' | 'postprocessing' | 'delivery'
