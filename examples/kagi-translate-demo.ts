/**
 * Kagi Translate API Demo (Experimental)
 *
 * Proof-of-concept using fake session token approach.
 * Based on successful Postman test with session_token="e".
 *
 * NOT FOR PRODUCTION - API may reject this approach anytime.
 *
 * Usage: bun examples/kagi-translate-demo.ts
 */

// No imports needed - using Bun built-ins only

/**
 * Kagi Translate API Request Payload (minimal subset)
 */
interface TranslateRequest {
  text: string
  from: string
  to: string
  stream: boolean
  session_token: string
  translation_style: 'natural' | 'literal'
  formality: 'default' | 'formal' | 'informal' | 'prefer_more' | 'prefer_less'
}

/**
 * Kagi Translate API Response (non-streaming)
 */
interface TranslateResponse {
  translation?: string
  detectedLanguage?: {
    iso: string
    label: string
  }
  error?: string
  details?: Array<{
    field: string
    message: string
  }>
}

// API Configuration
const KAGI_TRANSLATE_ENDPOINT = 'https://translate.kagi.com/api/translate'

// Demo Input
const DEMO_TEXT = "Hello, how are you today? I hope you're having a wonderful day!"
const SOURCE_LANGUAGE = 'en'
const TARGET_LANGUAGE = 'vi'

// Experimental: fake session token (based on successful Postman test)
const FAKE_SESSION_TOKEN = 'demo'

/**
 * Translate text using Kagi Translate API (experimental approach)
 */
async function translateText(text: string, from: string, to: string): Promise<TranslateResponse> {
  // Construct minimal payload
  const payload: TranslateRequest = {
    text,
    from,
    to,
    stream: false, // Non-streaming for simplicity
    session_token: FAKE_SESSION_TOKEN,
    translation_style: 'natural',
    formality: 'default',
  }

  // Make POST request
  const response = await fetch(KAGI_TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  // Check HTTP status
  if (!response.ok) {
    const errorText = await response.text()
    let errorData: TranslateResponse

    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { error: `HTTP ${response.status}: ${errorText}` }
    }

    return errorData
  }

  // Parse JSON response
  const data: TranslateResponse = await response.json()
  return data
}

/**
 * Display translation result with pretty formatting
 */
function displayResult(
  input: string,
  output: string | undefined,
  sourceLang: string,
  targetLang: string,
  detectedLang?: { iso: string; label: string },
): void {
  console.log('\n' + '━'.repeat(60))
  console.log('🌐 Kagi Translate Demo (Experimental)')
  console.log('━'.repeat(60) + '\n')

  console.log(`📝 Input (${sourceLang}):`)
  console.log(`   ${input}\n`)

  if (detectedLang && detectedLang.iso !== sourceLang) {
    console.log(`🔍 Detected: ${detectedLang.label} (${detectedLang.iso})\n`)
  }

  console.log(`🔄 Translation (${targetLang}):`)
  if (output) {
    console.log(`   ${output}\n`)
    console.log('✅ Success!')
  } else {
    console.log('   ❌ No translation returned\n')
  }

  console.log('━'.repeat(60) + '\n')
}

/**
 * Display error with helpful context
 */
function displayError(error: unknown, response?: TranslateResponse): void {
  console.log('\n' + '━'.repeat(60))
  console.log('❌ Translation Failed')
  console.log('━'.repeat(60) + '\n')

  if (response?.error) {
    console.log(`Error: ${response.error}`)

    if (response.details) {
      console.log('\nDetails:')
      for (const detail of response.details) {
        console.log(`  - ${detail.field}: ${detail.message}`)
      }
    }
  } else if (error instanceof Error) {
    console.log(`Error: ${error.message}`)
  } else {
    console.log(`Error: ${String(error)}`)
  }

  console.log('\n💡 Troubleshooting:')
  console.log('  1. Check internet connection')
  console.log('  2. Verify API endpoint is accessible')
  console.log('  3. Try different session_token value')
  console.log('  4. Check if rate limited (wait 60s)')
  console.log('\n' + '━'.repeat(60) + '\n')
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('\n🚀 Starting Kagi Translate Demo...\n')
  console.log(`   Text: "${DEMO_TEXT}"`)
  console.log(`   From: ${SOURCE_LANGUAGE}`)
  console.log(`   To: ${TARGET_LANGUAGE}`)
  console.log(`   Session Token: ${FAKE_SESSION_TOKEN} (fake)\n`)
  console.log('⏳ Translating...')

  try {
    const result = await translateText(DEMO_TEXT, SOURCE_LANGUAGE, TARGET_LANGUAGE)

    // Check for API error in response
    if (result.error) {
      displayError(new Error('API returned error'), result)
      process.exit(1)
    }

    // Display successful translation
    displayResult(
      DEMO_TEXT,
      result.translation,
      SOURCE_LANGUAGE,
      TARGET_LANGUAGE,
      result.detectedLanguage,
    )
  } catch (error) {
    displayError(error)
    process.exit(1)
  }
}

// Run main function
await main()
