import { connect } from 'puppeteer-real-browser'
import type { KagiTranslateOptions } from './types'
import { buildKagiUrl } from './url-builder'

/**
 * Translate text using Kagi Translate with puppeteer-real-browser (Cloudflare bypass)
 */
export async function translate(options: KagiTranslateOptions): Promise<string> {
  const url = buildKagiUrl(options)
  const isHeadless = process.env['CI'] === 'true' || process.env['HEADLESS'] === 'true'

  console.log(`[Kagi POC - Real Browser] Translating: ${options.text.slice(0, 50)}...`)
  console.log(`[Kagi POC - Real Browser] From: ${options.from} → To: ${options.to}`)

  const { browser, page } = await connect({
    headless: isHeadless,
    turnstile: true, // Auto-click Cloudflare Turnstile
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    customConfig: {},
    connectOption: {
      defaultViewport: null, // Use full browser viewport
    },
  })

  try {
    console.log('[Kagi POC - Real Browser] Navigating to Kagi Translate...')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for Turnstile to be resolved automatically
    console.log('[Kagi POC - Real Browser] Waiting for Turnstile auto-resolution...')
    await new Promise((r) => setTimeout(r, 8000))

    // Extract translation from RIGHT panel (output area)
    console.log('[Kagi POC - Real Browser] Extracting translation from output panel...')

    // More specific selectors for OUTPUT (right panel)
    const OUTPUT_SELECTORS = [
      'textarea[readonly][dir="auto"]', // Right panel textarea (readonly = output)
      '[data-testid="translation-output"]',
      '.translation-output',
      'div.output-area textarea',
      '.right-panel textarea',
    ]

    // Debug: log all textareas
    const allTextareas = await page.evaluate(() => {
      const areas = Array.from(document.querySelectorAll('textarea'))
      return areas.map((ta, i) => ({
        index: i,
        readonly: ta.hasAttribute('readonly'),
        dir: ta.getAttribute('dir'),
        value: ta.value.slice(0, 50),
      }))
    })
    console.log('[Kagi POC - Real Browser] All textareas:', JSON.stringify(allTextareas, null, 2))

    let translation = ''
    for (const selector of OUTPUT_SELECTORS) {
      try {
        const element = await page.$(selector)
        if (element) {
          const text = await page.evaluate((el: any) => {
            return el.textContent || el.value || el.innerText || ''
          }, element)
          console.log(`[Kagi POC - Real Browser] ${selector} => ${text.slice(0, 50)}...`)
          if (
            text &&
            text.trim() &&
            !text.includes('Please complete') &&
            !text.includes('Start typing')
          ) {
            translation = text.trim()
            break
          }
        }
      } catch {
        continue
      }
    }

    if (!translation) {
      // Fallback: get all text from page
      const pageText = await page.evaluate(() => document.body.innerText)
      console.log('[Kagi POC - Real Browser] Page text (first 500 chars):', pageText.slice(0, 500))

      await page.screenshot({ path: 'debug-real-browser-failed.png', fullPage: true })
      throw new Error('Could not find translation output. Check debug-real-browser-failed.png')
    }

    console.log('[Kagi POC - Real Browser] ✅ Translation extracted:', translation.slice(0, 100))
    return translation
  } catch (err) {
    const errorMessage = (err as Error).message || String(err)
    console.error('[Kagi POC - Real Browser] Error:', errorMessage)

    await page.screenshot({ path: 'debug-real-browser-error.png', fullPage: true }).catch(() => {})

    throw new Error(
      `Real Browser translation failed: ${errorMessage}. ` +
        `Check debug-real-browser-error.png for diagnosis.`,
    )
  } finally {
    await browser.close()
  }
}
