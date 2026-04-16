import { describe, it, expect, mock } from 'bun:test'
import type { Page } from 'patchright'

import { BrowserAutomationError } from '~/errors'
import { KagiBrowserService } from '~/services'

interface VerifyLoginMethod {
  verifyLoginSuccess(page: Page, timeoutMs: number): Promise<void>
}

const SETTINGS_URL = 'https://kagi.com/settings'

const createMockPage = ({
  finalUrl = SETTINGS_URL,
  gotoError,
  domState = { hasLogout: true, hasSigninEmail: false, hasSigninQr: false },
}: {
  finalUrl?: string
  gotoError?: Error
  domState?: { hasLogout: boolean; hasSigninEmail: boolean; hasSigninQr: boolean }
} = {}): Page => {
  let currentUrl = finalUrl
  return {
    goto: mock(async () => {
      if (gotoError !== undefined) {
        throw gotoError
      }
      currentUrl = finalUrl
    }),
    url: mock(() => currentUrl),
    evaluate: mock(async () => domState),
  } as unknown as Page
}

const bindVerify = (service: KagiBrowserService): VerifyLoginMethod['verifyLoginSuccess'] =>
  (service as unknown as VerifyLoginMethod).verifyLoginSuccess.bind(service)

describe('KagiBrowserService.verifyLoginSuccess', () => {
  it('should pass when /settings remains on settings URL and logout link present', async () => {
    const page = createMockPage()
    const service = new KagiBrowserService()
    const verifyLoginSuccess = bindVerify(service)

    await expect(verifyLoginSuccess(page, 5_000)).resolves.toBeUndefined()
    expect((page as unknown as { goto: ReturnType<typeof mock> }).goto).toHaveBeenCalledWith(
      SETTINGS_URL,
      { waitUntil: 'domcontentloaded', timeout: 5_000 },
    )
  })

  it('should throw login-verification-failed when redirected away from settings', async () => {
    const page = createMockPage({ finalUrl: 'https://kagi.com/signin' })
    const service = new KagiBrowserService()
    const verifyLoginSuccess = bindVerify(service)

    try {
      await verifyLoginSuccess(page, 5_000)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserAutomationError)
      expect((error as BrowserAutomationError).operation).toBe('login-verification-failed')
      expect((error as BrowserAutomationError).context).toBe('https://kagi.com/signin')
    }
  })

  it('should throw login-verification-navigation-failed when goto fails', async () => {
    const page = createMockPage({ gotoError: new Error('Navigation timeout') })
    const service = new KagiBrowserService()
    const verifyLoginSuccess = bindVerify(service)

    try {
      await verifyLoginSuccess(page, 5_000)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserAutomationError)
      expect((error as BrowserAutomationError).operation).toBe(
        'login-verification-navigation-failed',
      )
      expect((error as BrowserAutomationError).context).toBe(SETTINGS_URL)
    }
  })

  it('should throw login-verification-failed when signin DOM is rendered inline', async () => {
    const page = createMockPage({
      domState: { hasLogout: false, hasSigninEmail: true, hasSigninQr: false },
    })
    const service = new KagiBrowserService()
    const verifyLoginSuccess = bindVerify(service)

    try {
      await verifyLoginSuccess(page, 5_000)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserAutomationError)
      expect((error as BrowserAutomationError).operation).toBe('login-verification-failed')
    }
  })

  it('should throw login-verification-failed when logout link is absent', async () => {
    const page = createMockPage({
      domState: { hasLogout: false, hasSigninEmail: false, hasSigninQr: false },
    })
    const service = new KagiBrowserService()
    const verifyLoginSuccess = bindVerify(service)

    try {
      await verifyLoginSuccess(page, 5_000)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(BrowserAutomationError)
      expect((error as BrowserAutomationError).operation).toBe('login-verification-failed')
    }
  })
})
