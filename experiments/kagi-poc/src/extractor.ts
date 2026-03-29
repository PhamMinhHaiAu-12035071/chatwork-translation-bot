import type { Page } from 'playwright'

// Selector strategies in priority order.
// Kagi Translate uses SvelteKit — these cover the most likely patterns.
// If all fail, we screenshot for debugging and throw a clear error.
const OUTPUT_SELECTORS = [
  '[data-testid="translation-output"]',
  '[data-testid="output"]',
  '[data-testid="translated-text"]',
  '[data-testid="translation-result"]',
  '.translation-output',
  '.output-text',
  '.translated-content',
  '[aria-label*="ranslation" i]',
  '[aria-label*="output" i]',
]

export async function extractTranslation(page: Page): Promise<string> {
  // Wait for the translation API call to complete
  await page.waitForLoadState('networkidle')
  // Buffer for JS rendering after network settles
  await page.waitForTimeout(2_000)

  for (const selector of OUTPUT_SELECTORS) {
    try {
      const locator = page.locator(selector).first()
      const isVisible = await locator.isVisible({ timeout: 1_000 })
      if (isVisible) {
        const text = (await locator.innerText()).trim()
        if (text.length > 0) return text
      }
    } catch {
      // Selector not found — try next
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
