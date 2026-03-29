import type { Page } from 'playwright'

/**
 * Detect and click Cloudflare Turnstile checkbox
 */
export async function clickTurnstileCheckbox(page: Page): Promise<boolean> {
  try {
    console.log('[Turnstile] Looking for Cloudflare Turnstile...')

    // Wait a bit for Turnstile to render
    await page.waitForTimeout(3000)

    // Strategy 1: Try to find ANY iframe (Cloudflare may use different URLs)
    const iframes = await page.$$('iframe')
    console.log(`[Turnstile] Found ${iframes.length} iframes total`)

    if (iframes.length === 0) {
      console.log('[Turnstile] No iframes found')
      return false
    }

    // Strategy 2: Look for Turnstile by checking iframe src or body
    for (let i = 0; i < iframes.length; i++) {
      try {
        const iframe = iframes[i]
        if (!iframe) continue

        const src = await iframe.getAttribute('src')
        console.log(`[Turnstile] iframe ${i}: ${src?.slice(0, 60) || 'no src'}...`)

        if (
          src &&
          (src.includes('cloudflare') || src.includes('turnstile') || src.includes('challenges'))
        ) {
          console.log(`[Turnstile] Found Cloudflare iframe at index ${i}`)

          // Try to click inside this iframe
          const frame = await iframe.contentFrame()
          if (frame) {
            // Try multiple selectors for the checkbox
            const selectors = [
              'input[type="checkbox"]',
              'label',
              '.cb-i',
              '.ctp-checkbox-label',
              '[role="checkbox"]',
              'body', // Last resort: click anywhere in iframe
            ]

            for (const selector of selectors) {
              try {
                const elem = frame.locator(selector).first()
                await elem.click({ timeout: 2000, delay: 100 })
                console.log(`[Turnstile] Clicked ${selector}!`)
                await page.waitForTimeout(5000)
                return true
              } catch {
                continue
              }
            }
          }
        }
      } catch {
        continue
      }
    }

    // Strategy 3: Look for Turnstile widget directly on page (not in iframe)
    console.log('[Turnstile] Trying direct page selectors...')
    const directSelectors = [
      '[data-sitekey]',
      '.cf-turnstile',
      '#cf-turnstile',
      '[id*="turnstile"]',
      '[class*="turnstile"]',
      '[class*="cloudflare"]',
    ]

    for (const selector of directSelectors) {
      try {
        const elem = page.locator(selector)
        const count = await elem.count()
        if (count > 0) {
          console.log(`[Turnstile] Found ${selector}, clicking...`)
          await elem.first().click({ timeout: 2000, delay: 100 })
          await page.waitForTimeout(5000)
          return true
        }
      } catch {
        continue
      }
    }

    console.log('[Turnstile] Could not find clickable Turnstile element')
    return false
  } catch (err) {
    console.warn('[Turnstile] Error:', (err as Error).message)
    return false
  }
}
