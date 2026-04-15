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
}: {
  finalUrl?: string
  gotoError?: Error
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
  } as unknown as Page
}

describe('KagiBrowserService.verifyLoginSuccess', () => {
  it('should pass when /settings remains on settings URL', async () => {
    const page = createMockPage()
    const service = new KagiBrowserService()
    const verifyLoginSuccess = (service as unknown as VerifyLoginMethod).verifyLoginSuccess

    await expect(verifyLoginSuccess(page, 5_000)).resolves.toBeUndefined()
    expect((page as unknown as { goto: ReturnType<typeof mock> }).goto).toHaveBeenCalledWith(
      SETTINGS_URL,
      { waitUntil: 'domcontentloaded', timeout: 5_000 },
    )
  })

  it('should throw login-verification-failed when redirected away from settings', async () => {
    const page = createMockPage({ finalUrl: 'https://kagi.com/signin' })
    const service = new KagiBrowserService()
    const verifyLoginSuccess = (service as unknown as VerifyLoginMethod).verifyLoginSuccess

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
    const verifyLoginSuccess = (service as unknown as VerifyLoginMethod).verifyLoginSuccess

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
})
