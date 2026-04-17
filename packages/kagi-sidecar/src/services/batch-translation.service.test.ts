import { describe, expect, it } from 'bun:test'
import { runBatchTranslation } from './batch-translation.service'
import type {
  IBrowserConnection,
  IBrowserService,
  KagiTranslateUiRequest,
  TranslateResult,
} from '~/types/browser.interface'

function createFakeBrowserService(
  translate: (request: KagiTranslateUiRequest) => Promise<TranslateResult>,
): IBrowserService & {
  launchCount: number
  openNewTabCount: number
  closeCount: number
} {
  let launchCount = 0
  let openNewTabCount = 0
  let closeCount = 0
  const connection: IBrowserConnection = { close: async () => undefined }

  const service = {
    async launch() {
      launchCount += 1
      return connection
    },
    async openNewTab() {
      openNewTabCount += 1
    },
    translate,
    async close() {
      closeCount += 1
    },
    get launchCount() {
      return launchCount
    },
    get openNewTabCount() {
      return openNewTabCount
    },
    get closeCount() {
      return closeCount
    },
  } satisfies IBrowserService & {
    launchCount: number
    openNewTabCount: number
    closeCount: number
  }

  return service
}

describe('runBatchTranslation', () => {
  it('reuses the initial tab for message[0] and opens a new tab for each subsequent message', async () => {
    const browserService = createFakeBrowserService(async (req) => ({
      translated: `VI:${req.text}`,
      finalUrl: `https://example.test/?t=${req.text}`,
    }))
    const messages: KagiTranslateUiRequest[] = [
      { text: 'a', style: 'Clear' },
      { text: 'b', style: 'Clear' },
      { text: 'c', style: 'Clear' },
    ]

    const results = await runBatchTranslation(messages, { browserService })

    expect(browserService.launchCount).toBe(1)
    expect(browserService.openNewTabCount).toBe(2) // items[1], items[2]
    expect(browserService.closeCount).toBe(1)
    expect(results).toEqual([
      { index: 0, original: 'a', translated: 'VI:a', finalUrl: 'https://example.test/?t=a' },
      { index: 1, original: 'b', translated: 'VI:b', finalUrl: 'https://example.test/?t=b' },
      { index: 2, original: 'c', translated: 'VI:c', finalUrl: 'https://example.test/?t=c' },
    ])
  })

  it('closes the browser even when translate throws (fail-fast aborts remaining items)', async () => {
    let calls = 0
    const browserService = createFakeBrowserService(async (req) => {
      calls += 1
      if (req.text === 'b') throw new Error('simulated Kagi failure')
      return { translated: `VI:${req.text}`, finalUrl: 'https://example.test/' }
    })
    const messages: KagiTranslateUiRequest[] = [
      { text: 'a', style: 'Clear' },
      { text: 'b', style: 'Clear' },
      { text: 'c', style: 'Clear' },
    ]

    await expect(runBatchTranslation(messages, { browserService })).rejects.toThrow(
      'simulated Kagi failure',
    )

    expect(calls).toBe(2) // items[2] must not run
    expect(browserService.closeCount).toBe(1) // finally must run
  })

  it('logs per-message progress when a log function is provided', async () => {
    const lines: string[] = []
    const browserService = createFakeBrowserService(async (req) => ({
      translated: `VI:${req.text}`,
      finalUrl: 'https://example.test/',
    }))

    await runBatchTranslation([{ text: 'a', style: 'Clear' }], {
      browserService,
      log: (line) => {
        lines.push(line)
      },
    })

    expect(lines.some((l) => l.includes('Message 1/1'))).toBe(true)
    expect(lines.some((l) => l.includes('Final translation output: VI:a'))).toBe(true)
  })
})
