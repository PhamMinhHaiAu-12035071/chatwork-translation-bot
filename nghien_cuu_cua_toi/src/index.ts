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
import { runBatchTranslation } from '~/services/batch-translation.service'
import {
  INPUT_FILE_ENV,
  INPUT_FILE_DEFAULT_PATH,
  INPUT_FILE_DOCKER_PATH,
  clampTranslationContext,
  clampInputText,
  getDefaultTranslationOptions,
} from '~/config/translation.config'

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
 * Main batch translation workflow
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      🌐 KAGI BATCH TRANSLATE AUTOMATION                   ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Resolve input file path
  const isDocker = process.env.NODE_ENV === 'production'
  const defaultPath = isDocker ? INPUT_FILE_DOCKER_PATH : INPUT_FILE_DEFAULT_PATH
  const inputFilePath = process.env[INPUT_FILE_ENV] ?? defaultPath

  console.log(`📁 Input file: ${inputFilePath}\n`)

  // Read and validate messages
  let messages: string[]
  try {
    messages = readInputFile(inputFilePath)
  } catch (error) {
    console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // Clamp each message to max length
  const clampedMessages = messages.map((msg) => clampInputText(msg))

  console.log(`✅ Loaded ${messages.length} message(s) from ${inputFilePath}`)

  // Load translation options
  const options = getDefaultTranslationOptions()
  options.translationContext =
    process.env.TRANSLATION_CONTEXT !== undefined
      ? clampTranslationContext(process.env.TRANSLATION_CONTEXT)
      : ''

  console.log(`🌍 ${options.sourceLang} → ${options.targetLang}`)
  console.log('⚙️  Translation preset:')
  console.log(`    Style: ${options.style}`)
  console.log(`    Formality: ${options.formality}`)
  console.log(`    Reading Level: ${options.readingLevel}`)
  console.log(`    Speaker: ${options.speakerGender}`)
  console.log(`    Addressee: ${options.addresseeGender}`)
  console.log(
    `    Context: ${options.translationContext === '' ? '(none)' : `"${options.translationContext}"`}\n`,
  )

  // Initialize services
  const urlBuilder: IUrlBuilder = new KagiUrlBuilder()
  const browserService: IBrowserService = new KagiBrowserService()

  try {
    console.log(`🚀 Launching batch translation (${messages.length} messages)...\n`)

    const results = await runBatchTranslation(clampedMessages, options, {
      urlBuilder,
      browserService,
      log: (message: string) => {
        console.log(message)
      },
    })

    // Print results
    const divider = '─'.repeat(60)
    console.log(`\n✅ BATCH COMPLETE: ${results.length}/${messages.length} messages translated\n`)

    for (const result of results) {
      console.log(divider)
      console.log(`📝 Message ${result.index + 1}/${results.length}`)
      console.log(`📝 Original: ${result.original}`)
      console.log(`📝 Translated: ${result.translated}`)
      console.log(`🔗 Final URL: ${result.finalUrl}`)
    }
    console.log(divider)
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  }
}

// Execute main workflow (skip during tests)
if (import.meta.main) {
  void main().catch((error: unknown) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
}
