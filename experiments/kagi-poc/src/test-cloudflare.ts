import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

const url =
  'https://translate.kagi.com/?from=ja&to=vi&text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()

console.log('Navigating to Kagi Translate...')
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

console.log('Waiting 10 seconds to see Cloudflare challenge...')
await page.waitForTimeout(10_000)

await page.screenshot({ path: 'cloudflare-challenge.png', fullPage: true })
console.log('Screenshot saved to cloudflare-challenge.png')

const bodyText = await page.evaluate(() => document.body.innerText)
console.log('\n=== Page Text (first 500 chars) ===')
console.log(bodyText.slice(0, 500))

await page.waitForTimeout(5_000)
await browser.close()
