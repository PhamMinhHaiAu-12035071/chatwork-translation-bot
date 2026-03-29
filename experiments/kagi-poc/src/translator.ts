import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { KagiTranslateOptions } from './types'
import { buildKagiUrl } from './url-builder'
import { extractTranslation } from './extractor'
import { TurnstileSolver } from './turnstile-solver'

chromium.use(StealthPlugin())

const USE_SOLVER =
  process.env['USE_TURNSTILE_SOLVER'] === 'true' || process.env['USE_TURNSTILE_SOLVER'] === '1'

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
  await page.waitForLoadState('networkidle')
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
    // If USE_SOLVER is enabled, use Turnstile solver before navigating
    if (USE_SOLVER) {
      console.log('[Kagi POC] Using Turnstile Solver (theyka/turnstile_solver)')
      try {
        const token = await TurnstileSolver.solve(url)
        console.log('[Kagi POC] Solver returned token:', token.slice(0, 20) + '...')

        // Navigate then inject token
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await TurnstileSolver.injectToken(page, token)
        await page.waitForTimeout(2000) // Wait for token to take effect
      } catch (solverErr: any) {
        console.warn(
          '[Kagi POC] Solver failed, falling back to stealth+human behavior:',
          solverErr.message,
        )
        // Fall back to human behavior if solver fails
        await humanLikeBehavior(page, url)
      }
    } else {
      // Default: stealth + human-like behavior without external solver
      await humanLikeBehavior(page, url)
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
          `Try running with USE_TURNSTILE_SOLVER=true and ensure Docker solver is running (docker compose up -d). ` +
          `Or run with HEADLESS=false to debug visually. ` +
          `See debug-*.png files for diagnosis.`,
      )
    }
    throw err
  } finally {
    await browser.close()
  }
}
