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
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    return await extractTranslation(page)
  } catch (err) {
    await page.screenshot({ path: 'debug-error.png', fullPage: true }).catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}
