import type { Page } from 'playwright'

// NOTE: Kagi Translate / Cloudflare Turnstile protection is aggressive against bots.
// Current mitigation: playwright-extra + stealth + human-like mouse movements + randomized UA + delays.
// If you still see verification challenge:
// 1. Run with HEADLESS=false (visible browser)
// 2. Add Turnstile solver (e.g. @sknx/cf-bypass or 2captcha)
// 3. Use real residential proxies
// 4. Consider switching to official Kagi API if available for production

// Selector strategies in priority order.
// Kagi Translate uses SvelteKit — these cover the most likely patterns.
// If all fail, we screenshot for debugging and throw a clear error.
const OUTPUT_SELECTORS = [
  // Try textareas first (most reliable)
  'textarea[readonly]',
  'textarea[disabled]',
  // Data attributes (modern app pattern)
  '[data-testid="translation-output"]',
  '[data-testid="output"]',
  '[data-testid="result"]',
  // CSS classes (SvelteKit/Svelte convention)
  '[class*="output"]',
  '[class*="result"]',
  '[class*="translated"]',
  // Contenteditable (some apps use this for display)
  'div[contenteditable="false"]',
  '[role="textbox"][aria-readonly="true"]',
]

const VI_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g

export async function extractTranslation(page: Page): Promise<string> {
  await page.waitForLoadState('load')

  // Wait until translation output appears (Vietnamese diacritics signal completion)
  // Falls through after 20s if language target is not Vietnamese
  await page
    .waitForFunction(
      () => {
        const body = document.body.textContent ?? ''
        return (
          (
            body.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g) ??
            []
          ).length > 3
        )
      },
      { timeout: 20_000 },
    )
    .catch(() => {
      // Not translating to Vietnamese — fall through after 8s buffer
      return page.waitForTimeout(8_000)
    })

  // Try JavaScript evaluation to find translated text
  try {
    const jsResult = await page.evaluate(() => {
      const viPattern = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g

      // Search all elements for Vietnamese-diacritic-rich short text (translation output)
      const allElements = document.querySelectorAll('div, span, p, textarea')
      let best: { text: string; score: number } | null = null

      for (const elem of allElements) {
        if ((elem as HTMLElement).offsetParent === null) continue // skip hidden
        const text = (
          elem instanceof HTMLTextAreaElement ? elem.value : (elem.textContent ?? '')
        ).trim()
        const words = text.split(/\s+/).length
        const diacritics = (text.match(viPattern) ?? []).length
        if (text.length > 5 && words >= 2 && diacritics >= 2) {
          const score = diacritics * 2 + words
          if (!best || score > best.score) best = { text, score }
        }
      }

      return best?.text ?? null
    })
    if (jsResult) return jsResult
  } catch {
    // Fall through to DOM selectors
  }

  // Fallback: try DOM selectors
  for (const selector of OUTPUT_SELECTORS) {
    try {
      const locator = page.locator(selector)
      const count = await locator.count()
      if (count > 0) {
        // Try first match
        const elem = locator.first()
        const isVisible = await elem.isVisible({ timeout: 500 }).catch(() => false)
        if (isVisible) {
          const text = (await elem.innerText()).trim()
          if (text.length > 15 && text.split(' ').length > 3) {
            return text
          }
        }
      }
    } catch {
      // Continue to next selector
    }
  }

  // All strategies failed — save screenshot for diagnosis
  await page.screenshot({ path: 'debug-no-selector.png', fullPage: true }).catch(() => {})
  throw new Error(
    'Could not find translation output element. ' +
      'A screenshot was saved to debug-no-selector.png. ' +
      'Open it, inspect the output element, and add its selector to ' +
      'OUTPUT_SELECTORS in src/extractor.ts, then re-run.',
  )
}
