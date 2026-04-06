import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TranslationTrace } from '../packages/translator/src/types/trace'

interface TraceAnalysis {
  summary: {
    totalRequests: number
    dateRange: string
    avgLatencyMs: number
    p50: number
    p95: number
    p99: number
  }

  byProvider: Record<
    string,
    {
      count: number
      avgLLMTime: number
      avgTotal: number
      tokensPerRequest: number
    }
  >

  bottlenecks: {
    stage: string
    occurrences: number
    avgDuration: number
  }[]

  slowRequests: Array<{
    traceId: string
    duration: number
    bottleneck: string
    provider: string
  }>

  opportunities: {
    cacheCandidate: number
    fastModelCandidate: number
    keywordOptimization: number
  }
}

async function analyzeTraces(dir: string): Promise<TraceAnalysis> {
  const traces = await loadAllTraces(dir)

  // Sort by time for percentile calculation
  const times = traces.map((t) => t.timing.totalEndToEnd).sort((a, b) => a - b)

  const summary = {
    totalRequests: traces.length,
    dateRange: dir.split('/').pop() || 'unknown',
    avgLatencyMs: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
  }

  // Group by provider
  const byProvider: Record<string, { count: number; totalLLMTime: number; totalTime: number; totalTokens: number }> =
    {}

  for (const trace of traces) {
    const provider = trace.llm.provider

    if (!byProvider[provider]) {
      byProvider[provider] = {
        count: 0,
        totalLLMTime: 0,
        totalTime: 0,
        totalTokens: 0,
      }
    }

    byProvider[provider].count++
    byProvider[provider].totalLLMTime += trace.timing.llmCall
    byProvider[provider].totalTime += trace.timing.totalEndToEnd
    byProvider[provider].totalTokens += trace.llm.tokens.total
  }

  // Compute averages
  const providerStats: Record<
    string,
    { count: number; avgLLMTime: number; avgTotal: number; tokensPerRequest: number }
  > = {}

  for (const provider in byProvider) {
    const stats = byProvider[provider]
    providerStats[provider] = {
      count: stats.count,
      avgLLMTime: Math.round(stats.totalLLMTime / stats.count),
      avgTotal: Math.round(stats.totalTime / stats.count),
      tokensPerRequest: Math.round(stats.totalTokens / stats.count),
    }
  }

  // Identify bottlenecks
  const bottleneckCounts: Record<string, number[]> = {}

  for (const trace of traces) {
    const stage = trace.performance.bottleneckStage

    if (!bottleneckCounts[stage]) {
      bottleneckCounts[stage] = []
    }

    // Access timing dynamically
    const timing = trace.timing as Record<string, unknown>
    const duration = timing[stage]
    if (typeof duration === 'number') {
      bottleneckCounts[stage].push(duration)
    }
  }

  const bottlenecks = Object.entries(bottleneckCounts)
    .map(([stage, durations]) => ({
      stage,
      occurrences: durations.length,
      avgDuration: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
    }))
    .sort((a, b) => b.occurrences - a.occurrences)

  // Find slow requests
  const slowRequests = traces
    .filter((t) => t.performance.isSlowRequest)
    .map((t) => ({
      traceId: t.traceId,
      duration: t.timing.totalEndToEnd,
      bottleneck: t.performance.bottleneckStage,
      provider: t.llm.provider,
    }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10) // Top 10

  // Count opportunities
  const opportunities = {
    cacheCandidate: traces.filter((t) => t.opportunities.cacheCandidate).length,
    fastModelCandidate: traces.filter((t) => t.opportunities.fastModelCandidate).length,
    keywordOptimization: traces.filter((t) => t.opportunities.keywordOptimizationNeeded).length,
  }

  return {
    summary,
    byProvider: providerStats,
    bottlenecks,
    slowRequests,
    opportunities,
  }
}

async function loadAllTraces(dir: string): Promise<TranslationTrace[]> {
  const files = await readdir(dir)
  const traceFiles = files.filter((f) => f.startsWith('trace-') && f.endsWith('.json'))

  const traces = await Promise.all(
    traceFiles.map(async (file) => {
      const content = await readFile(join(dir, file), 'utf-8')
      return JSON.parse(content) as TranslationTrace
    }),
  )

  return traces
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[index]
}

// CLI usage
const [traceDir, outputFile] = process.argv.slice(2)

if (!traceDir) {
  console.error('Usage: bun run scripts/analyze-traces.ts <trace-directory> [output-file]')
  process.exit(1)
}

const analysis = await analyzeTraces(traceDir)

console.log('=== Translation Performance Analysis ===\n')

console.log('Summary:')
console.log(`  Total requests: ${analysis.summary.totalRequests}`)
console.log(`  Date range: ${analysis.summary.dateRange}`)
console.log(`  Avg latency: ${analysis.summary.avgLatencyMs}ms`)
console.log(`  P50: ${analysis.summary.p50}ms`)
console.log(`  P95: ${analysis.summary.p95}ms`)
console.log(`  P99: ${analysis.summary.p99}ms`)

console.log('\nBy Provider:')
for (const [provider, stats] of Object.entries(analysis.byProvider)) {
  console.log(`  ${provider}:`)
  console.log(`    Count: ${stats.count}`)
  console.log(`    Avg LLM time: ${stats.avgLLMTime}ms`)
  console.log(`    Avg total: ${stats.avgTotal}ms`)
  console.log(`    Tokens/request: ${stats.tokensPerRequest}`)
}

console.log('\nBottlenecks:')
for (const bottleneck of analysis.bottlenecks) {
  console.log(`  ${bottleneck.stage}: ${bottleneck.occurrences} times (avg ${bottleneck.avgDuration}ms)`)
}

console.log('\nSlow Requests (top 10):')
for (const req of analysis.slowRequests) {
  console.log(`  ${req.traceId}: ${req.duration}ms (${req.provider}, bottleneck: ${req.bottleneck})`)
}

console.log('\nOptimization Opportunities:')
console.log(`  Cache candidates: ${analysis.opportunities.cacheCandidate}`)
console.log(`  Fast model candidates: ${analysis.opportunities.fastModelCandidate}`)
console.log(`  Keyword optimization needed: ${analysis.opportunities.keywordOptimization}`)

if (outputFile) {
  await Bun.write(outputFile, JSON.stringify(analysis, null, 2))
  console.log(`\nAnalysis saved to ${outputFile}`)
}
