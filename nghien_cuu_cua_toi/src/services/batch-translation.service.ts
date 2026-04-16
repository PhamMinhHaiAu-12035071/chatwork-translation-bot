import type { IBrowserService } from './interfaces/browser.interface'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { TranslationOptions } from '~/types'

export interface BatchTranslationResult {
  index: number
  original: string
  translated: string
  finalUrl: string
}

export interface BatchTranslationDeps {
  browserService: IBrowserService
  urlBuilder: IUrlBuilder
  log?: (message: string) => void
}

/**
 * Runs batch translation for an array of messages.
 *
 * Flow:
 * 1. Launch browser once
 * 2. Item[0]: translate in current tab
 * 3. Item[i>0]: openNewTab() → translate → (prev tab auto-closed by openNewTab)
 * 4. Close browser after all items complete
 *
 * Error policy: Fail-fast — abort entire batch on first error
 *
 * @param messages - Array of text strings to translate
 * @param options - Translation options (global, applied to all messages)
 * @param deps - Dependencies (browserService, urlBuilder, optional log)
 * @returns Array of translation results with index and metadata
 * @throws Error if any translation fails (browser closed in finally block)
 */
export async function runBatchTranslation(
  messages: string[],
  options: TranslationOptions,
  deps: BatchTranslationDeps,
): Promise<BatchTranslationResult[]> {
  const { browserService, urlBuilder, log } = deps
  const results: BatchTranslationResult[] = []

  await browserService.launch()

  try {
    for (const [index, message] of messages.entries()) {
      log?.(`\n🔁 Message ${index + 1}/${messages.length}`)

      // Item[0]: reuse current tab; Item[i>0]: open new tab (closes previous)
      if (index > 0) {
        await browserService.openNewTab?.()
      }

      const url = urlBuilder.buildNavigation(options)
      const { translated, finalUrl } = await browserService.translate(url, options, message)

      results.push({
        index,
        original: message,
        translated,
        finalUrl,
      })

      log?.(`Final translation output: ${translated}`)
    }

    return results
  } finally {
    await browserService.close()
  }
}
