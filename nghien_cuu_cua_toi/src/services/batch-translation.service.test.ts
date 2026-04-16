import { describe, expect, it, mock } from 'bun:test'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { IBrowserService } from './interfaces/browser.interface'
import { runBatchTranslation } from './batch-translation.service'
import { getDefaultTranslationOptions } from '~/config'

describe('runBatchTranslation', () => {
  it('should translate all messages sequentially with correct tab lifecycle', async () => {
    const messages = ['Message 1', 'Message 2', 'Message 3']
    const translatedMessages: string[] = []
    const openNewTabCalls: number[] = []
    let translateCallCount = 0

    const urlBuilder: IUrlBuilder = {
      build: mock((text: string) => `url-${text}`),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      openNewTab: mock(async () => {
        openNewTabCalls.push(translateCallCount)
      }),
      translate: mock(async (_url: string, _options, sourceText?: string) => {
        translateCallCount++
        const result = `translated-${sourceText}`
        translatedMessages.push(result)
        return {
          translated: result,
          finalUrl: `https://example.com/${sourceText}`,
        }
      }),
      close: mock(async () => {}),
    }

    const results = await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
      log: () => {},
    })

    // Verify all messages translated
    expect(translatedMessages).toEqual([
      'translated-Message 1',
      'translated-Message 2',
      'translated-Message 3',
    ])

    // Verify results structure
    expect(results.length).toBe(3)
    expect(results[0].index).toBe(0)
    expect(results[0].original).toBe('Message 1')
    expect(results[1].index).toBe(1)
    expect(results[2].index).toBe(2)

    // Verify openNewTab called before item[1] and item[2] (not item[0])
    expect(openNewTabCalls).toEqual([1, 2]) // Called after translate 1 and 2, before 2 and 3

    // Verify launch and close called once each
    expect(browserService.launch).toHaveBeenCalledTimes(1)
    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should handle single message without opening new tab', async () => {
    const messages = ['Single message']

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      openNewTab: mock(async () => {}),
      translate: mock(async () => ({
        translated: 'translated-single',
        finalUrl: 'https://example.com/single',
      })),
      close: mock(async () => {}),
    }

    const results = await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
    })

    expect(results.length).toBe(1)
    expect(browserService.openNewTab).not.toHaveBeenCalled()
  })

  it('should abort and close browser on first translation error', async () => {
    const messages = ['Message 1', 'Message 2', 'Message 3']

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      openNewTab: mock(async () => {}),
      translate: mock(async (_url, _options, sourceText?: string) => {
        if (sourceText === 'Message 2') {
          throw new Error('Translation failed for Message 2')
        }
        return {
          translated: `translated-${sourceText}`,
          finalUrl: 'https://example.com',
        }
      }),
      close: mock(async () => {}),
    }

    await expect(async () => {
      await runBatchTranslation(messages, getDefaultTranslationOptions(), {
        urlBuilder,
        browserService,
      })
    }).toThrow('Translation failed for Message 2')

    // Verify browser was closed despite error
    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should log progress messages for each item', async () => {
    const messages = ['A', 'B']
    const logMessages: string[] = []

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      openNewTab: mock(async () => {}),
      translate: mock(async () => ({
        translated: 'result',
        finalUrl: 'https://example.com',
      })),
      close: mock(async () => {}),
    }

    await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
      log: (msg: string) => {
        logMessages.push(msg)
      },
    })

    expect(logMessages.some((msg) => msg.includes('1/2'))).toBe(true)
    expect(logMessages.some((msg) => msg.includes('2/2'))).toBe(true)
  })
})
