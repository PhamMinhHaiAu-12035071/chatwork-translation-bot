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

import { existsSync, readFileSync } from 'node:fs'

// Direct imports to satisfy ESLint strict type checking
import type { IUrlBuilder } from '~/services/interfaces/url-builder.interface'
import type { IBrowserService } from '~/services/interfaces/browser.interface'
import { KagiUrlBuilder } from '~/services/url-builder.service'
import { KagiBrowserService } from '~/services/browser.service'
import { runReadingLevelSweep } from '~/services/reading-level-sweep.service'
import {
  BROWSER_CONFIG,
  DEFAULT_TRANSLATION_CONFIG,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  clampTranslationContext,
  clampInputText,
  getDefaultTranslationOptions,
} from '~/config/translation.config'
import type { ReadingLevel } from '~/types'

/**
 * Reads and validates input file for batch translation.
 * @param filePath - Path to JSON file containing array of messages
 * @returns Array of message strings
 * @throws Error with guidance if file invalid or missing
 */
export function readInputFile(filePath: string): string[] {
  // Check file exists
  if (!existsSync(filePath)) {
    throw new Error(
      `Input file not found: ${filePath}\n\n` +
        `Create the file with this format:\n` +
        `[\n` +
        `  "Message 1 to translate...",\n` +
        `  "Message 2 to translate..."\n` +
        `]\n\n` +
        `Or override the path:\n` +
        `  INPUT_FILE=./my-batch.json bun run start:local`,
    )
  }

  // Read and parse JSON
  let parsed: unknown
  try {
    const content = readFileSync(filePath, 'utf-8')
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // Validate is array
  if (!Array.isArray(parsed)) {
    throw new Error(`Input file ${filePath} must be an array of strings, got: ${typeof parsed}`)
  }

  // Validate not empty
  if (parsed.length === 0) {
    throw new Error(`Input file ${filePath} must contain at least 1 message`)
  }

  // Validate all items are strings
  for (const [index, item] of parsed.entries()) {
    if (typeof item !== 'string') {
      throw new Error(
        `Input file ${filePath} item at index ${index} must be a string, got: ${typeof item}`,
      )
    }
  }

  return parsed
}

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
  const rawInputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
  const inputText = clampInputText(rawInputText)
  const options = getDefaultTranslationOptions()

  options.translationContext =
    process.env.TRANSLATION_CONTEXT !== undefined
      ? clampTranslationContext(process.env.TRANSLATION_CONTEXT)
      : INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT

  console.log(`📝 Text cần translate: "${inputText}"`)
  console.log(`🌍 ${options.sourceLang} → ${options.targetLang}`)
  const runtimeReadingLevels: readonly ReadingLevel[] = ['c2']

  console.log('⚙️  Translation preset (Kagi UI):')
  console.log('    Translate Style:')
  console.log('        Type: Natural')
  console.log('        Formality: Vietnamese Casual')
  console.log('    Reading Level: C2')
  console.log('    Speaker: Unknown')
  console.log('    Addressee: Unknown')
  console.log('(env TRANSLATION_CONTEXT overrides brief context; empty string = no context)\n')
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
  }
}

// Execute main workflow
void main().catch((error: unknown) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
