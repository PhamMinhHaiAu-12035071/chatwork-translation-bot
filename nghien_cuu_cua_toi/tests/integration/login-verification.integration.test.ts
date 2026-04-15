import { describe, expect, it, mock, setDefaultTimeout } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from 'patchright'
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'
import { BrowserAutomationError } from '~/errors'
import { KagiBrowserService, KagiUrlBuilder } from '~/services'
import { KAGI_SESSION_FILE_ENV, getDefaultTranslationOptions } from '~/config'

setDefaultTimeout(30_000)

const SETTINGS_URL = 'https://kagi.com/settings'
const SIGNIN_URL = 'https://kagi.com/signin'
const MOCK_WAIT_RESULT_HANDLE = { jsonValue: mock(async () => 'ready' as const) }

interface MockPageFixture {
  page: Page
  queueTranslateResult: (result: string, includeSourceTextProbe?: boolean) => void
  setSettingsRedirectUrl: (url: string) => void
}

function createMockPage(settingsRedirectUrl = SETTINGS_URL): MockPageFixture {
  let currentUrl = 'about:blank'
  let redirectTarget = settingsRedirectUrl

  const page = {
    goto: mock(async (url: string) => {
      if (url.startsWith(SETTINGS_URL)) {
        currentUrl = redirectTarget
      } else {
        currentUrl = url
      }
    }),
    waitForSelector: mock(async () => {}),
    waitForFunction: mock(async () => MOCK_WAIT_RESULT_HANDLE),
    screenshot: mock(async () => {}),
    click: mock(async (_selector?: string) => {}),
    focus: mock(async () => {}),
    type: mock(async () => {}),
    keyboard: {
      down: mock(async () => {}),
      press: mock(async () => {}),
      up: mock(async () => {}),
    },
    mouse: {
      move: mock(async () => {}),
      down: mock(async () => {}),
      up: mock(async () => {}),
    },
    evaluate: mock(async () => ''),
    url: mock(() => currentUrl),
  } as unknown as Page

  return {
    page,
    setSettingsRedirectUrl(url: string) {
      redirectTarget = url
    },
    queueTranslateResult(result: string, includeSourceTextProbe = false) {
      const evaluate = page.evaluate as ReturnType<typeof mock>
      if (includeSourceTextProbe) {
        evaluate.mockResolvedValueOnce('' as never)
      }
      evaluate.mockResolvedValueOnce(undefined as never)
      evaluate.mockResolvedValueOnce(result as never)
    },
  }
}

function createMockPersistentContext(page: Page) {
  return {
    close: mock(async () => {}),
    pages: () => [page],
    newPage: mock(async () => page),
    addCookies: mock(async () => {}),
  }
}

function createMockHumanInteraction() {
  return {
    click: mock(async () => {}),
    clickByTextContent: mock(async () => {}),
    typeIntoTextarea: mock(async () => {}),
    typeIntoContentEditable: mock(async () => {}),
    dragSlider: mock(async () => {}),
    chunkPaste: mock(async () => {}),
  } as IHumanInteraction
}

function writeSessionFile(directory: string, cookies: Array<Record<string, unknown>>): string {
  const filePath = join(directory, 'kagi-session.json')
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        url: 'https://kagi.com/',
        cookies,
      },
      null,
      2,
    ),
    'utf8',
  )
  return filePath
}

const mockLaunchPersistentContext = mock(async () => {
  throw new Error('patchright mock not initialized')
})

mock.module('patchright', () => ({
  chromium: {
    launchPersistentContext: mockLaunchPersistentContext,
  },
}))

describe('Login Verification Integration', () => {
  const defaultCookies = [
    {
      domain: '.kagi.com',
      path: '/',
      expirationDate: Math.floor(Date.now() / 1000) + 3600,
      name: 'kagi_session',
      value: 'integration-test-token',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]

  it('should continue translation when no session file is configured', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const originalCwd = process.cwd()
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-login-integration-'))
    let service: KagiBrowserService | undefined

    try {
      delete process.env[KAGI_SESSION_FILE_ENV]
      process.chdir(tempDir)

      const humanInteraction = createMockHumanInteraction()
      const mockPage = createMockPage()
      const mockPersistentContext = createMockPersistentContext(mockPage.page)
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)

      service = new KagiBrowserService(humanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Hello, world', options)
      mockPage.queueTranslateResult('Xin chào')

      const result = await service.translate(translateUrl, options)

      expect(result.translated).toBe('Xin chào')
      expect(mockPage.page.goto).not.toHaveBeenCalledWith(SETTINGS_URL, expect.anything())
      expect(mockPage.page.goto).toHaveBeenCalledWith(translateUrl, expect.any(Object))
    } finally {
      await service?.close()
      process.env[KAGI_SESSION_FILE_ENV] = originalEnv
      process.chdir(originalCwd)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should pass login verification and continue when /settings stays on settings', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-login-integration-'))
    const sessionFile = writeSessionFile(tempDir, defaultCookies)
    let service: KagiBrowserService | undefined

    try {
      process.env[KAGI_SESSION_FILE_ENV] = sessionFile

      const humanInteraction = createMockHumanInteraction()
      const mockPage = createMockPage(SETTINGS_URL)
      const mockPersistentContext = createMockPersistentContext(mockPage.page)
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)

      service = new KagiBrowserService(humanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Hello, world', options)
      mockPage.queueTranslateResult('Xin chào')

      const result = await service.translate(translateUrl, options)

      expect(result.translated).toBe('Xin chào')
      expect(mockPage.page.goto).toHaveBeenCalledWith(SETTINGS_URL, {
        waitUntil: 'domcontentloaded',
        timeout: expect.any(Number),
      })
    } finally {
      await service?.close()
      process.env[KAGI_SESSION_FILE_ENV] = originalEnv
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should throw login-verification-failed when /settings redirects to /signin', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-login-integration-'))
    const sessionFile = writeSessionFile(tempDir, defaultCookies)
    let service: KagiBrowserService | undefined

    try {
      process.env[KAGI_SESSION_FILE_ENV] = sessionFile

      const humanInteraction = createMockHumanInteraction()
      const mockPage = createMockPage(SIGNIN_URL)
      const mockPersistentContext = createMockPersistentContext(mockPage.page)
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)

      service = new KagiBrowserService(humanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Hello, world', options)

      try {
        await service.translate(translateUrl, options)
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(BrowserAutomationError)
        expect((error as BrowserAutomationError).operation).toBe('login-verification-failed')
        expect((error as BrowserAutomationError).context).toBe(SIGNIN_URL)
      }
    } finally {
      await service?.close()
      process.env[KAGI_SESSION_FILE_ENV] = originalEnv
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
