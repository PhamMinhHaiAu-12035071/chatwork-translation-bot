import type { Page } from 'playwright'

// NOTE: Kagi Translate may require verification (CAPTCHA) for headless browsers.
// If you encounter "Please complete the verification step", Kagi is blocking the headless session.
// Workarounds:
// 1. Try with user-visible browser (debugging mode)
// 2. Add delay/randomization to requests
// 3. Use Kagi's official API if available

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

export async function extractTranslation(page: Page): Promise<string> {
  // Wait for page to load and stabilize
  await page.waitForLoadState('load')
  // Extended buffer for API response and rendering
  await page.waitForTimeout(5_000)

  // Try JavaScript evaluation to find translated text
  try {
    const jsResult = await page.evaluate(() => {
      // First: look for Vietnamese text in textareas (most specific)
      const textareas = document.querySelectorAll('textarea')
      for (const ta of textareas) {
        const text = (ta.value || ta.textContent || '').trim()
        if (text.length > 15 && text.split(' ').length > 3) {
          return text
        }
      }

      // Second: search for Vietnamese text patterns in the DOM
      const allElements = document.querySelectorAll('div, span, p, textarea')
      for (const elem of allElements) {
        const text = (elem.textContent || '').trim()
        // Look for Vietnamese diacritics (quick heuristic)
        if (
          text.length > 15 &&
          text.split(' ').length > 3 &&
          (
            text.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/g) ||
            []
          ).length > 2
        ) {
          return text
        }
      }

      return null
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
