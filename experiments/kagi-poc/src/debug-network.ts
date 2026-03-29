import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
})
const context = await browser.newContext({
  userAgent: USER_AGENT,
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
})
const page = await context.newPage()

// Track only API/translate calls
page.on('response', async (response) => {
  const url = response.url()
  const status = response.status()
  if (
    url.includes('/api/') ||
    url.includes('translate') ||
    url.includes('turnstile') ||
    url.includes('cloudflare')
  ) {
    console.log(`[${status}] ${url}`)
    const ct = response.headers()['content-type'] ?? ''
    if (ct.includes('json')) {
      try {
        console.log('  ', JSON.stringify(await response.json()).slice(0, 200))
      } catch {}
    }
  }
})

const url =
  'https://translate.kagi.com/?from=ja&to=vi&text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'
await page.goto(url, { waitUntil: 'load', timeout: 30_000 })
console.log('\n--- Waiting 12s ---')
await page.waitForTimeout(12_000)

console.log('\n--- hasPrivacyPass check ---')
try {
  const r = await page.evaluate(() => fetch('/api/auth/check-header').then((r) => r.json()))
  console.log(r)
} catch (e) {
  console.log('eval error:', e)
}

await browser.close()
