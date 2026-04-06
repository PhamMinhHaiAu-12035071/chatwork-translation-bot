#!/usr/bin/env bun
// Automated A/B testing for baseline vs optimized prompts

import { OpenAI } from 'openai'
import { buildSingleCallPrompts } from '../packages/translation-prompt/src/translation-prompt'
import type { TranslationStyle } from '@chatwork-bot/core'
import { readFile } from 'node:fs/promises'

interface TestMessage {
  room_id: number
  account_id: number
  message_id: string
  body: string
  send_time: number
  _meta: {
    testId: string
    category: string
    index: number
  }
}

interface TestResult {
  testId: string
  category: string
  sourceText: string
  version: 'baseline' | 'optimized'
  tokensInput: number
  tokensOutput: number
  tokensTotal: number
  responseTimeMs: number
  translated: string
  error?: string
}

interface ComparisonReport {
  summary: {
    baseline: {
      avgTokensInput: number
      avgTokensOutput: number
      avgResponseTime: number
      count: number
    }
    optimized: {
      avgTokensInput: number
      avgTokensOutput: number
      avgResponseTime: number
      count: number
    }
    delta: {
      tokensInput: number
      tokensInputPercent: number
      tokensOutput: number
      responseTime: number
    }
  }
  byCategory: Map<
    string,
    {
      baseline: { avgTokensInput: number; count: number }
      optimized: { avgTokensInput: number; count: number }
      delta: number
    }
  >
  results: TestResult[]
}

// Sample representative messages from each category
const SAMPLE_MESSAGES = [
  // Japanese romanization (5 samples)
  '/translate vi 佐々木さんに確認をお願いします。',
  '/translate vi デキスパート基本部の田中さんから連絡がありました。',
  '/translate vi 2nd開発チームとMTGを設定しました。',
  '/translate vi 山田様、お世話になっております。',
  '/translate vi 株式会社ABCテクノロジーの件です。',

  // English casual (3 samples)
  "/translate vi Thanks for the heads up! I'll look into it.",
  '/translate vi Could you maybe send that over when you get a chance?',
  '/translate vi FYI - the staging environment is down for maintenance.',

  // Mixed content (3 samples)
  '/translate vi MTGの件、佐々木さんに確認しました。Tomorrow at 2pm works.',
  '/translate vi Pull requestをmergeしました。田中さん、ご確認ください。',
  '/translate vi Code reviewありがとうございます。山田さんのコメント対応しました。',

  // Long message (1 sample)
  `/translate vi お疲れ様です。本日のMTGの件、以下の通り議事録を共有いたします。

参加者：佐々木さん、田中さん、山田さん
日時：4月5日 14:00-15:00

議題：
1. 2nd開発チームのスプリントレビュー
2. 次期リリースのスコープ確認

よろしくお願いいたします。`,

  // Technical (2 samples)
  `/translate vi Error in production:
TypeError: Cannot read property 'map' of undefined
at UserList.render (UserList.tsx:42)`,
  '/translate vi Build failed: npm ERR! ERESOLVE unable to resolve dependency tree',

  // Edge case (1 sample)
  '/translate vi Check out: https://github.com/user/repo/pull/1234',
]

// Extract text from /translate command
function extractText(body: string): string {
  const match = body.match(/^\/translate\s+(\w+)\s+(.+)$/s)
  return match ? match[2] : body
}

