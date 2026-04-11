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
import { runReadingLevelSweep } from '~/services/reading-level-sweep.service'
import {
  BROWSER_CONFIG,
  DEFAULT_TRANSLATION_CONFIG,
  clampTranslationContext,
  getDefaultTranslationOptions,
} from '~/config/translation.config'
import type { ReadingLevel } from '~/types'

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

  // Load configuration (`bun run start:local` preset — override context via TRANSLATION_CONTEXT)
  const inputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
  const options = getDefaultTranslationOptions()

  options.style = 'natural'
  options.formality = 'vietnamese_casual'
  options.readingLevel = 'c2'
  options.speakerGender = 'unknown'
  options.addresseeGender = 'unknown'
  options.translationContext =
    process.env.TRANSLATION_CONTEXT !== undefined
      ? clampTranslationContext(process.env.TRANSLATION_CONTEXT)
      : 'Hello'

  console.log(`📝 Text cần translate: "${inputText}"`)
  console.log(`🌍 ${options.sourceLang} → ${options.targetLang}`)
  const runtimeReadingLevels: readonly ReadingLevel[] = ['c2']

  console.log(
    `⚙️  Preset: Natural | Vietnamese Casual | C2 | Speaker Unknown | Addressee Unknown | context "Hello" (env TRANSLATION_CONTEXT overrides context)`,
  )
  console.log(
    `⚙️  Reading sweep: ${runtimeReadingLevels.join(' -> ')} | Style: ${options.style} | Formality: ${options.formality}`,
  )
  console.log(`👤 Speaker: ${options.speakerGender} | Addressee: ${options.addresseeGender}`)
  console.log(
    `📎 Translation context: ${options.translationContext === '' ? '(none)' : `"${options.translationContext}"`}\n`,
  )

  // Initialize services (Dependency Injection)
  const urlBuilder: IUrlBuilder = new KagiUrlBuilder()
  const browserService: IBrowserService = new KagiBrowserService()

  try {
    console.log('🚀 Launching sequential reading-level sweep...')
    console.log(`⏳ Delay between levels: ${BROWSER_CONFIG.READING_LEVEL_SWEEP_DELAY_MS}ms\n`)

    const results = await runReadingLevelSweep(
      inputText,
      options,
      {
        urlBuilder,
        browserService,
        log: (message: string) => {
          console.log(message)
        },
      },
      BROWSER_CONFIG.READING_LEVEL_SWEEP_DELAY_MS,
      runtimeReadingLevels,
    )

    const divider = '─'.repeat(60)
    console.log('\n✅ READING LEVEL SWEEP RESULT:')
    for (const result of results) {
      console.log(divider)
      console.log(`📝 Original (${options.sourceLang}):\n${inputText}\n`)
      console.log(`📚 Reading Level: ${result.readingLevel}`)
      console.log(`🔗 Final URL (address bar when done):\n${result.finalUrl}`)
      console.log(`📝 Translated (${options.targetLang}):\n${result.translated}`)
    }
    console.log(divider)
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    console.log('✅ Complete!\n')
  }
}

// Execute main workflow
void main().catch((error: unknown) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
