import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
chromium.use(StealthPlugin())

const browser = await chromium.launch({
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
})
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
})
const page = await context.newPage()
await page.goto(
  'https://translate.kagi.com/?from=ja&to=vi&text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF',
  { waitUntil: 'load' },
)
console.log('Waiting 15s for Turnstile...')
await page.waitForTimeout(15_000)
const auth = await page.evaluate(() => fetch('/api/auth/check-header').then((r) => r.json()))
console.log('hasPrivacyPass:', auth)
const txt = await page.evaluate(() => document.body.innerText.slice(0, 600))
console.log('\nPage text:\n', txt)
await browser.close()
