import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { writeFileSync } from 'fs'

chromium.use(StealthPlugin())

const url =
  'https://translate.kagi.com/?from=ja&to=vi&text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()

console.log('Navigating...')
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

console.log('Waiting 5s for Turnstile...')
await page.waitForTimeout(5000)

// Dump full HTML
const html = await page.content()
writeFileSync('debug-full-dom.html', html)
console.log('✅ Saved full DOM to debug-full-dom.html')

// Find all iframes
const iframes = await page.$$('iframe')
console.log(`\n📦 Found ${iframes.length} iframes:`)
for (let i = 0; i < iframes.length; i++) {
  const src = await iframes[i]?.getAttribute('src')
  const id = await iframes[i]?.getAttribute('id')
  const classes = await iframes[i]?.getAttribute('class')
  console.log(`  ${i}. src: ${src?.slice(0, 80) || 'none'}`)
  console.log(`     id: ${id || 'none'}, class: ${classes || 'none'}`)
}

// Find Turnstile-related elements
const turnstileSelectors = [
  '[data-sitekey]',
  '.cf-turnstile',
  '#cf-turnstile',
  '[id*="turnstile"]',
  '[class*="turnstile"]',
  'div[style*="display: none"]', // Sometimes hidden
]

console.log('\n🔍 Looking for Turnstile elements:')
for (const selector of turnstileSelectors) {
  const count = await page.locator(selector).count()
  if (count > 0) {
    console.log(`  ✅ Found ${count}x ${selector}`)
    const elem = page.locator(selector).first()
    const html = await elem.evaluate((el) => el.outerHTML)
    console.log(`     HTML: ${html.slice(0, 150)}...`)
  }
}

// Check if "Please complete verification" text exists
const verifyText = await page.locator('text=/verify|complete|verification/i').count()
console.log(`\n🔒 "Verify" text found: ${verifyText}x`)

await page.waitForTimeout(5000)
await browser.close()
