/**
 * E2E - Login Verification + Human Interaction Flows
 */
import { describe, expect, it, mock, setDefaultTimeout } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from 'patchright'
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'
import { BrowserAutomationError } from '~/errors'
import {
  KAGI_ORIGIN_URL,
  KAGI_SESSION_FILE_ENV,
  KAGI_SELECTORS,
  getDefaultTranslationOptions,
} from '~/config'
import { KagiBrowserService, KagiUrlBuilder } from '~/services'

setDefaultTimeout(30_000)

const SETTINGS_URL = 'https://kagi.com/settings'
const SIGNIN_URL = 'https://kagi.com/signin'
const WAIT_RESULT_HANDLE = { jsonValue: mock(async () => 'ready' as const) }

interface MockPageFixture {
  page: Page
  setSettingsRedirectUrl: (url: string) => void
  queueTranslateResult: (result: string, includesSourceText: boolean) => void
}

function createMockPage(settingsRedirectUrl = SETTINGS_URL): MockPageFixture {
  let currentUrl = 'about:blank'
  let nextSettingsUrl = settingsRedirectUrl
  const evaluate = mock(async () => '')

  const page = {
    goto: mock(async (url: string) => {
      if (url.startsWith(SETTINGS_URL)) {
        currentUrl = nextSettingsUrl
        return
      }
      if (url === KAGI_ORIGIN_URL || url.startsWith(KAGI_ORIGIN_URL)) {
        currentUrl = KAGI_ORIGIN_URL
        return
      }
      currentUrl = url
    }),
    waitForSelector: mock(async () => {}),
    waitForFunction: mock(async () => WAIT_RESULT_HANDLE),
    screenshot: mock(async () => {}),
    click: mock(async () => {}),
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
    evaluate,
    url: mock(() => currentUrl),
  } as unknown as Page

  return {
    page,
    setSettingsRedirectUrl(url: string) {
      nextSettingsUrl = url
    },
    queueTranslateResult(result: string, includesSourceText: boolean) {
      if (includesSourceText) {
        // For long-text paths, clearSourceTextInput invokes:
        // 1) existing text probe (string)
        // 2) clear-text DOM mutation (undefined)
        evaluate.mockResolvedValueOnce('' as never)
        evaluate.mockResolvedValueOnce(undefined as never)
      }

      // clearSourceTextInput -> delete command (undefined) + waitForTranslationOutputStable -> reset
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
        url: KAGI_ORIGIN_URL,
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

function defaultCookies() {
  return [
    {
      domain: '.kagi.com',
      path: '/',
      expirationDate: Math.floor(Date.now() / 1000) + 3600,
      name: 'kagi_session',
      value: 'e2e-test-token',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]
}

function clearMockCalls(mockHumanInteraction: IHumanInteraction) {
  ;(mockHumanInteraction.click as ReturnType<typeof mock>).mockClear()
  ;(mockHumanInteraction.clickByTextContent as ReturnType<typeof mock>).mockClear()
  ;(mockHumanInteraction.typeIntoTextarea as ReturnType<typeof mock>).mockClear()
  ;(mockHumanInteraction.typeIntoContentEditable as ReturnType<typeof mock>).mockClear()
  ;(mockHumanInteraction.dragSlider as ReturnType<typeof mock>).mockClear()
  ;(mockHumanInteraction.chunkPaste as ReturnType<typeof mock>).mockClear()
}

describe('E2E Login Verification and chunkPaste', () => {
  it('should skip login verification when no session file is configured', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const originalCwd = process.cwd()
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-e2e-login-'))
    const mockPage = createMockPage()
    const mockPersistentContext = createMockPersistentContext(mockPage.page)
    const mockHumanInteraction = createMockHumanInteraction()
    let service: KagiBrowserService | undefined

    try {
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)
      delete process.env[KAGI_SESSION_FILE_ENV]
      process.chdir(tempDir)
      service = new KagiBrowserService(mockHumanInteraction)
      clearMockCalls(mockHumanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('No session test', options)
      mockPage.queueTranslateResult('Dịch không đăng nhập', false)

      const result = await service.translate(translateUrl, options)

      expect(result.translated).toBe('Dịch không đăng nhập')
      expect(mockPersistentContext.addCookies).not.toHaveBeenCalled()
      expect(mockPage.page.goto).not.toHaveBeenCalledWith(SETTINGS_URL, expect.any(Object))
    } finally {
      await service?.close()
      process.env[KAGI_SESSION_FILE_ENV] = originalEnv
      process.chdir(originalCwd)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should throw login-verification-failed for invalid cookies', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-e2e-login-'))
    const sessionFile = writeSessionFile(tempDir, defaultCookies())
    const mockPage = createMockPage(SIGNIN_URL)
    const mockPersistentContext = createMockPersistentContext(mockPage.page)
    const mockHumanInteraction = createMockHumanInteraction()
    let service: KagiBrowserService | undefined

    try {
      process.env[KAGI_SESSION_FILE_ENV] = sessionFile
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)
      service = new KagiBrowserService(mockHumanInteraction)
      clearMockCalls(mockHumanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Invalid cookie test', options)

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

  it('should pass login verification with valid cookies and continue translation flow', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-e2e-login-'))
    const sessionFile = writeSessionFile(tempDir, defaultCookies())
    const mockPage = createMockPage(SETTINGS_URL)
    const mockPersistentContext = createMockPersistentContext(mockPage.page)
    const mockHumanInteraction = createMockHumanInteraction()
    let service: KagiBrowserService | undefined

    try {
      process.env[KAGI_SESSION_FILE_ENV] = sessionFile
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)
      service = new KagiBrowserService(mockHumanInteraction)
      clearMockCalls(mockHumanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Valid cookie test', options)
      mockPage.queueTranslateResult('Dịch hợp lệ', false)

      const result = await service.translate(translateUrl, options)

      expect(result.translated).toBe('Dịch hợp lệ')
      expect(mockPage.page.goto).toHaveBeenCalledWith(KAGI_ORIGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: expect.any(Number),
      })
      expect(mockPage.page.goto).toHaveBeenCalledWith(SETTINGS_URL, {
        waitUntil: 'domcontentloaded',
        timeout: expect.any(Number),
      })
      expect(mockPersistentContext.addCookies).toHaveBeenCalled()
    } finally {
      await service?.close()
      process.env[KAGI_SESSION_FILE_ENV] = originalEnv
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should use chunkPaste for large source text and complete translation after login verification', async () => {
    const originalEnv = process.env[KAGI_SESSION_FILE_ENV]
    const tempDir = mkdtempSync(join(tmpdir(), 'kagi-e2e-login-'))
    const sessionFile = writeSessionFile(tempDir, defaultCookies())
    const mockPage = createMockPage(SETTINGS_URL)
    const mockPersistentContext = createMockPersistentContext(mockPage.page)
    const mockHumanInteraction = createMockHumanInteraction()
    let service: KagiBrowserService | undefined

    try {
      process.env[KAGI_SESSION_FILE_ENV] = sessionFile
      mockLaunchPersistentContext.mockResolvedValue(mockPersistentContext as never)
      service = new KagiBrowserService(mockHumanInteraction)
      clearMockCalls(mockHumanInteraction)
      await service.launch()

      const options = getDefaultTranslationOptions()
      const urlBuilder = new KagiUrlBuilder()
      const translateUrl = urlBuilder.build('Chunk paste test', options)
      const longText = 'x'.repeat(600)
      mockPage.queueTranslateResult('Kết quả dịch dài', true)

      const result = await service.translate(translateUrl, options, longText)

      expect(result.translated).toBe('Kết quả dịch dài')
      expect(mockHumanInteraction.chunkPaste).toHaveBeenCalledWith(
        expect.anything(),
        KAGI_SELECTORS.SOURCE_TEXT_INPUT,
        longText,
      )
      expect(mockHumanInteraction.typeIntoContentEditable).not.toHaveBeenCalled()
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
})
