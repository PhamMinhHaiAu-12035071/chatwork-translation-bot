import { describe, expect, it, mock } from 'bun:test'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { IBrowserService, IBrowserConnection } from './interfaces/browser.interface'
import { runReadingLevelSweep } from './reading-level-sweep.service'
import { getDefaultTranslationOptions } from '~/config'
import { READING_LEVELS } from '~/types'

describe('runReadingLevelSweep', () => {
  it('should translate every reading level in canonical order with delay between steps', async () => {
    const expectedLevels = [...READING_LEVELS]
    const builtLevels: string[] = []
    const translatedLevels: string[] = []
    const waitedMs: number[] = []

    const urlBuilder: IUrlBuilder = {
      build(text, options) {
        return `${text}-${options.readingLevel}`
      },
      buildNavigation(options) {
        builtLevels.push(options.readingLevel)
        return `nav-${options.readingLevel}`
      },
    }

    const connection: IBrowserConnection = {
      close: mock(async () => {}),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => connection),
      translate: mock(async (_url: string, options, _sourceText?: string) => {
        const readingLevel = options?.readingLevel ?? 'missing'
        translatedLevels.push(readingLevel)
        return {
          translated: `translated-${readingLevel}`,
          finalUrl: `https://example.com/final?level=${readingLevel}`,
        }
      }),
      close: mock(async () => {}),
    }

    const results = await runReadingLevelSweep(
      'Hello',
      getDefaultTranslationOptions(),
      {
        urlBuilder,
        browserService,
        wait: async (ms: number) => {
          waitedMs.push(ms)
        },
      },
      250,
    )

    expect(builtLevels).toEqual(expectedLevels)
    expect(translatedLevels).toEqual(expectedLevels)
    expect(waitedMs).toEqual([250, 250, 250, 250, 250, 250])
    expect(results.map((result) => result.readingLevel)).toEqual(expectedLevels)
    expect(results.at(-1)?.translated).toBe('translated-c2')
    expect(browserService.launch).toHaveBeenCalledTimes(1)
    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should still close the browser if one reading level fails', async () => {
    const urlBuilder: IUrlBuilder = {
      build(text, options) {
        return `${text}-${options.readingLevel}`
      },
      buildNavigation(options) {
        return `nav-${options.readingLevel}`
      },
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({
        close: mock(async () => {}),
      })),
      translate: mock(async (_url: string, options, _sourceText?: string) => {
        if (options?.readingLevel === 'b1') {
          throw new Error('b1 failed')
        }

        const level = options?.readingLevel ?? 'missing'
        return {
          translated: `translated-${level}`,
          finalUrl: `https://example.com/final?level=${level}`,
        }
      }),
      close: mock(async () => {}),
    }

    await expect(
      runReadingLevelSweep(
        'Hello',
        getDefaultTranslationOptions(),
        {
          urlBuilder,
          browserService,
          wait: async () => {},
        },
        250,
      ),
    ).rejects.toThrow('b1 failed')

    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should translate only the explicitly requested reading levels', async () => {
    const builtLevels: string[] = []
    const translatedLevels: string[] = []

    const urlBuilder: IUrlBuilder = {
      build(text, options) {
        builtLevels.push(options.readingLevel)
        return `${text}-${options.readingLevel}`
      },
      buildNavigation(options) {
        builtLevels.push(options.readingLevel)
        return `nav-${options.readingLevel}`
      },
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({
        close: mock(async () => {}),
      })),
      translate: mock(async (_url: string, options, _sourceText?: string) => {
        const readingLevel = options?.readingLevel ?? 'missing'
        translatedLevels.push(readingLevel)
        return {
          translated: `translated-${readingLevel}`,
          finalUrl: `https://example.com/final?level=${readingLevel}`,
        }
      }),
      close: mock(async () => {}),
    }

    const results = await runReadingLevelSweep(
      'Hello',
      getDefaultTranslationOptions(),
      {
        urlBuilder,
        browserService,
      },
      250,
      ['c2'],
    )

    expect(builtLevels).toEqual(['c2'])
    expect(translatedLevels).toEqual(['c2'])
    expect(results).toEqual([
      {
        readingLevel: 'c2',
        translated: 'translated-c2',
        finalUrl: 'https://example.com/final?level=c2',
      },
    ])
  })
})
