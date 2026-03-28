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
