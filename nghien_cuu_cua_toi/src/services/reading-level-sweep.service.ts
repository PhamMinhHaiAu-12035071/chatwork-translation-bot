import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { IBrowserService } from './interfaces/browser.interface'
import type { ReadingLevel, TranslationOptions } from '~/types'
import { READING_LEVELS } from '~/types'

export interface ReadingLevelSweepResult {
  readingLevel: ReadingLevel
  translated: string
  /** Address bar URL when that run finished (before browser close) */
  finalUrl: string
}

export interface ReadingLevelSweepDependencies {
  urlBuilder: IUrlBuilder
  browserService: IBrowserService
  wait?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

async function delayMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function runReadingLevelSweep(
  inputText: string,
  baseOptions: TranslationOptions,
  dependencies: ReadingLevelSweepDependencies,
  delayBetweenLevelsMs: number,
  readingLevels: readonly ReadingLevel[] = READING_LEVELS,
): Promise<ReadingLevelSweepResult[]> {
  const { urlBuilder, browserService, wait = delayMs, log } = dependencies
  const results: ReadingLevelSweepResult[] = []

  await browserService.launch()

  try {
    for (const [index, readingLevel] of readingLevels.entries()) {
      const options: TranslationOptions = {
        ...baseOptions,
        readingLevel,
      }

      log?.(`\n🔁 Reading Level ${index + 1}/${readingLevels.length}: ${readingLevel}`)

      const url = urlBuilder.build(inputText, options)
      const { translated, finalUrl } = await browserService.translate(url, options)

      results.push({
        readingLevel,
        translated,
        finalUrl,
      })

      if (index < readingLevels.length - 1) {
        log?.(`⏸️  Waiting ${delayBetweenLevelsMs}ms before next reading level...`)
        await wait(delayBetweenLevelsMs)
      }
    }

    return results
  } finally {
    await browserService.close()
  }
}
