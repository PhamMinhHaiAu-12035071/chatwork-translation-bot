import { chromium } from 'playwright'
import type { KagiTranslateOptions } from './types'
import { buildKagiUrl } from './url-builder'
import { extractTranslation } from './extractor'

// Realistic User-Agent reduces chance of headless detection
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36'

export async function translate(options: KagiTranslateOptions): Promise<string> {
  const url = buildKagiUrl(options)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

  try {
    await page.setExtraHTTPHeaders({ 'User-Agent': USER_AGENT })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const result = await extractTranslation(page)
    return result
  } catch (err) {
    const errorMessage = (err as Error).message || String(err)
    // If extraction fails due to verification, provide helpful guidance
    if (errorMessage.includes('Could not find translation output')) {
      await page.screenshot({ path: 'debug-extraction-failed.png', fullPage: true }).catch(() => {})
      throw new Error(
        'Translation failed: Kagi Translate may require verification (CAPTCHA) for headless browsers. ' +
          'For local testing, use a visible browser with `--headed` flag or use the authenticated API. ' +
          'See debug-extraction-failed.png for details.',
      )
    }
    throw err
  } finally {
    await browser.close()
  }
}
