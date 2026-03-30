/**
 * Kagi Translate Automation - Production-Ready
 *
 * Clean architecture with SOLID principles (SRP, DIP, ISP)
 * Dependencies: Types → Config → Services → Main
 *
 * Usage:
 *   bun run src/index.ts (local)
 *   bun run start (Docker)
 */

// Direct imports to satisfy ESLint strict type checking
import type { IUrlBuilder } from '~/services/interfaces/url-builder.interface'
import type { IBrowserService } from '~/services/interfaces/browser.interface'
import { KagiUrlBuilder } from '~/services/url-builder.service'
import { KagiBrowserService } from '~/services/browser.service'
import {
  DEFAULT_TRANSLATION_CONFIG,
  getDefaultTranslationOptions,
} from '~/config/translation.config'

/**
 * Main translation workflow
 *
 * Clean, small, focused function following SRP
 * Depends on abstractions (IUrlBuilder, IBrowserService) following DIP
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      🌐 KAGI TRANSLATE AUTOMATION (Production-Ready)     ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Load configuration
  const inputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
  const options = getDefaultTranslationOptions()

  console.log(`📝 Text cần translate: "${inputText}"`)
  console.log(`🌍 ${options.sourceLang} → ${options.targetLang}`)
  console.log(
    `⚙️  Reading: ${options.readingLevel} | Style: ${options.style} | Formality: ${options.formality}`,
  )
  console.log(`👤 Speaker: ${options.speakerGender} | Addressee: ${options.addresseeGender}\n`)

  // Initialize services (Dependency Injection)
  const urlBuilder: IUrlBuilder = new KagiUrlBuilder()
  const browserService: IBrowserService = new KagiBrowserService()

  try {
    // Build URL
    const url = urlBuilder.build(inputText, options)
    console.log('🔗 URL built successfully\n')

    // Launch browser
    console.log('🚀 Launching Puppeteer Real Browser...')
    await browserService.launch()
    console.log('✅ Browser launched\n')

    // Translate
    console.log('🌐 Navigating to Kagi...')
    console.log('⏳ Waiting for translation result...\n')

    const translated = await browserService.translate(url)

    // Output results
    const divider = '─'.repeat(60)
    console.log('✅ TRANSLATION RESULT:')
    console.log(divider)
    console.log(`📝 Original (${options.sourceLang}):\n${inputText}\n`)
    console.log(`📝 Translated (${options.targetLang}):\n${translated}`)
    console.log(divider)
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    console.log('\n🔒 Closing browser...')
    await browserService.close()
    console.log('✅ Complete!\n')
  }
}

// Execute main workflow
void main().catch((error: unknown) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
