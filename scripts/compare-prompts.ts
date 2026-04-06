#!/usr/bin/env bun
// Compare baseline vs optimized prompt versions using output traces

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

interface TraceData {
  traceId: string
  timing: {
    llmCall?: number
    totalEndToEnd?: number
  }
  llm?: {
    tokens?: {
      input?: number
      output?: number
    }
  }
  translation?: {
    sourceLang?: string
    translated?: string
  }
  metadata?: {
    testId?: string
    category?: string
  }
}

interface VersionMetrics {
  count: number
  avgLLMTime: number
  avgTokensInput: number
  avgTokensOutput: number
  avgTotalTime: number
  traces: TraceData[]
}

interface CategoryComparison {
  category: string
  baseline: VersionMetrics
  optimized: VersionMetrics
  delta: {
    llmTime: number
    tokensInput: number
    tokensOutput: number
    totalTime: number
    tokensInputPercent: number
  }
}

interface ComparisonResult {
  overall: {
    baseline: VersionMetrics
    optimized: VersionMetrics
    delta: {
      llmTime: number
      tokensInput: number
      tokensOutput: number
      totalTime: number
      tokensInputPercent: number
    }
  }
  byCategory: CategoryComparison[]
  qualityIssues: Array<{
    testId: string
    category: string
    issue: string
    baseline: string
    optimized: string
  }>
}

// Load trace files from output directory
async function loadTraces(roomId: string, version: 'baseline' | 'optimized'): Promise<TraceData[]> {
  const outputDir = `output/${roomId}`
  const traces: TraceData[] = []

  try {
    const files = await readdir(outputDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))

    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(outputDir, file), 'utf-8')
        const data = JSON.parse(content) as TraceData

        // Simple heuristic: baseline has higher input tokens, optimized has lower
        // (This assumes you run baseline first, then optimized, or use separate rooms)
        const isVersion =
          version === 'baseline'
            ? (data.llm?.tokens?.input ?? 0) > 1200 // Baseline threshold
            : (data.llm?.tokens?.input ?? 0) < 1200 // Optimized threshold

        if (isVersion) {
          traces.push(data)
        }
      } catch (error) {
        console.warn(`Skipping invalid trace file ${file}:`, error)
      }
    }
  } catch (error) {
    console.error(`Failed to load traces from ${outputDir}:`, error)
  }

  return traces
}

// Calculate metrics for a set of traces
function calculateMetrics(traces: TraceData[]): VersionMetrics {
  if (traces.length === 0) {
    return {
      count: 0,
      avgLLMTime: 0,
      avgTokensInput: 0,
      avgTokensOutput: 0,
      avgTotalTime: 0,
      traces: [],
    }
  }

  const llmTimes = traces.map((t) => t.timing?.llmCall ?? 0).filter((x) => x > 0)
  const tokensInput = traces.map((t) => t.llm?.tokens?.input ?? 0).filter((x) => x > 0)
  const tokensOutput = traces.map((t) => t.llm?.tokens?.output ?? 0).filter((x) => x > 0)
  const totalTimes = traces.map((t) => t.timing?.totalEndToEnd ?? 0).filter((x) => x > 0)

  return {
    count: traces.length,
    avgLLMTime: llmTimes.length > 0 ? llmTimes.reduce((a, b) => a + b, 0) / llmTimes.length : 0,
    avgTokensInput: tokensInput.length > 0 ? tokensInput.reduce((a, b) => a + b, 0) / tokensInput.length : 0,
    avgTokensOutput: tokensOutput.length > 0 ? tokensOutput.reduce((a, b) => a + b, 0) / tokensOutput.length : 0,
    avgTotalTime: totalTimes.length > 0 ? totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length : 0,
    traces,
  }
}

// Group traces by category
function groupByCategory(traces: TraceData[]): Map<string, TraceData[]> {
  const groups = new Map<string, TraceData[]>()

  for (const trace of traces) {
    const category = trace.metadata?.category ?? 'unknown'
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(trace)
  }

  return groups
}

