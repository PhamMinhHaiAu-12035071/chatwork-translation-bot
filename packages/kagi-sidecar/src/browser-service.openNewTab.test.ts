import { describe, expect, it } from 'bun:test'
import type { BrowserContext, Page } from 'patchright'
import { KagiBrowserService, KagiSidecarError } from './browser-service'

function createPageMock(id: string) {
  const closed = { value: false }
  return {
    id,
    closed,
    page: {
      url: () => `about:blank#${id}`,
      close: async () => {
        closed.value = true
      },
    } as unknown as Page,
  }
}

describe('KagiBrowserService.openNewTab', () => {
  it('opens a new page, swaps the connection pointer, then closes the old page', async () => {
    const first = createPageMock('first')
    const second = createPageMock('second')
    let createdPages: Page[] = [first.page]

    const context = {
      pages: () => createdPages,
      newPage: async () => {
        createdPages = [...createdPages, second.page]
        return second.page
      },
      close: async () => undefined,
    } as unknown as BrowserContext

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()

    await service.openNewTab()

    expect(first.closed.value).toBe(true) // old page closed
    expect(second.closed.value).toBe(false) // new page still open
    // connection now references the second page
    expect(service['connection']?.getPage()).toBe(second.page)
  })

  it('throws KagiSidecarError(UI_INTERACTION) when called before launch', async () => {
    const service = new KagiBrowserService({
      launchContext: async () => ({}) as BrowserContext,
      ensureUserDataDir: async () => undefined,
    })

    await expect(service.openNewTab()).rejects.toBeInstanceOf(KagiSidecarError)
  })
})
