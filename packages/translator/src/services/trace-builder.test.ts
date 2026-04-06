import { describe, expect, it } from 'bun:test'
import { TraceBuilder } from './trace-builder'

describe('TraceBuilder', () => {
  describe('Stage timing', () => {
    it('should compute stage durations correctly', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.markStageStart('preprocessing')

      // Simulate 100ms work (using actual delay)
      const start = performance.now()
      while (performance.now() - start < 100) {
        // Busy wait
      }

      const preprocessingTime = builder.markStageEnd('preprocessing')

      // Allow 50ms tolerance for timing precision
      expect(preprocessingTime).toBeGreaterThanOrEqual(100)
      expect(preprocessingTime).toBeLessThan(200)
    })

    it('should track multiple stages', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      // Use setTiming to avoid timing-based flakiness
      builder.setTiming({
        preprocessing: 100,
        llmCall: 5000,
        postprocessing: 200,
        delivery: 300,
      })

      const trace = builder.build()

      // Test that all stages are properly set
      expect(trace.timing.preprocessing).toBe(100)
      expect(trace.timing.llmCall).toBe(5000)
      expect(trace.timing.postprocessing).toBe(200)
      expect(trace.timing.delivery).toBe(300)
      expect(trace.timing.totalEndToEnd).toBe(5600)
    })

    it('should throw if stage not started', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      expect(() => {
        builder.markStageEnd('preprocessing')
      }).toThrow('Stage preprocessing was not started')
    })
  })

  describe('Performance analysis', () => {
    it('should identify bottleneck stage', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      // Manually set timing for analysis
      builder.setTiming({
        preprocessing: 100,
        llmCall: 15000, // Bottleneck
        postprocessing: 200,
        delivery: 300,
      })

      const trace = builder.build()

      expect(trace.performance.bottleneckStage).toBe('llmCall')
      expect(trace.performance.bottleneckPercentage).toBeGreaterThan(90)
      expect(trace.performance.bottleneckPercentage).toBeLessThan(100)
    })

    it('should detect slow requests', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.setTiming({
        preprocessing: 100,
        llmCall: 27000, // Very slow
        postprocessing: 200,
        delivery: 300,
      })

      const trace = builder.build()

      expect(trace.performance.isSlowRequest).toBe(true)
      expect(trace.performance.slowStages).toContain('llmCall')
    })

    it('should identify multiple slow stages', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.setTiming({
        preprocessing: 1500, // Slow
        llmCall: 2000, // Slow
        postprocessing: 500,
        delivery: 1200, // Slow
      })

      const trace = builder.build()

      expect(trace.performance.slowStages).toHaveLength(3)
      expect(trace.performance.slowStages).toContain('preprocessing')
      expect(trace.performance.slowStages).toContain('llmCall')
      expect(trace.performance.slowStages).toContain('delivery')
    })
  })

  describe('Optimization opportunities', () => {
    it('should suggest cache for slow requests', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.setTiming({
        preprocessing: 100,
        llmCall: 15000,
        postprocessing: 200,
        delivery: 300,
      })

      builder.setLLMDetails({
        provider: 'openai',
        model: 'gpt-4o-mini',
        translationStyle: 'NATURAL_CASUAL',
        promptVersion: 'optimized',
        tokens: { input: 800, output: 200, total: 1000 },
        generation: { temperature: 0.3, maxOutputTokens: 2000 },
      })

      const trace = builder.build()

      expect(trace.opportunities.cacheCandidate).toBe(true)
    })

    it('should suggest fast model for simple text', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.setTiming({
        preprocessing: 50,
        llmCall: 12000, // Slow for simple text
        postprocessing: 50,
        delivery: 200,
      })

      builder.setLLMDetails({
        provider: 'openai',
        model: 'gpt-4o',
        translationStyle: 'NATURAL_CASUAL',
        promptVersion: 'optimized',
        tokens: { input: 400, output: 50, total: 450 }, // Simple text
        generation: { temperature: 0.3, maxOutputTokens: 2000 },
      })

      const trace = builder.build()

      expect(trace.opportunities.fastModelCandidate).toBe(true)
    })

    it('should suggest keyword optimization for high preprocessing time', () => {
      const builder = new TraceBuilder({
        traceId: 'test-123',
        requestId: 'req-456',
        sourceMessageId: 'msg-789',
      })

      builder.setTiming({
        preprocessing: 800, // High overhead
        llmCall: 5000,
        postprocessing: 100,
        delivery: 200,
      })

      builder.setLLMDetails({
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        translationStyle: 'NATURAL_CASUAL',
        promptVersion: 'optimized',
        tokens: { input: 800, output: 200, total: 1000 },
        generation: { temperature: 0.3, maxOutputTokens: 2000 },
      })

      const trace = builder.build()

      expect(trace.opportunities.keywordOptimizationNeeded).toBe(true)
    })
  })

  describe('Complete trace building', () => {
    it('should build complete trace with all fields', () => {
      const builder = new TraceBuilder({
        traceId: 'trace-abc',
        requestId: 'req-def',
        sourceMessageId: 'msg-ghi',
      })

      builder.setOriginType('automation')

      builder.setTiming({
        preprocessing: 100,
        llmCall: 5000,
        postprocessing: 200,
        delivery: 300,
      })

      builder.setLLMDetails({
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        translationStyle: 'PROFESSIONAL_BUSINESS',
        promptVersion: 'optimized',
        tokens: { input: 800, output: 250, total: 1050 },
        generation: { temperature: 0.3, maxOutputTokens: 2000 },
      })

      builder.setMetadata({
        roomId: 123456,
        sourceLang: 'Japanese',
        textLength: 150,
        keywordCount: 3,
      })

      const trace = builder.build()

      // Identity
      expect(trace.traceId).toBe('trace-abc')
      expect(trace.requestId).toBe('req-def')
      expect(trace.sourceMessageId).toBe('msg-ghi')
      expect(trace.originType).toBe('automation')

      // Timing
      expect(trace.timing.totalEndToEnd).toBe(5600) // Sum of all stages
      expect(trace.timing.preprocessing).toBe(100)
      expect(trace.timing.llmCall).toBe(5000)

      // LLM
      expect(trace.llm.provider).toBe('gemini')
      expect(trace.llm.tokens.total).toBe(1050)

      // Performance
      expect(trace.performance.isSlowRequest).toBe(false)
      expect(trace.performance.bottleneckStage).toBe('llmCall')

      // Metadata
      expect(trace.metadata?.roomId).toBe(123456)
    })
  })
})