// Compare two versions
async function compareVersions(roomId: string): Promise<ComparisonResult> {
  console.log(`\n🔍 Loading traces from output/${roomId}/...\n`)

  const baselineTraces = await loadTraces(roomId, 'baseline')
  const optimizedTraces = await loadTraces(roomId, 'optimized')

  console.log(`Found ${baselineTraces.length} baseline traces`)
  console.log(`Found ${optimizedTraces.length} optimized traces\n`)

  if (baselineTraces.length === 0 || optimizedTraces.length === 0) {
    throw new Error('Insufficient traces for comparison. Run A/B test first.')
  }

  // Overall metrics
  const baselineOverall = calculateMetrics(baselineTraces)
  const optimizedOverall = calculateMetrics(optimizedTraces)

  const overallDelta = {
    llmTime: optimizedOverall.avgLLMTime - baselineOverall.avgLLMTime,
    tokensInput: optimizedOverall.avgTokensInput - baselineOverall.avgTokensInput,
    tokensOutput: optimizedOverall.avgTokensOutput - baselineOverall.avgTokensOutput,
    totalTime: optimizedOverall.avgTotalTime - baselineOverall.avgTotalTime,
    tokensInputPercent:
      baselineOverall.avgTokensInput > 0
        ? ((optimizedOverall.avgTokensInput - baselineOverall.avgTokensInput) / baselineOverall.avgTokensInput) * 100
        : 0,
  }

  // By category
  const baselineByCategory = groupByCategory(baselineTraces)
  const optimizedByCategory = groupByCategory(optimizedTraces)
  const allCategories = new Set([...baselineByCategory.keys(), ...optimizedByCategory.keys()])

  const byCategory: CategoryComparison[] = []

  for (const category of allCategories) {
    const baseline = calculateMetrics(baselineByCategory.get(category) ?? [])
    const optimized = calculateMetrics(optimizedByCategory.get(category) ?? [])

    if (baseline.count > 0 && optimized.count > 0) {
      byCategory.push({
        category,
        baseline,
        optimized,
        delta: {
          llmTime: optimized.avgLLMTime - baseline.avgLLMTime,
          tokensInput: optimized.avgTokensInput - baseline.avgTokensInput,
          tokensOutput: optimized.avgTokensOutput - baseline.avgTokensOutput,
          totalTime: optimized.avgTotalTime - baseline.avgTotalTime,
          tokensInputPercent:
            baseline.avgTokensInput > 0
              ? ((optimized.avgTokensInput - baseline.avgTokensInput) / baseline.avgTokensInput) * 100
              : 0,
        },
      })
    }
  }

  return {
    overall: {
      baseline: baselineOverall,
      optimized: optimizedOverall,
      delta: overallDelta,
    },
    byCategory,
    qualityIssues: [], // Manual review required
  }
}

