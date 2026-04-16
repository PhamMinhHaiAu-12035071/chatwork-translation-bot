import { describe, expect, it, mock } from 'bun:test'
import { KagiBrowserService, KagiSidecarError } from './browser-service'
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

describe('KagiBrowserService.verifyStartupSession', () => {
  it('sets isLoginVerified=true when /settings renders the logout link', async () => {
    const pages: Page[] = []
    const context = {
      pages: () => pages,
      newPage: async () => {
        const page = fakeAuthenticatedPage()
        pages.push(page)
        return page
      },
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    function fakeAuthenticatedPage(): Page {
      return {
        url: () => 'https://kagi.com/settings',
        goto: async () => null,
        evaluate: async (_fn: unknown, selectors: unknown) => {
          // Simulate an authenticated DOM
          return { hasLogout: true, hasSigninEmail: false, hasSigninQr: false }
        },
      } as unknown as Page
    }

    pages.push(fakeAuthenticatedPage())

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()
    await service.verifyStartupSession()

    expect(service.getHealthSnapshot().ready).toBe(true)
  })

  it('throws KagiSidecarError(UI_INTERACTION) when /settings shows the signin DOM', async () => {
    function fakeUnauthenticatedPage(): Page {
      return {
        url: () => 'https://kagi.com/settings',
        goto: async () => null,
        evaluate: async () => ({ hasLogout: false, hasSigninEmail: true, hasSigninQr: false }),
      } as unknown as Page
    }

    const pages: Page[] = [fakeUnauthenticatedPage()]
    const context = {
      pages: () => pages,
      newPage: async () => fakeUnauthenticatedPage(),
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()

    await expect(service.verifyStartupSession()).rejects.toBeInstanceOf(KagiSidecarError)
    expect(service.getHealthSnapshot().ready).toBe(false)
  })
})

describe('KagiBrowserService.translate', () => {
  it('runs the two-phase flow and returns translated text + final url', async () => {
    const pages: Page[] = []

    function fakePage(): Page {
      let currentUrl = 'https://translate.kagi.com/?from=auto&to=vi&text=xin%20chao'
      return {
        url: () => currentUrl,
        goto: async (url: string) => {
          currentUrl = url
          return null
        },
        evaluate: async (fn: unknown, _payload: unknown) => {
          if (typeof fn === 'function') return {} as unknown
          return {}
        },
        waitForFunction: async () => ({ jsonValue: async () => 'ready' }) as unknown,
        waitForSelector: async () => null,
        focus: async () => undefined,
        click: async () => undefined,
        keyboard: {
          press: async () => undefined,
          down: async () => undefined,
          insertText: async () => undefined,
          type: async () => undefined,
          up: async () => undefined,
        } as Page['keyboard'],
        mouse: {
          click: async () => undefined,
          move: async () => undefined,
          down: async () => undefined,
          up: async () => undefined,
          dblclick: async () => undefined,
          wheel: async () => undefined,
        } as Page['mouse'],
        locator: () =>
          ({
            first: () => ({
              scrollIntoViewIfNeeded: async () => undefined,
              pressSequentially: async () => undefined,
              fill: async () => undefined,
            }),
          }) as unknown,
        close: async () => undefined,
      } as unknown as Page
    }

    const page = fakePage()
    pages.push(page)
    const context = {
      pages: () => pages,
      newPage: async () => page,
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    const fakeHumanInteraction = {
      click: async () => undefined,
      clickByTextContent: async () => undefined,
      typeIntoTextarea: async () => undefined,
      typeIntoContentEditable: async () => undefined,
      dragSlider: async () => undefined,
      chunkPaste: async () => undefined,
    }

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
      humanInteraction: fakeHumanInteraction,
      sleep: async () => undefined,
    })

    await service.launch()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    ;(service as any)['isLoginVerified'] = true

    // Stub scrape to return deterministic text
    ;(service as unknown as { scrapeTranslatedText: () => Promise<string> }).scrapeTranslatedText =
      async () => 'Xin chào'

    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chào')
    expect(result.finalUrl).toContain('translate.kagi.com')
  })
})
