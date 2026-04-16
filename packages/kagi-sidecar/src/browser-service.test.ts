import { describe, expect, it, mock } from 'bun:test'
import { KagiBrowserService } from './browser-service'
import type { BrowserContext, Page } from 'patchright'

function createFakeContext(pages: Page[] = []): BrowserContext {
  return {
    pages: () => pages,
    newPage: async () => {
      const page = createFakePage('about:blank')
      pages.push(page)
      return page
    },
    close: async () => undefined,
    addCookies: async () => undefined,
  } as unknown as BrowserContext
}

function createFakePage(url: string): Page {
  return {
    url: () => url,
    goto: async () => null,
    close: async () => undefined,
    keyboard: { 
      press: async () => undefined,
      down: async () => undefined,
      insertText: async () => undefined,
      type: async () => undefined,
      up: async () => undefined,
    } as Page['keyboard'],
    mouse: {} as Page['mouse'],
    evaluate: async () => undefined,
    waitForFunction: async () => ({ jsonValue: async () => true }) as any,
    waitForSelector: async () => null,
    focus: async () => undefined,
    click: async () => undefined,
    locator: () => ({ first: () => ({ scrollIntoViewIfNeeded: async () => undefined }) }) as any,
  } as unknown as Page
}

describe('KagiBrowserService.launch + close', () => {
  it('launches a persistent context, returns a BrowserConnection, and close() tears it down', async () => {
    const existingPage = createFakePage('about:blank')
    const context = createFakeContext([existingPage])
    const launchMock = mock(async () => context)

    const service = new KagiBrowserService({ launchContext: launchMock as any })
    const connection = await service.launch()

    expect(connection).toBeDefined()
    expect(launchMock).toHaveBeenCalledTimes(1)

    await service.close()
    // Second close is a no-op, not an error
    await service.close()
  })
})