// Print comparison report
function printReport(result: ComparisonResult): void {
  console.log('\n📊 Prompt Optimization Comparison Report\n')
  console.log('='.repeat(80))

  // Overall metrics
  console.log('\n🌍 Overall Performance\n')

  const { baseline, optimized, delta } = result.overall

  console.log('Baseline:')
  console.log(`  Traces:        ${baseline.count}`)
  console.log(`  Avg LLM time:  ${baseline.avgLLMTime.toFixed(0)}ms`)
  console.log(`  Avg tokens in: ${baseline.avgTokensInput.toFixed(0)}`)
  console.log(`  Avg tokens out:${baseline.avgTokensOutput.toFixed(0)}`)
  console.log(`  Avg total:     ${baseline.avgTotalTime.toFixed(0)}ms`)

  console.log('\nOptimized:')
  console.log(`  Traces:        ${optimized.count}`)
  console.log(`  Avg LLM time:  ${optimized.avgLLMTime.toFixed(0)}ms`)
  console.log(`  Avg tokens in: ${optimized.avgTokensInput.toFixed(0)}`)
  console.log(`  Avg tokens out:${optimized.avgTokensOutput.toFixed(0)}`)
  console.log(`  Avg total:     ${optimized.avgTotalTime.toFixed(0)}ms`)

  console.log('\nDelta:')
  console.log(`  LLM time:      ${delta.llmTime > 0 ? '+' : ''}${delta.llmTime.toFixed(0)}ms (${((delta.llmTime / baseline.avgLLMTime) * 100).toFixed(1)}%)`)
  console.log(`  Tokens in:     ${delta.tokensInput > 0 ? '+' : ''}${delta.tokensInput.toFixed(0)} (${delta.tokensInputPercent.toFixed(1)}%)`)
  console.log(`  Tokens out:    ${delta.tokensOutput > 0 ? '+' : ''}${delta.tokensOutput.toFixed(0)} (${((delta.tokensOutput / baseline.avgTokensOutput) * 100).toFixed(1)}%)`)
  console.log(`  Total time:    ${delta.totalTime > 0 ? '+' : ''}${delta.totalTime.toFixed(0)}ms (${((delta.totalTime / baseline.avgTotalTime) * 100).toFixed(1)}%)`)

  // Category breakdown
  console.log('\n\n📂 By Category\n')
  console.log('-'.repeat(80))

  for (const cat of result.byCategory) {
    console.log(`\n${cat.category} (${cat.baseline.count} baseline, ${cat.optimized.count} optimized)`)
    console.log(`  LLM time:   ${cat.baseline.avgLLMTime.toFixed(0)}ms → ${cat.optimized.avgLLMTime.toFixed(0)}ms (${cat.delta.llmTime > 0 ? '+' : ''}${cat.delta.llmTime.toFixed(0)}ms)`)
    console.log(`  Tokens in:  ${cat.baseline.avgTokensInput.toFixed(0)} → ${cat.optimized.avgTokensInput.toFixed(0)} (${cat.delta.tokensInputPercent.toFixed(1)}%)`)
    console.log(`  Total time: ${cat.baseline.avgTotalTime.toFixed(0)}ms → ${cat.optimized.avgTotalTime.toFixed(0)}ms (${cat.delta.totalTime > 0 ? '+' : ''}${cat.delta.totalTime.toFixed(0)}ms)`)
  }

  // Success criteria
  console.log('\n\n✅ Success Criteria Validation\n')
  console.log('-'.repeat(80))

  const tokenReduction = Math.abs(delta.tokensInputPercent)
  const timeChange = (delta.totalTime / baseline.avgTotalTime) * 100

  console.log(`\n1. Token reduction: ${tokenReduction.toFixed(1)}% (target: -25% to -35%)`)
  console.log(`   ${tokenReduction >= 25 && tokenReduction <= 35 ? '✅ PASS' : '⚠️  CHECK'}: ${tokenReduction >= 25 ? 'Achieved' : 'Below'} target`)

  console.log(`\n2. Response time: ${timeChange > 0 ? '+' : ''}${timeChange.toFixed(1)}%`)
  console.log(`   ${Math.abs(timeChange) <= 5 ? '✅ PASS' : '⚠️  CHECK'}: ${Math.abs(timeChange) <= 5 ? 'Within' : 'Outside'} ±5% tolerance`)

  console.log('\n3. Quality (manual review required):')
  console.log('   [ ] Romanization accuracy maintained')
  console.log('   [ ] Style differentiation preserved')
  console.log('   [ ] Translation naturalness unchanged')
  console.log('   [ ] JSON format compliance 100%')

  console.log('\n\n💡 Next Steps\n')
  console.log('-'.repeat(80))
  console.log('\n1. Manual quality review:')
  console.log('   - Compare 10-20 random translations side-by-side')
  console.log('   - Check romanization for Japanese names/companies')
  console.log('   - Verify casual tone preserved in English messages')
  console.log('   - Confirm technical terms handled correctly')
  console.log('\n2. If quality is acceptable:')
  console.log('   - Update TRANSLATION_PROMPT_VERSION=optimized in .env')
  console.log('   - Deploy to staging for broader testing')
  console.log('   - Monitor for 1 week')
  console.log('   - Gradual production rollout (10% → 50% → 100%)')
  console.log('\n3. If quality issues found:')
  console.log('   - Document specific failures')
  console.log('   - Refine optimized prompts')
  console.log('   - Re-run A/B test\n')

  console.log('='.repeat(80))
}

// Main
async function main() {
  const roomId = process.argv[2] ?? '777777' // Default A/B test room

  console.log('🔬 Prompt A/B Test Analysis\n')
  console.log(`Room ID: ${roomId}`)
  console.log('Baseline version: High token count prompts')
  console.log('Optimized version: Low token count prompts')

  try {
    const result = await compareVersions(roomId)
    printReport(result)

    // Export JSON for further analysis
    const reportPath = `output/${roomId}/comparison-report.json`
    await Bun.write(reportPath, JSON.stringify(result, null, 2))
    console.log(`\n📄 Detailed report saved: ${reportPath}\n`)
  } catch (error) {
    console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : String(error))
    console.log('\nTroubleshooting:')
    console.log('1. Ensure both baseline and optimized tests have been run')
    console.log('2. Check that output/ directory contains trace files')
    console.log('3. Verify trace files have valid JSON format\n')
    process.exit(1)
  }
}

main()
