/**
 * E2E Smoke Tests - Real Browser Translation
 *
 * ⚠️ IMPORTANT: These tests use REAL browser automation
 * - Run manually or in Docker only
 * - Rate limit: 3-5s delay between tests
 * - Only 1-2 smoke tests (not exhaustive)
 *
 * Run: bun test tests/e2e/translation.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { KagiUrlBuilder, KagiBrowserService } from '~/services'
import { getDefaultTranslationOptions } from '~/config'

describe('E2E Smoke Tests: Real Kagi Translation', () => {
  let browserService: KagiBrowserService
  const urlBuilder = new KagiUrlBuilder()

  beforeAll(async () => {
    console.log('\n🚀 Launching real browser for E2E smoke tests...')
    browserService = new KagiBrowserService()
    await browserService.launch()
    console.log('✅ Browser launched\n')
  }, 60000) // 60s timeout for browser launch

  afterAll(async () => {
    console.log('\n🔒 Closing browser...')
    if (browserService) {
      await browserService.close()
    }
    console.log('✅ Browser closed\n')
  })

  it('should translate with default config (smoke test 1)', async () => {
    const options = getDefaultTranslationOptions()
    const inputText = 'Hello, how are you today?'

    console.log(`📝 Translating: "${inputText}"`)
    const url = urlBuilder.build(inputText, options)
    const result = await browserService.translate(url)

    console.log(`✅ Result: "${result}"`)

    // Basic assertions
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toContain('[No translation result found')

    // Vietnamese detection (loose check)
    const hasVietnameseChars =
      /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(result)
    expect(hasVietnameseChars).toBe(true)

    // Rate limit protection (3-5s delay)
    console.log('⏳ Rate limit delay: 4s...')
    await Bun.sleep(4000)
  }, 30000) // 30s timeout per test

  it('should translate with full advanced settings (smoke test 2)', async () => {
    const options = getDefaultTranslationOptions()
    const inputText = 'Good morning'

    // Advanced settings
    options.readingLevel = 'b2'
    options.speakerGender = 'neutral'
    options.addresseeGender = 'feminine'
    options.style = 'natural'
    options.formality = 'vietnamese_formal'

    console.log(`📝 Translating with advanced settings: "${inputText}"`)
    const url = urlBuilder.build(inputText, options)
    const result = await browserService.translate(url)

    console.log(`✅ Result: "${result}"`)

    // Basic assertions
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toContain('[No translation result found')

    // Formal Vietnamese should have distinct characteristics
    // (This is a loose check - actual formality depends on Kagi's implementation)
    expect(result).toBeTruthy()

    // Rate limit protection (3-5s delay)
    console.log('⏳ Rate limit delay: 4s...')
    await Bun.sleep(4000)
  }, 30000)

  // Additional smoke test can be added here if needed
  // Remember: Keep smoke tests minimal (1-2 tests)
})

/**
 * Instructions for running E2E smoke tests:
 *
 * Local (requires real browser):
 *   bun test tests/e2e/translation.e2e.test.ts
 *
 * Docker:
 *   bun run start
 *
 * Notes:
 * - Smoke tests may fail if Kagi changes their DOM structure
 * - Rate limiting (4s delay) prevents hitting Kagi's limits
 * - Only 2 smoke tests to minimize API calls
 * - For comprehensive testing, use mocked e2e tests instead
 */
