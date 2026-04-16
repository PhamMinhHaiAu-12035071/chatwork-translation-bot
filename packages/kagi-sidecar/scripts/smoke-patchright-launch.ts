/**
 * Smoke test: prove that patchright launches Chromium under Bun.
 * De-risks spec R1 before committing to the full migration.
 *
 * Exit 0 = success, exit 1 = failure (prints reason).
 *
 * Run with: bun run --cwd packages/kagi-sidecar smoke:patchright
 */
import { chromium } from 'patchright'

async function main(): Promise<void> {
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await context.newPage()
  await page.goto('about:blank', { timeout: 15_000 })
  const title = await page.title()
  console.log(`[smoke] opened about:blank, title="${title}"`)
  await context.close()
  console.log('[smoke] ok')
}

void main().catch((error: unknown) => {
  console.error('[smoke] failed:', error)
  process.exit(1)
})
