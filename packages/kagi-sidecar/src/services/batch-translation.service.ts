import type { IBrowserService, KagiTranslateUiRequest } from '~/types/browser.interface'

export interface BatchTranslationResult {
  index: number
  original: string
  translated: string
  finalUrl: string
}

export interface BatchTranslationDeps {
  browserService: IBrowserService
  log?: (message: string) => void
}

export async function runBatchTranslation(
  messages: readonly KagiTranslateUiRequest[],
  deps: BatchTranslationDeps,
): Promise<BatchTranslationResult[]> {
  const { browserService, log } = deps
  const results: BatchTranslationResult[] = []

  await browserService.launch()

  try {
    for (const [index, message] of messages.entries()) {
      log?.(`\n🔁 Message ${String(index + 1)}/${String(messages.length)}`)

      if (index > 0) {
        await browserService.openNewTab?.()
      }

      const { translated, finalUrl } = await browserService.translate(message)

      results.push({
        index,
        original: message.text,
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
