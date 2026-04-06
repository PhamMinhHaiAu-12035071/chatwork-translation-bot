#!/usr/bin/env bun
// Measure exact token counts for baseline translation prompts

import { buildSingleCallPrompts } from '../packages/translation-prompt/src/translation-prompt'
import type { TranslationStyle } from '@chatwork-bot/core'

// Sample test message (medium length, includes romanization)
const SAMPLE_TEXT = `佐々木さんにご確認いただいた件ですが、デキスパート基本部の方で進めていただくことになりました。2nd開発チームと連携して進めます。MTGは来週木曜日の午後2時からです。よろしくお願いいたします。`

const SAMPLE_KEYWORDS = [
  '[SASAKI_1]|佐々木',
  '[DEXPERT_1]|デキスパート基本部',
]

const KEYWORD_SYSTEM_HINT = `## Sensitive Term Placeholders
The following placeholders represent sensitive terms.
Preserve them UNCHANGED in your translation output.
- [SASAKI_1]: person name (proper noun)
- [DEXPERT_1]: company or organization name (proper noun)`

const SAMPLE_ROOM_CONTEXT = `Project: Internal development coordination
Team members:
- Sasaki-san: Project lead (senior)
- Tanaka-san: Backend developer
Domain: Software development, agile workflow`

interface TokenMeasurement {
  provider: string
  systemTokens: number
  userTokens: number
  totalTokens: number
  model: string
}

async function measureWithGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<TokenMeasurement | null> {
  const apiKey = process.env['GEMINI_API_KEY']
  
  if (!apiKey) {
    console.log('⚠️  GEMINI_API_KEY not set, skipping Gemini measurement')
    return null
  }
  
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const gemini = new GoogleGenerativeAI(apiKey)
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    
    // Gemini counts tokens for the full conversation
    const result = await model.countTokens({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
    })
    
    return {
      provider: 'Gemini',
      systemTokens: result.totalTokens, // Gemini gives us total only
      userTokens: 0, // Not separately reported
      totalTokens: result.totalTokens,
      model: 'gemini-2.0-flash-exp',
    }
  } catch (error) {
    console.error('❌ Gemini measurement failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}

async function measureWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<TokenMeasurement | null> {
  const apiKey = process.env['OPENAI_API_KEY']
  
  if (!apiKey) {
    console.log('⚠️  OPENAI_API_KEY not set, skipping OpenAI measurement')
    return null
  }
  
  try {
    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey })
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]
    
    // Make minimal completion to get token counts
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1, // Minimal generation
    })
    
    return {
      provider: 'OpenAI',
      systemTokens: completion.usage?.prompt_tokens ?? 0,
      userTokens: 0, // OpenAI reports total prompt tokens
      totalTokens: completion.usage?.total_tokens ?? 0,
      model: 'gpt-4o-mini',
    }
  } catch (error) {
    console.error('❌ OpenAI measurement failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}

async function measurePrompt(
  scenario: string,
  style: TranslationStyle,
  roomContext?: string,
  keywordHint?: string,
): Promise<void> {
  console.log(`\n📊 Measuring: ${scenario}`)
  console.log('─'.repeat(60))
  
  const prompts = buildSingleCallPrompts(
    SAMPLE_TEXT,
    style,
    roomContext,
    keywordHint,
  )
  
  console.log(`System prompt length: ${prompts.system.length} chars`)
  console.log(`User prompt length: ${prompts.user.length} chars`)
  
  // Measure with both providers
  const measurements: TokenMeasurement[] = []
  
  const geminiResult = await measureWithGemini(prompts.system, prompts.user)
  if (geminiResult) measurements.push(geminiResult)
  
  const openaiResult = await measureWithOpenAI(prompts.system, prompts.user)
  if (openaiResult) measurements.push(openaiResult)
  
  if (measurements.length === 0) {
    console.log('❌ No measurements available (missing API keys)')
    return
  }
  
  // Display results
  for (const m of measurements) {
    console.log(`\n${m.provider} (${m.model}):`)
    console.log(`  Total tokens: ${m.totalTokens}`)
  }
}

async function main() {
  console.log('🔍 Translation Prompt Token Analysis')
  console.log('='.repeat(60))
  console.log('\nThis script measures exact token counts using provider APIs.')
  console.log('Set GEMINI_API_KEY and/or OPENAI_API_KEY to enable measurements.\n')
  
  // Scenario 1: Minimal (no context, no keywords)
  await measurePrompt(
    'Minimal (no context, no keywords) - NATURAL_CASUAL',
    'NATURAL_CASUAL',
  )
  
  // Scenario 2: With room context
  await measurePrompt(
    'With room context - NATURAL_CASUAL',
    'NATURAL_CASUAL',
    SAMPLE_ROOM_CONTEXT,
  )
  
  // Scenario 3: With room context + keywords
  await measurePrompt(
    'With room context + keywords - NATURAL_CASUAL',
    'NATURAL_CASUAL',
    SAMPLE_ROOM_CONTEXT,
    KEYWORD_SYSTEM_HINT,
  )
  
  // Scenario 4: PROFESSIONAL_BUSINESS style
  await measurePrompt(
    'With room context + keywords - PROFESSIONAL_BUSINESS',
    'PROFESSIONAL_BUSINESS',
    SAMPLE_ROOM_CONTEXT,
    KEYWORD_SYSTEM_HINT,
  )
  
  // Scenario 5: TECHNICAL style
  await measurePrompt(
    'With room context + keywords - TECHNICAL',
    'TECHNICAL',
    SAMPLE_ROOM_CONTEXT,
    KEYWORD_SYSTEM_HINT,
  )
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Token measurement complete!')
  console.log('\n📝 Next steps:')
  console.log('1. Review measurements above')
  console.log('2. Update TOKEN_ANALYSIS.md with exact counts')
  console.log('3. Compare against estimated baseline (~1,350-1,500 tokens)')
  console.log('4. Document any discrepancies\n')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
