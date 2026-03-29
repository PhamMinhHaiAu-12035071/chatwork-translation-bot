import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { KagiTranslateOptions } from './types'
import { buildKagiUrl } from './url-builder'
import { extractTranslation } from './extractor'
import { clickTurnstileCheckbox } from './turnstile-clicker'

chromium.use(StealthPlugin())

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
]

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

async function humanLikeBehavior(page: any, url: string) {
  // Random delay before navigation
  await page.waitForTimeout(1000 + Math.random() * 2000)

  // Navigate with realistic options
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  })

  // Simulate human scrolling and mouse movement
  await page.evaluate(() => window.scrollTo(0, 100 + Math.random() * 300))
  await page.waitForTimeout(800 + Math.random() * 1200)

  await page.mouse.move(100 + Math.random() * 400, 100 + Math.random() * 300, { steps: 15 })
  await page.waitForTimeout(600 + Math.random() * 900)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
  await page.waitForTimeout(1200 + Math.random() * 1500)

  // Random small interactions to look human
  try {
    await page.mouse.click(200 + Math.random() * 100, 200 + Math.random() * 100, { delay: 30 })
  } catch (e) {}

  await page.waitForTimeout(1500 + Math.random() * 2000)

  // Try to wait for networkidle but don't fail if Cloudflare is blocking
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    console.log(
      '[Kagi POC] networkidle timeout (likely Cloudflare challenge), continuing anyway...',
    )
  })
}

export async function translate(options: KagiTranslateOptions): Promise<string> {
  const url = buildKagiUrl(options)
  const userAgent = getRandomUserAgent()
  if (!userAgent) throw new Error('Failed to get user agent')

  console.log(`[Kagi POC] Using UA: ${userAgent.slice(0, 80)}...`)

  const isHeadless = !!(
    process.env['CI'] ||
    process.env['HEADLESS'] === 'true' ||
    process.env['HEADLESS'] === '1'
  )
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=en-US',
    ],
  })

  const context = await browser.newContext({
    userAgent,
    viewport: {
      width: 1280 + Math.floor(Math.random() * 200),
      height: 720 + Math.floor(Math.random() * 150),
    },
    locale: 'en-US',
    timezoneId: 'Asia/Ho_Chi_Minh', // More relevant for VN target
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    bypassCSP: true,
  })

  const page = await context.newPage()

  try {
    // Use stealth + human-like behavior
    await humanLikeBehavior(page, url)

    // Try to click Turnstile checkbox if present
    const turnstileClicked = await clickTurnstileCheckbox(page)
    if (turnstileClicked) {
      // Wait for translation to process after verification
      await page.waitForTimeout(3000)
    }

    const result = await extractTranslation(page)
    return result
  } catch (err) {
    const errorMessage = (err as Error).message || String(err)
    console.error('[Kagi POC] Error:', errorMessage)

    if (errorMessage.includes('Could not find') || errorMessage.includes('timeout')) {
      await page.screenshot({ path: 'debug-extraction-failed.png', fullPage: true }).catch(() => {})
      await page
        .screenshot({ path: `debug-cloudflare-${Date.now()}.png`, fullPage: true })
        .catch(() => {})

      throw new Error(
        `Cloudflare / Turnstile likely blocking automation. Screenshots saved. ` +
          `Try running with HEADLESS=false to debug visually. ` +
          `Consider using paid services like 2captcha or switching to official Kagi API. ` +
          `See debug-*.png files for diagnosis.`,
      )
    }
    throw err
  } finally {
    await browser.close()
  }
}