// Categorize message
function categorizeMessage(text: string): string {
  if (/[ぁ-ん]|[ァ-ヴ]|[一-龯]/.test(text)) {
    if (/[a-zA-Z]{3,}/.test(text)) return 'mixed-content'
    if (text.length > 200) return 'long-messages'
    return 'japanese-romanization'
  }
  if (/Error|TypeError|npm ERR|failed/i.test(text)) return 'technical'
  if (/https?:\/\//.test(text)) return 'edge-cases'
  if (text.length > 200) return 'long-messages'
  return 'english-casual'
}

// Test single message with specific prompt version
async function testMessage(
  client: OpenAI,
  text: string,
  version: 'baseline' | 'optimized',
  testId: string,
  category: string,
): Promise<TestResult> {
  // Set environment variable to control prompt version
  process.env['TRANSLATION_PROMPT_VERSION'] = version

  const style: TranslationStyle = 'NATURAL_CASUAL'

  try {
    // Build prompts using translation-prompt package
    const prompts = buildSingleCallPrompts(text, style)

    const startTime = Date.now()

    // Call OpenAI API
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective for testing
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const responseTimeMs = Date.now() - startTime

    const usage = completion.usage
    const response = completion.choices[0]?.message?.content ?? '{}'

    let translated = ''
    try {
      const parsed = JSON.parse(response) as { translated?: string }
      translated = parsed.translated ?? '(parse error)'
    } catch {
      translated = '(invalid JSON)'
    }

    return {
      testId,
      category,
      sourceText: text,
      version,
      tokensInput: usage?.prompt_tokens ?? 0,
      tokensOutput: usage?.completion_tokens ?? 0,
      tokensTotal: usage?.total_tokens ?? 0,
      responseTimeMs,
      translated,
    }
  } catch (error) {
    return {
      testId,
      category,
      sourceText: text,
      version,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      responseTimeMs: 0,
      translated: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Run A/B test on all sample messages
async function runABTest(apiKey: string): Promise<ComparisonReport> {
  const client = new OpenAI({ apiKey })

  console.log('\n🧪 Starting Automated A/B Test\n')
  console.log(`Testing ${SAMPLE_MESSAGES.length} messages...`)
  console.log('Models: Baseline vs Optimized prompts')
  console.log('Provider: OpenAI (gpt-4o-mini)\n')

  const results: TestResult[] = []

  // Test each message with both versions
  for (let i = 0; i < SAMPLE_MESSAGES.length; i++) {
    const message = SAMPLE_MESSAGES[i]
    const text = extractText(message)
    const category = categorizeMessage(text)
    const testId = `test-${String(i + 1).padStart(2, '0')}`

    console.log(`[${i + 1}/${SAMPLE_MESSAGES.length}] Testing: ${testId} (${category})`)

    // Test baseline
    process.stdout.write('  Baseline... ')
    const baselineResult = await testMessage(client, text, 'baseline', testId, category)
    console.log(`${baselineResult.tokensInput} tokens in, ${baselineResult.responseTimeMs}ms`)
    results.push(baselineResult)

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Test optimized
    process.stdout.write('  Optimized... ')
    const optimizedResult = await testMessage(client, text, 'optimized', testId, category)
    console.log(`${optimizedResult.tokensInput} tokens in, ${optimizedResult.responseTimeMs}ms`)
    results.push(optimizedResult)

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log('\n✅ Testing complete!\n')

  // Calculate summary
  const baselineResults = results.filter((r) => r.version === 'baseline' && !r.error)
  const optimizedResults = results.filter((r) => r.version === 'optimized' && !r.error)

  const baselineSummary = {
    avgTokensInput:
      baselineResults.reduce((sum, r) => sum + r.tokensInput, 0) / baselineResults.length,
    avgTokensOutput:
      baselineResults.reduce((sum, r) => sum + r.tokensOutput, 0) / baselineResults.length,
    avgResponseTime:
      baselineResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / baselineResults.length,
    count: baselineResults.length,
  }

  const optimizedSummary = {
    avgTokensInput:
      optimizedResults.reduce((sum, r) => sum + r.tokensInput, 0) / optimizedResults.length,
    avgTokensOutput:
      optimizedResults.reduce((sum, r) => sum + r.tokensOutput, 0) / optimizedResults.length,
    avgResponseTime:
      optimizedResults.reduce((sum, r) => sum + r.responseTimeMs, 0) / optimizedResults.length,
    count: optimizedResults.length,
  }

  const delta = {
    tokensInput: optimizedSummary.avgTokensInput - baselineSummary.avgTokensInput,
    tokensInputPercent:
      ((optimizedSummary.avgTokensInput - baselineSummary.avgTokensInput) /
        baselineSummary.avgTokensInput) *
      100,
    tokensOutput: optimizedSummary.avgTokensOutput - baselineSummary.avgTokensOutput,
    responseTime: optimizedSummary.avgResponseTime - baselineSummary.avgResponseTime,
  }

  // By category
  const categories = new Set(results.map((r) => r.category))
  const byCategory = new Map<
    string,
    {
      baseline: { avgTokensInput: number; count: number }
      optimized: { avgTokensInput: number; count: number }
      delta: number
    }
  >()

  for (const category of categories) {
    const catBaseline = baselineResults.filter((r) => r.category === category)
    const catOptimized = optimizedResults.filter((r) => r.category === category)

    if (catBaseline.length > 0 && catOptimized.length > 0) {
      const baselineAvg =
        catBaseline.reduce((sum, r) => sum + r.tokensInput, 0) / catBaseline.length
      const optimizedAvg =
        catOptimized.reduce((sum, r) => sum + r.tokensInput, 0) / catOptimized.length

      byCategory.set(category, {
        baseline: { avgTokensInput: baselineAvg, count: catBaseline.length },
        optimized: { avgTokensInput: optimizedAvg, count: catOptimized.length },
        delta: optimizedAvg - baselineAvg,
      })
    }
  }

  return {
    summary: {
      baseline: baselineSummary,
      optimized: optimizedSummary,
      delta,
    },
    byCategory,
    results,
  }
}

// Print comparison report
function printReport(report: ComparisonReport): void {
  console.log('='.repeat(80))
  console.log('\n📊 Automated A/B Test Results\n')
  console.log('='.repeat(80))

  const { baseline, optimized, delta } = report.summary

  console.log('\n🌍 Overall Performance\n')

  console.log('Baseline:')
  console.log(`  Tests:         ${baseline.count}`)
  console.log(`  Avg tokens in: ${baseline.avgTokensInput.toFixed(0)}`)
  console.log(`  Avg tokens out:${baseline.avgTokensOutput.toFixed(0)}`)
  console.log(`  Avg time:      ${baseline.avgResponseTime.toFixed(0)}ms`)

  console.log('\nOptimized:')
  console.log(`  Tests:         ${optimized.count}`)
  console.log(`  Avg tokens in: ${optimized.avgTokensInput.toFixed(0)}`)
  console.log(`  Avg tokens out:${optimized.avgTokensOutput.toFixed(0)}`)
  console.log(`  Avg time:      ${optimized.avgResponseTime.toFixed(0)}ms`)

  console.log('\nDelta:')
  console.log(
    `  Tokens in:     ${delta.tokensInput > 0 ? '+' : ''}${delta.tokensInput.toFixed(0)} (${delta.tokensInputPercent.toFixed(1)}%)`,
  )
  console.log(
    `  Tokens out:    ${delta.tokensOutput > 0 ? '+' : ''}${delta.tokensOutput.toFixed(0)} (${((delta.tokensOutput / baseline.avgTokensOutput) * 100).toFixed(1)}%)`,
  )
  console.log(
    `  Time:          ${delta.responseTime > 0 ? '+' : ''}${delta.responseTime.toFixed(0)}ms (${((delta.responseTime / baseline.avgResponseTime) * 100).toFixed(1)}%)`,
  )

  // Category breakdown
  console.log('\n\n📂 By Category\n')
  console.log('-'.repeat(80))

  for (const [category, data] of report.byCategory.entries()) {
    const deltaPercent = (data.delta / data.baseline.avgTokensInput) * 100
    console.log(
      `\n${category}: ${data.baseline.avgTokensInput.toFixed(0)} → ${data.optimized.avgTokensInput.toFixed(0)} (${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%)`,
    )
  }

  // Success criteria
  console.log('\n\n✅ Success Criteria\n')
  console.log('-'.repeat(80))

  const tokenReduction = Math.abs(delta.tokensInputPercent)
  const timeChange = (delta.responseTime / baseline.avgResponseTime) * 100

  console.log(`\n1. Token reduction: ${delta.tokensInputPercent.toFixed(1)}%`)
  console.log(
    `   ${tokenReduction >= 25 && tokenReduction <= 35 ? '✅ PASS' : '⚠️  CHECK'}: Target -25% to -35%`,
  )

  console.log(`\n2. Response time: ${timeChange > 0 ? '+' : ''}${timeChange.toFixed(1)}%`)
  console.log(
    `   ${Math.abs(timeChange) <= 10 ? '✅ PASS' : '⚠️  CHECK'}: Within ±10% tolerance`,
  )

  console.log('\n3. Quality:')
  const errors = report.results.filter((r) => r.error).length
  console.log(`   ${errors === 0 ? '✅' : '❌'} No API errors (${errors} failures)`)

  const invalidJson = report.results.filter(
    (r) => !r.error && r.translated.includes('(invalid JSON)'),
  ).length
  console.log(
    `   ${invalidJson === 0 ? '✅' : '❌'} Valid JSON responses (${invalidJson} invalid)`,
  )

  console.log('\n\n💡 Recommendation\n')
  console.log('-'.repeat(80))

  if (tokenReduction >= 25 && tokenReduction <= 35 && Math.abs(timeChange) <= 10 && errors === 0) {
    console.log('\n✅ All criteria passed! Optimized prompts are ready for deployment.')
    console.log('\nNext steps:')
    console.log('1. Review sample translations for quality')
    console.log('2. Update TRANSLATION_PROMPT_VERSION=optimized in production')
    console.log('3. Monitor for 1 week')
  } else {
    console.log('\n⚠️  Some criteria not met. Review results before deployment.')
    if (tokenReduction < 25) console.log('- Token reduction below target')
    if (tokenReduction > 35) console.log('- Token reduction too aggressive')
    if (Math.abs(timeChange) > 10) console.log('- Response time variance high')
    if (errors > 0) console.log('- API errors detected')
  }

  console.log('\n' + '='.repeat(80))
}

// Main
async function main() {
  const apiKey = process.env['TEMP_OPENAI_API_KEY'] ?? process.env['OPENAI_API_KEY']

  if (!apiKey) {
    console.error('❌ Error: OpenAI API key not found')
    console.log('\nSet TEMP_OPENAI_API_KEY environment variable:')
    console.log('  export TEMP_OPENAI_API_KEY=sk-...')
    console.log('  bun run scripts/automated-ab-test.ts')
    console.log('\nOr add to .env:')
    console.log('  TEMP_OPENAI_API_KEY=sk-...')
    process.exit(1)
  }

  try {
    const report = await runABTest(apiKey)
    printReport(report)

    // Save detailed results
    const outputPath = 'output/ab-test-results.json'
    await Bun.write(
      outputPath,
      JSON.stringify(
        {
          ...report,
          byCategory: Array.from(report.byCategory.entries()).map(([k, v]) => ({ category: k, ...v })),
        },
        null,
        2,
      ),
    )
    console.log(`\n📄 Detailed results saved: ${outputPath}\n`)
  } catch (error) {
    console.error('\n❌ A/B test failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
