/**
 * Dependency-inversion boundary for the Kagi browser automation layer.
 * Ported from nghien_cuu_cua_toi/src/services/interfaces/browser.interface.ts.
 */

import type { BrowserContext } from 'patchright'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'

export interface IBrowserConnection {
  close(): Promise<void>
  getContext?(): BrowserContext
}

export interface TranslateResult {
  /** Scraped translation text from the output pane. */
  translated: string
  /** Address-bar URL after settings application. Useful for debugging. */
  finalUrl: string
}

export interface KagiTranslateUiRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface IBrowserService {
  /** Launches the persistent Chromium context. Call ONCE at boot. */
  launch(): Promise<IBrowserConnection>

  /**
   * Opens a new tab within the existing context and closes the previous one.
   * Call for every request after the first so each translation gets a clean tab.
   */
  openNewTab?(): Promise<void>

  /**
   * Runs the full translate flow (navigate → fill → settings → stabilize → scrape).
   * Callers must ensure `launch()` has completed and login has been verified.
   */
  translate(request: KagiTranslateUiRequest): Promise<TranslateResult>

  /** Closes the browser context. Safe to call multiple times. */
  close(): Promise<void>
}
