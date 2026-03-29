import { connect } from 'puppeteer-real-browser'

async function main() {
  console.log('🚀 Starting Kagi Translate Browser...')

  const { browser, page } = await connect({
    headless: false,
    turnstile: true, // Auto-bypass Cloudflare Turnstile
    disableXvfb: true,
  })

  console.log('✅ Browser connected!')
  console.log('🌐 Opening https://translate.kagi.com/ ...')

  await page.goto('https://translate.kagi.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })

  console.log('✅ Page loaded successfully!')
  console.log('🔍 Turnstile auto-bypass is enabled.')
  console.log('⏳ Waiting 10 seconds for you to see the page...')

  await new Promise((resolve) => setTimeout(resolve, 10_000))

  console.log('👋 Closing browser...')
  await browser.close()
  console.log('✅ Done!')
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
