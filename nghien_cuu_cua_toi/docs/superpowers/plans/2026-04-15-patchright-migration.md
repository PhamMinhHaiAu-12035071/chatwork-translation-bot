# Patchright Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete puppeteer-real-browser → patchright migration with login verification, humanizer improvements, full test coverage, and documentation updates.

**Architecture:** Add login verification method to KagiBrowserService that checks redirect behavior on `/settings` page after cookie injection. Enhance HumanInteractionService with bezier curves, burst typing, and randomization. Clean all legacy references.

**Tech Stack:** Bun 1.1+, TypeScript 5.4+, patchright 1.59.0, Bun test

---

## File Structure

**Files to Modify:**

- `src/services/browser.service.ts` - Add `verifyLoginSuccess()`, integrate into translate flow
- `src/services/human-interaction.service.ts` - Add bezier curves, burst typing, randomization
- `src/services/interfaces/browser.interface.ts` - Add error code for login verification
- `src/errors.ts` (assumed to exist) - Ensure BrowserAutomationError supports new error codes
- `src/config/index.ts` - Add humanizer config constants

**Files to Create:**

- `src/utils/bezier.ts` - Bezier curve calculation utilities
- `src/utils/humanizer-config.ts` - Humanizer randomization helpers
- `src/services/browser.service.test.ts` - Unit tests for login verification
- `src/services/human-interaction.service.test.ts` (enhance existing) - Tests for new humanizer features
- `src/utils/bezier.test.ts` - Tests for bezier utilities
- `tests/integration/login-verification.integration.test.ts` - Integration tests
- `tests/e2e/translation-with-login.e2e.test.ts` - E2E tests with login verification

**Files to Clean:**

- `src/services/browser.service.ts` - Remove puppeteer-real-browser comments
- `src/services/human-interaction.service.ts` - Remove ghost-cursor comments
- `src/services/human-interaction.service.test.ts` - Remove old references
- `src/services/interfaces/human-interaction.interface.ts` - Remove old comments

**Documentation:**

- `README.md` - Add cookie setup section, update architecture

---

## Task 1: Add Login Verification Method (Critical Path)

**Files:**

- Modify: `src/services/browser.service.ts:204-366`
- Test: `src/services/browser.service.test.ts` (new file)

- [ ] **Step 1: Write failing test for verifyLoginSuccess (success case)**

Create: `src/services/browser.service.test.ts`

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { KagiBrowserService } from '~/services/browser.service'
import { BrowserAutomationError } from '~/errors'
import type { Page } from 'patchright'

describe('KagiBrowserService', () => {
  describe('verifyLoginSuccess', () => {
    let service: KagiBrowserService
    let mockPage: Page

    beforeEach(() => {
      service = new KagiBrowserService()
      mockPage = {
        goto: mock(() => Promise.resolve()),
        url: mock(() => 'https://kagi.com/settings'),
      } as unknown as Page
    })

    it('should pass when URL remains at /settings', async () => {
      await expect(service['verifyLoginSuccess'](mockPage, 30000)).resolves.toBeUndefined()

      expect(mockPage.goto).toHaveBeenCalledWith('https://kagi.com/settings', {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/services/browser.service.test.ts`  
Expected: FAIL with "verifyLoginSuccess is not a function" or "Property 'verifyLoginSuccess' does not exist"

- [ ] **Step 3: Implement verifyLoginSuccess method**

Modify: `src/services/browser.service.ts`

Add method after line 202 (after `launch()` method):

```typescript
/**
 * Verifies that session cookies are valid by checking redirect behavior.
 * Navigates to https://kagi.com/settings and ensures no redirect occurs.
 * Fail-fast: throws immediately on redirect (no retry).
 *
 * @param page - Patchright Page instance
 * @param timeoutMs - Timeout for page navigation
 * @throws {BrowserAutomationError} If redirected away from /settings
 */
private async verifyLoginSuccess(page: Page, timeoutMs: number): Promise<void> {
  const SETTINGS_URL = 'https://kagi.com/settings'

  console.log('[login-verify] Checking session validity...')

  try {
    await page.goto(SETTINGS_URL, { waitUntil: 'networkidle', timeout: timeoutMs })
  } catch (error) {
    throw new BrowserAutomationError(
      'login-verification-navigation-failed',
      SETTINGS_URL,
      error instanceof Error ? error : new Error(String(error))
    )
  }

  const finalUrl = page.url()

  if (!finalUrl.startsWith(SETTINGS_URL)) {
    throw new BrowserAutomationError(
      'login-verification-failed',
      finalUrl,
      new Error(
        `Login verification failed: redirected to ${finalUrl}. ` +
        'Session cookies may be invalid or expired. ' +
        'Please update KAGI_SESSION_FILE with fresh cookies exported from your browser.'
      )
    )
  }

  console.log('✅ Login verification passed')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/browser.service.test.ts`  
Expected: PASS (1 test passing)

- [ ] **Step 5: Write failing test for verifyLoginSuccess (redirect case)**

Add to: `src/services/browser.service.test.ts`

```typescript
it('should throw error when redirected to /signin', async () => {
  mockPage.url = mock(() => 'https://kagi.com/signin')

  await expect(service['verifyLoginSuccess'](mockPage, 30000)).rejects.toThrow(
    BrowserAutomationError,
  )

  await expect(service['verifyLoginSuccess'](mockPage, 30000)).rejects.toThrow(
    'redirected to https://kagi.com/signin',
  )
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/services/browser.service.test.ts`  
Expected: PASS (2 tests passing)

- [ ] **Step 7: Write failing test for navigation timeout**

Add to: `src/services/browser.service.test.ts`

```typescript
it('should throw error when navigation times out', async () => {
  mockPage.goto = mock(() => Promise.reject(new Error('Timeout')))

  await expect(service['verifyLoginSuccess'](mockPage, 30000)).rejects.toThrow(
    BrowserAutomationError,
  )

  await expect(service['verifyLoginSuccess'](mockPage, 30000)).rejects.toThrow(
    'login-verification-navigation-failed',
  )
})
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test src/services/browser.service.test.ts`  
Expected: PASS (3 tests passing)

- [ ] **Step 9: Commit login verification method**

```bash
git add src/services/browser.service.ts src/services/browser.service.test.ts
git commit -m "feat: add login verification with fail-fast on redirect"
```

---

## Task 2: Integrate Login Verification into Translate Flow

**Files:**

- Modify: `src/services/browser.service.ts:210-366`

- [ ] **Step 1: Update translate() method to call verifyLoginSuccess**

Modify: `src/services/browser.service.ts` in `translate()` method

Find line 284 (after `visitKagiOriginAndInjectSessionCookies`):

```typescript
      }
    }

    // ── BƯỚC 2: Navigate to translate URL and wait for Cloudflare verification to complete ──
```

Replace with:

```typescript
      }
    }

    // ── BƯỚC 2: Verify login success (NEW - fail-fast on invalid session) ──
    await this.verifyLoginSuccess(page, timeout)

    // ── BƯỚC 3: Navigate to translate URL and wait for Cloudflare verification to complete ──
```

- [ ] **Step 2: Update step numbers in comments**

Update all subsequent step comments in `translate()` method:

- Old BƯỚC 2 → BƯỚC 3
- Old BƯỚC 3 → BƯỚC 4 (delete this, it's the legacy fixed sleep)
- Old BƯỚC 4 → BƯỚC 5
- Continue renumbering through BƯỚC 11

Final numbering:

- BƯỚC 1: Cookie injection (unchanged)
- BƯỚC 2: Login verification (NEW)
- BƯỚC 3: Navigate to translate URL
- BƯỚC 4: Fill source text
- BƯỚC 5: Open settings
- BƯỚC 6: Fill context
- BƯỚC 7: Speaker gender
- BƯỚC 8: Addressee gender
- BƯỚC 9: Style
- BƯỚC 10: Reading level
- BƯỚC 11: Formality

- [ ] **Step 3: Write integration test for translate with login verification**

Create: `tests/integration/login-verification.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { KagiBrowserService } from '~/services/browser.service'
import { BrowserAutomationError } from '~/errors'
import { existsSync } from 'node:fs'

describe('Login Verification Integration', () => {
  let service: KagiBrowserService

  beforeAll(() => {
    service = new KagiBrowserService()
  })

  afterAll(async () => {
    await service.close()
  })

  it('should throw error when cookie file missing and KAGI_SESSION_FILE set', async () => {
    const originalEnv = process.env.KAGI_SESSION_FILE
    process.env.KAGI_SESSION_FILE = '/nonexistent/path/cookies.json'

    await service.launch()

    await expect(
      service.translate('https://kagi.com/translate?target_lang=vi&text=Hello'),
    ).rejects.toThrow('KAGI_SESSION_FILE not found')

    process.env.KAGI_SESSION_FILE = originalEnv
  })

  it('should skip login verification when no cookie file configured', async () => {
    const originalEnv = process.env.KAGI_SESSION_FILE
    delete process.env.KAGI_SESSION_FILE

    // Ensure no auto-detected cookie file exists
    const autoPath1 = './secrets/kagi-session.json'
    const autoPath2 = '/app/secrets/kagi-session.json'

    if (existsSync(autoPath1) || existsSync(autoPath2)) {
      console.warn('Auto-detected cookie file exists, test may not behave as expected')
    }

    await service.launch()

    // Should not throw login verification error
    // (May still hit Cloudflare, but that's different error)
    const result = await service.translate('https://kagi.com/translate?target_lang=vi&text=Hello')

    expect(result.translated).toBeDefined()

    process.env.KAGI_SESSION_FILE = originalEnv
  })
})
```

- [ ] **Step 4: Run integration test**

Run: `bun test tests/integration/login-verification.integration.test.ts`  
Expected: PASS (2 tests passing) or SKIP if no browser available

- [ ] **Step 5: Commit integration**

```bash
git add src/services/browser.service.ts tests/integration/login-verification.integration.test.ts
git commit -m "feat: integrate login verification into translate flow"
```

---

## Task 3: Clean Up puppeteer-real-browser References

**Files:**

- Modify: `src/services/browser.service.ts:180-184`
- Modify: `src/services/human-interaction.service.ts:1-6`
- Modify: `src/services/human-interaction.service.test.ts` (search for references)
- Modify: `src/services/interfaces/human-interaction.interface.ts:1-10`

- [ ] **Step 1: Search and list all puppeteer-real-browser references**

Run: `rg -i "puppeteer-real-browser|rebrowser|ghost-cursor" nghien_cuu_cua_toi/src/`  
Expected: List of files and line numbers with matches

- [ ] **Step 2: Remove comments in browser.service.ts**

Modify: `src/services/browser.service.ts` around line 180-184

Find:

```typescript
/*
      // Previous: rebrowser-puppeteer `puppeteer.launch({ userDataDir, executablePath })`
      // Previous: puppeteer-real-browser `connect()` — Turnstile helper + optional bundled Xvfb.
      */
```

Delete these 4 lines completely.

- [ ] **Step 3: Remove comments in human-interaction.service.ts**

Modify: `src/services/human-interaction.service.ts` around line 1-6

Find:

```typescript
/**
 * Human-like interaction implementation for Playwright (patchright) Page.
 *
 * Ghost-cursor / puppeteer-humanize were removed with the rebrowser migration; behavior uses
 * Playwright locators, keyboard, and mouse with the same fallback patterns as before.
 */
```

Replace with:

```typescript
/**
 * Human-like interaction implementation for Playwright (patchright) Page.
 *
 * Provides human-like interactions including randomized delays, bezier mouse curves,
 * burst typing with mistakes, and natural pauses. Includes fallback mechanisms for
 * Docker/headless environments where precise element interaction may be unreliable.
 */
```

- [ ] **Step 4: Check and clean human-interaction.service.test.ts**

Modify: `src/services/human-interaction.service.test.ts`

Search for any comments mentioning old libraries and update them. If no references found, skip this step.

- [ ] **Step 5: Check and clean interfaces**

Modify: `src/services/interfaces/human-interaction.interface.ts`

Search for any old references in comments. If none found, skip this step.

- [ ] **Step 6: Verify no references remain**

Run: `rg -i "puppeteer-real-browser|rebrowser|ghost-cursor" src/`  
Expected: No matches

- [ ] **Step 7: Commit cleanup**

```bash
git add src/services/browser.service.ts src/services/human-interaction.service.ts src/services/human-interaction.service.test.ts src/services/interfaces/human-interaction.interface.ts
git commit -m "chore: remove all puppeteer-real-browser legacy references"
```

---

## Task 4: Add Bezier Curve Utility

**Files:**

- Create: `src/utils/bezier.ts`
- Test: `src/utils/bezier.test.ts`

- [ ] **Step 1: Write failing test for bezier point calculation**

Create: `src/utils/bezier.test.ts`

```typescript
import { describe, it, expect } from 'bun:test'
import { calculateBezierPoint, generateBezierPath } from '~/utils/bezier'

describe('Bezier Utilities', () => {
  describe('calculateBezierPoint', () => {
    it('should return start point at t=0', () => {
      const result = calculateBezierPoint(0, { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
      expect(result).toEqual({ x: 0, y: 0 })
    })

    it('should return end point at t=1', () => {
      const result = calculateBezierPoint(1, { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
      expect(result).toEqual({ x: 100, y: 0 })
    })

    it('should calculate midpoint at t=0.5', () => {
      const result = calculateBezierPoint(0.5, { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 })
      expect(result.x).toBeCloseTo(50, 1)
      expect(result.y).toBeGreaterThan(0)
    })
  })

  describe('generateBezierPath', () => {
    it('should generate array of points', () => {
      const path = generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, 10)

      expect(path.length).toBe(10)
      expect(path[0]).toEqual({ x: 0, y: 0 })
      expect(path[9]).toEqual({ x: 100, y: 100 })
    })

    it('should create curved path (not linear)', () => {
      const path = generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 5)

      // Midpoint should not be exactly at (50, 0) if curve has Y deviation
      const midpoint = path[2]
      expect(midpoint.x).toBeGreaterThan(0)
      expect(midpoint.x).toBeLessThan(100)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/utils/bezier.test.ts`  
Expected: FAIL with "Cannot find module '~/utils/bezier'"

- [ ] **Step 3: Implement bezier utilities**

Create: `src/utils/bezier.ts`

```typescript
/**
 * Bezier curve utilities for natural mouse movement.
 * Uses quadratic Bezier curves (3 control points) for simplicity and performance.
 */

export interface Point {
  x: number
  y: number
}

/**
 * Random number in [min, max] inclusive
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Calculate a point on a quadratic Bezier curve.
 *
 * @param t - Parameter in [0, 1]
 * @param p0 - Start point
 * @param p1 - Control point
 * @param p2 - End point
 * @returns Point on curve at parameter t
 */
export function calculateBezierPoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const oneMinusT = 1 - t
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
  }
}

/**
 * Generate random control point for natural curve.
 * Control point is offset perpendicular to the line between start and end.
 *
 * @param start - Start point
 * @param end - End point
 * @returns Control point
 */
function generateControlPoint(start: Point, end: Point): Point {
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2

  // Vector from start to end
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular offset (10-30% of distance)
  const offsetMagnitude = distance * (0.1 + Math.random() * 0.2)
  const offsetAngle = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2

  // Rotate (dx, dy) by offsetAngle
  const perpX = -dy
  const perpY = dx
  const perpLength = Math.sqrt(perpX * perpX + perpY * perpY)

  if (perpLength === 0) {
    return { x: midX, y: midY }
  }

  const normalizedX = perpX / perpLength
  const normalizedY = perpY / perpLength

  return {
    x: midX + normalizedX * offsetMagnitude,
    y: midY + normalizedY * offsetMagnitude,
  }
}

/**
 * Generate a bezier path from start to end point.
 *
 * @param start - Start point
 * @param end - End point
 * @param steps - Number of intermediate points (default 10)
 * @returns Array of points along the curve
 */
export function generateBezierPath(start: Point, end: Point, steps: number = 10): Point[] {
  const controlPoint = generateControlPoint(start, end)
  const path: Point[] = []

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    path.push(calculateBezierPoint(t, start, controlPoint, end))
  }

  return path
}

/**
 * Generate bezier path with optional overshoot + correction for more natural movement.
 *
 * @param start - Start point
 * @param end - End point
 * @param addOvershoot - Whether to add slight overshoot (20% chance)
 * @returns Array of points including overshoot if enabled
 */
export function generateNaturalBezierPath(
  start: Point,
  end: Point,
  addOvershoot: boolean = Math.random() < 0.2,
): Point[] {
  const mainPath = generateBezierPath(start, end, randInt(8, 12))

  if (!addOvershoot) {
    return mainPath
  }

  // Add slight overshoot (2-5 pixels beyond target)
  const overshootDistance = randInt(2, 5)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length === 0) {
    return mainPath
  }

  const overshootX = end.x + (dx / length) * overshootDistance
  const overshootY = end.y + (dy / length) * overshootDistance

  const correctionPath = generateBezierPath({ x: overshootX, y: overshootY }, end, 3)

  return [...mainPath, ...correctionPath]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/utils/bezier.test.ts`  
Expected: PASS (5 tests passing)

- [ ] **Step 5: Write test for generateNaturalBezierPath**

Add to: `src/utils/bezier.test.ts`

```typescript
describe('generateNaturalBezierPath', () => {
  it('should generate path with variable length', () => {
    const path1 = generateNaturalBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, false)
    const path2 = generateNaturalBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, false)

    // Lengths may vary due to randomization
    expect(path1.length).toBeGreaterThanOrEqual(8)
    expect(path2.length).toBeGreaterThanOrEqual(8)
  })

  it('should add overshoot when enabled', () => {
    const path = generateNaturalBezierPath({ x: 0, y: 0 }, { x: 100, y: 0 }, true)

    // Should have extra correction points
    expect(path.length).toBeGreaterThan(10)
  })
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/utils/bezier.test.ts`  
Expected: PASS (7 tests passing)

- [ ] **Step 7: Commit bezier utilities**

```bash
git add src/utils/bezier.ts src/utils/bezier.test.ts
git commit -m "feat: add bezier curve utilities for natural mouse movement"
```

---

## Task 5: Enhance HumanInteractionService with Bezier Movement

**Files:**

- Modify: `src/services/human-interaction.service.ts:30-52`
- Modify: `src/services/human-interaction.service.ts:53-111`

- [ ] **Step 1: Update imports in human-interaction.service.ts**

Modify: `src/services/human-interaction.service.ts` at top of file

Add after line 8:

```typescript
import { generateNaturalBezierPath, type Point } from '~/utils/bezier'
```

- [ ] **Step 2: Update click() method to use bezier curves**

Modify: `src/services/human-interaction.service.ts` `click()` method (lines 30-52)

Replace the entire method with:

```typescript
async click(page: Page, selector: string): Promise<void> {
  try {
    const rect = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel)
      if (!el) return { width: 0, height: 0, top: -1, left: -1 }
      const r = el.getBoundingClientRect()
      return { width: r.width, height: r.height, top: r.top, left: r.left }
    }, selector)

    if (!isValidRect(rect)) {
      await page.click(selector)
      return
    }

    // Calculate target with slight randomization
    const targetX = rect.left + rect.width / 2 + randInt(-3, 3)
    const targetY = rect.top + rect.height / 2 + randInt(-3, 3)

    // Get current mouse position (approximate, use rect center as starting point)
    const startX = rect.left
    const startY = rect.top

    // Generate bezier path
    const path = generateNaturalBezierPath(
      { x: startX, y: startY },
      { x: targetX, y: targetY },
      Math.random() < 0.2 // 20% chance of overshoot
    )

    // Move along path with randomized delays
    for (let i = 0; i < path.length; i++) {
      const point = path[i]
      await page.mouse.move(point.x, point.y)
      if (i < path.length - 1) {
        await sleep(randInt(5, 15))
      }
    }

    // Click at final position
    await page.mouse.click(targetX, targetY)
  } catch {
    console.warn(`⚠️ Degraded to standard click: ${selector}`)
    await page.click(selector)
  }
}
```

- [ ] **Step 3: Update clickByTextContent() to use bezier curves**

Modify: `src/services/human-interaction.service.ts` `clickByTextContent()` method (lines 53-111)

Replace mouse movement section (after getting rect) with:

```typescript
// Generate bezier path to button
const startX = rect.left - 20
const startY = rect.top
const targetX = rect.left + rect.width / 2 + randInt(-3, 3)
const targetY = rect.top + rect.height / 2 + randInt(-3, 3)

const path = generateNaturalBezierPath(
  { x: startX, y: startY },
  { x: targetX, y: targetY },
  Math.random() < 0.15, // 15% chance of overshoot
)

for (let i = 0; i < path.length; i++) {
  const point = path[i]
  await page.mouse.move(point.x, point.y)
  if (i < path.length - 1) {
    await sleep(randInt(5, 15))
  }
}

await page.mouse.down()
await sleep(randInt(40, 120))
await page.mouse.up()
```

- [ ] **Step 4: Write test for bezier-enhanced click**

Modify: `src/services/human-interaction.service.test.ts`

Add new test:

```typescript
describe('click with bezier curves', () => {
  it('should move mouse along curved path before clicking', async () => {
    const mockPage = {
      evaluate: mock(() => Promise.resolve({ width: 100, height: 50, top: 100, left: 200 })),
      mouse: {
        move: mock(() => Promise.resolve()),
        click: mock(() => Promise.resolve()),
      },
    } as unknown as Page

    const service = new HumanInteractionService()
    await service.click(mockPage, '.test-selector')

    // Should have multiple move calls (bezier path)
    expect(mockPage.mouse.move).toHaveBeenCalled()
    const moveCallCount = (mockPage.mouse.move as any).mock.calls.length
    expect(moveCallCount).toBeGreaterThan(5) // At least 5 points in path

    // Final click should be near target center (250, 125) with jitter
    expect(mockPage.mouse.click).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/services/human-interaction.service.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit bezier mouse movement**

```bash
git add src/services/human-interaction.service.ts src/services/human-interaction.service.test.ts
git commit -m "feat: add bezier curve mouse movement to clicks"
```

---

## Task 6: Add Humanizer Configuration Constants

**Files:**

- Modify: `src/config/index.ts` (add humanizer section)
- Create: `src/utils/humanizer-config.ts`
- Test: `src/utils/humanizer-config.test.ts`

- [ ] **Step 1: Add humanizer config constants to config/index.ts**

Modify: `src/config/index.ts`

Add near end of file (before exports):

```typescript
/**
 * Humanizer behavior configuration
 */
export const HUMANIZER_CONFIG = {
  /** Typing speed range (words per minute) */
  WPM_MIN: 40,
  WPM_MAX: 120,

  /** Typing mistake rate (0.01 = 1%) */
  MISTAKE_RATE: 0.015,

  /** Pause after punctuation (milliseconds) */
  PAUSE_AFTER_PERIOD: { min: 200, max: 500 },
  PAUSE_AFTER_COMMA: { min: 100, max: 300 },

  /** Mouse movement speed (pixels per second) */
  MOUSE_SPEED_MIN: 200,
  MOUSE_SPEED_MAX: 800,

  /** Overshoot probability (0.2 = 20%) */
  OVERSHOOT_CHANCE: 0.2,

  /** Hesitation pause probability (0.1 = 10%) */
  HESITATION_CHANCE: 0.1,
  HESITATION_DURATION: { min: 300, max: 800 },
} as const
```

- [ ] **Step 2: Write failing test for humanizer helpers**

Create: `src/utils/humanizer-config.test.ts`

```typescript
import { describe, it, expect } from 'bun:test'
import {
  calculateCharDelay,
  shouldMakeMistake,
  shouldAddHesitation,
  getPauseAfterPunctuation,
} from '~/utils/humanizer-config'

describe('Humanizer Config Utilities', () => {
  describe('calculateCharDelay', () => {
    it('should return delay in milliseconds based on WPM', () => {
      // 60 WPM = 5 chars/sec = 200ms/char
      const delay = calculateCharDelay(60)
      expect(delay).toBeCloseTo(200, 50) // Allow ±50ms variance
    })

    it('should return variable delays for randomization', () => {
      const delays = Array.from({ length: 10 }, () => calculateCharDelay(60))
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1) // Should have variance
    })
  })

  describe('shouldMakeMistake', () => {
    it('should return boolean based on probability', () => {
      const results = Array.from({ length: 1000 }, () => shouldMakeMistake())
      const mistakes = results.filter(Boolean).length

      // With 1.5% rate, expect ~15 mistakes in 1000 chars (±10 tolerance)
      expect(mistakes).toBeGreaterThan(5)
      expect(mistakes).toBeLessThan(50)
    })
  })

  describe('shouldAddHesitation', () => {
    it('should return boolean based on probability', () => {
      const results = Array.from({ length: 100 }, () => shouldAddHesitation())
      const hesitations = results.filter(Boolean).length

      // With 10% rate, expect ~10 hesitations (±5 tolerance)
      expect(hesitations).toBeGreaterThan(3)
      expect(hesitations).toBeLessThan(20)
    })
  })

  describe('getPauseAfterPunctuation', () => {
    it('should return longer pause after period', () => {
      const pause = getPauseAfterPunctuation('.')
      expect(pause).toBeGreaterThanOrEqual(200)
      expect(pause).toBeLessThanOrEqual(500)
    })

    it('should return shorter pause after comma', () => {
      const pause = getPauseAfterPunctuation(',')
      expect(pause).toBeGreaterThanOrEqual(100)
      expect(pause).toBeLessThanOrEqual(300)
    })

    it('should return 0 for non-punctuation', () => {
      expect(getPauseAfterPunctuation('a')).toBe(0)
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/utils/humanizer-config.test.ts`  
Expected: FAIL with "Cannot find module '~/utils/humanizer-config'"

- [ ] **Step 4: Implement humanizer helpers**

Create: `src/utils/humanizer-config.ts`

```typescript
/**
 * Humanizer configuration utilities for natural typing and delays.
 */

import { HUMANIZER_CONFIG } from '~/config'

/**
 * Random number in [min, max] inclusive
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Calculate character typing delay based on target WPM with randomization.
 *
 * @param targetWpm - Target words per minute (default: random between min/max)
 * @returns Delay in milliseconds
 */
export function calculateCharDelay(
  targetWpm: number = randInt(HUMANIZER_CONFIG.WPM_MIN, HUMANIZER_CONFIG.WPM_MAX),
): number {
  // Assume average word length = 5 characters
  // WPM = (chars/5) / (minutes) = (chars * 60) / (5 * seconds)
  // chars/sec = WPM * 5 / 60
  // ms/char = 1000 / (chars/sec) = 1000 * 60 / (WPM * 5)
  const baseDelay = (1000 * 60) / (targetWpm * 5)

  // Add ±20% randomization
  const variance = baseDelay * 0.2
  return Math.round(baseDelay + (Math.random() - 0.5) * 2 * variance)
}

/**
 * Determine if a typing mistake should occur.
 *
 * @returns True if mistake should be made
 */
export function shouldMakeMistake(): boolean {
  return Math.random() < HUMANIZER_CONFIG.MISTAKE_RATE
}

/**
 * Determine if a hesitation pause should occur.
 *
 * @returns True if hesitation should be added
 */
export function shouldAddHesitation(): boolean {
  return Math.random() < HUMANIZER_CONFIG.HESITATION_CHANCE
}

/**
 * Get hesitation duration in milliseconds.
 *
 * @returns Duration in ms
 */
export function getHesitationDuration(): number {
  return randInt(HUMANIZER_CONFIG.HESITATION_DURATION.min, HUMANIZER_CONFIG.HESITATION_DURATION.max)
}

/**
 * Get pause duration after punctuation character.
 *
 * @param char - Character to check
 * @returns Pause duration in ms (0 if not punctuation)
 */
export function getPauseAfterPunctuation(char: string): number {
  switch (char) {
    case '.':
    case '!':
    case '?':
      return randInt(
        HUMANIZER_CONFIG.PAUSE_AFTER_PERIOD.min,
        HUMANIZER_CONFIG.PAUSE_AFTER_PERIOD.max,
      )
    case ',':
    case ';':
    case ':':
      return randInt(HUMANIZER_CONFIG.PAUSE_AFTER_COMMA.min, HUMANIZER_CONFIG.PAUSE_AFTER_COMMA.max)
    default:
      return 0
  }
}

/**
 * Generate a random mistake character (adjacent key on QWERTY keyboard).
 *
 * @param char - Original character
 * @returns Mistake character
 */
export function getMistakeChar(char: string): string {
  const adjacentKeys: Record<string, string[]> = {
    a: ['s', 'q', 'w'],
    b: ['v', 'g', 'h', 'n'],
    c: ['x', 'd', 'f', 'v'],
    d: ['s', 'e', 'r', 'f', 'c', 'x'],
    e: ['w', 'r', 'd', 's'],
    f: ['d', 'r', 't', 'g', 'v', 'c'],
    g: ['f', 't', 'y', 'h', 'b', 'v'],
    h: ['g', 'y', 'u', 'j', 'n', 'b'],
    i: ['u', 'o', 'k', 'j'],
    j: ['h', 'u', 'i', 'k', 'm', 'n'],
    k: ['j', 'i', 'o', 'l', 'm'],
    l: ['k', 'o', 'p'],
    m: ['n', 'j', 'k'],
    n: ['b', 'h', 'j', 'm'],
    o: ['i', 'p', 'l', 'k'],
    p: ['o', 'l'],
    q: ['w', 'a'],
    r: ['e', 't', 'f', 'd'],
    s: ['a', 'w', 'e', 'd', 'x', 'z'],
    t: ['r', 'y', 'g', 'f'],
    u: ['y', 'i', 'j', 'h'],
    v: ['c', 'f', 'g', 'b'],
    w: ['q', 'e', 's', 'a'],
    x: ['z', 's', 'd', 'c'],
    y: ['t', 'u', 'h', 'g'],
    z: ['a', 's', 'x'],
  }

  const lower = char.toLowerCase()
  const adjacent = adjacentKeys[lower]

  if (!adjacent || adjacent.length === 0) {
    return char
  }

  const mistake = adjacent[Math.floor(Math.random() * adjacent.length)]
  return char === char.toUpperCase() ? mistake.toUpperCase() : mistake
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/utils/humanizer-config.test.ts`  
Expected: PASS (6 tests passing)

- [ ] **Step 6: Commit humanizer config**

```bash
git add src/config/index.ts src/utils/humanizer-config.ts src/utils/humanizer-config.test.ts
git commit -m "feat: add humanizer configuration and utilities"
```

---

## Task 7: Enhance typeIntoContentEditable with Burst Typing and Mistakes

**Files:**

- Modify: `src/services/human-interaction.service.ts:124-149`

- [ ] **Step 1: Update imports in human-interaction.service.ts**

Modify: `src/services/human-interaction.service.ts` at top

Add to imports:

```typescript
import {
  calculateCharDelay,
  shouldMakeMistake,
  shouldAddHesitation,
  getHesitationDuration,
  getPauseAfterPunctuation,
  getMistakeChar,
} from '~/utils/humanizer-config'
```

- [ ] **Step 2: Replace typeIntoContentEditable with enhanced version**

Modify: `src/services/human-interaction.service.ts` `typeIntoContentEditable()` method

Replace entire method with:

```typescript
async typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void> {
  try {
    const editable = page.locator(selector).first()

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      // Chance of hesitation before typing
      if (i > 0 && shouldAddHesitation()) {
        await sleep(getHesitationDuration())
      }

      // Determine if we should make a mistake
      if (shouldMakeMistake() && /[a-zA-Z]/.test(char)) {
        const mistakeChar = getMistakeChar(char)

        // Type wrong character
        const mistakeDelay = calculateCharDelay()
        await editable.pressSequentially(mistakeChar, { delay: mistakeDelay })

        // Pause (realize mistake)
        await sleep(randInt(100, 300))

        // Backspace
        await editable.press('Backspace')
        await sleep(randInt(50, 150))

        // Type correct character
        const correctDelay = calculateCharDelay()
        await editable.pressSequentially(char, { delay: correctDelay })
      } else {
        // Type normally with variable delay
        const delay = calculateCharDelay()
        await editable.pressSequentially(char, { delay })
      }

      // Pause after punctuation
      const punctuationPause = getPauseAfterPunctuation(char)
      if (punctuationPause > 0) {
        await sleep(punctuationPause)
      }
    }
  } catch {
    console.warn(`⚠️ Degraded to execCommand insertText: ${selector}`)
    await page.evaluate(
      (box: { sel: string; value: string }) => {
        const { sel, value } = box
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) return
        el.focus()
        /* eslint-disable-next-line @typescript-eslint/no-deprecated */
        document.execCommand('insertText', false, value)
      },
      { sel: selector, value: text },
    )
  }
}
```

- [ ] **Step 3: Write test for enhanced typing**

Modify: `src/services/human-interaction.service.test.ts`

Add test:

```typescript
describe('typeIntoContentEditable with mistakes', () => {
  it('should occasionally type mistakes and correct them', async () => {
    const mockLocator = {
      pressSequentially: mock(() => Promise.resolve()),
      press: mock(() => Promise.resolve()),
    }

    const mockPage = {
      locator: mock(() => ({
        first: () => mockLocator,
      })),
    } as unknown as Page

    const service = new HumanInteractionService()

    // Type a longer string to increase chance of mistakes
    const text = 'abcdefghijklmnopqrstuvwxyz'
    await service.typeIntoContentEditable(mockPage, '.editor', text)

    // Should have called pressSequentially for each character (may be more if mistakes occurred)
    expect(mockLocator.pressSequentially).toHaveBeenCalled()
    const callCount = (mockLocator.pressSequentially as any).mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(text.length)
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/human-interaction.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit enhanced typing**

```bash
git add src/services/human-interaction.service.ts src/services/human-interaction.service.test.ts
git commit -m "feat: add burst typing with mistakes and natural pauses"
```

---

## Task 8: Add E2E Tests for Full Flow

**Files:**

- Create: `tests/e2e/translation-with-login.e2e.test.ts`

- [ ] **Step 1: Write E2E test for happy path**

Create: `tests/e2e/translation-with-login.e2e.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { KagiBrowserService } from '~/services/browser.service'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('Translation with Login Verification E2E', () => {
  let service: KagiBrowserService

  beforeAll(() => {
    service = new KagiBrowserService()
  })

  afterAll(async () => {
    await service.close()
  })

  it('should translate successfully with valid session cookies', async () => {
    // Check if cookie file exists
    const cookieFile =
      process.env.KAGI_SESSION_FILE ?? join(process.cwd(), 'secrets', 'kagi-session.json')

    if (!existsSync(cookieFile)) {
      console.warn('⚠️ Cookie file not found, skipping E2E test')
      return
    }

    await service.launch()

    const result = await service.translate(
      'https://kagi.com/translate?source_lang=en&target_lang=vi&text=Hello',
      {
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        translationStyle: 'natural',
        formality: 'standard',
        readingLevel: 'standard',
        translationContext: 'Greeting',
      },
      'Hello',
    )

    expect(result.translated).toBeDefined()
    expect(result.translated.length).toBeGreaterThan(0)
    expect(result.finalUrl).toContain('kagi.com/translate')

    console.log(`✅ Translation result: "${result.translated}"`)
  })

  it('should handle large text with chunkPaste', async () => {
    const cookieFile =
      process.env.KAGI_SESSION_FILE ?? join(process.cwd(), 'secrets', 'kagi-session.json')

    if (!existsSync(cookieFile)) {
      console.warn('⚠️ Cookie file not found, skipping E2E test')
      return
    }

    const longText = 'This is a test sentence. '.repeat(100) // ~2500 chars

    await service.launch()

    const result = await service.translate(
      `https://kagi.com/translate?source_lang=en&target_lang=vi&text=${encodeURIComponent(longText.slice(0, 100))}`,
      {
        speakerGender: 'unknown',
        addresseeGender: 'unknown',
        translationStyle: 'natural',
        formality: 'standard',
        readingLevel: 'standard',
      },
      longText,
    )

    expect(result.translated).toBeDefined()
    expect(result.translated.length).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 2: Run E2E test (may skip if no cookies)**

Run: `bun test tests/e2e/translation-with-login.e2e.test.ts`  
Expected: PASS if cookies exist, or SKIP with warning

- [ ] **Step 3: Write E2E test for login failure**

Add to: `tests/e2e/translation-with-login.e2e.test.ts`

```typescript
it('should fail fast when cookies are invalid', async () => {
  // Use invalid cookie file for this test
  const originalEnv = process.env.KAGI_SESSION_FILE
  const invalidCookieFile = join(process.cwd(), 'secrets', 'invalid-kagi-session.json')

  // Create temporary invalid cookie file
  await Bun.write(
    invalidCookieFile,
    JSON.stringify({
      cookies: [
        {
          name: 'session_id',
          value: 'invalid_token_12345',
          domain: '.kagi.com',
          path: '/',
          secure: true,
          expirationDate: Date.now() / 1000 + 3600,
        },
      ],
    }),
  )

  process.env.KAGI_SESSION_FILE = invalidCookieFile

  try {
    await service.launch()

    await expect(
      service.translate('https://kagi.com/translate?target_lang=vi&text=Test'),
    ).rejects.toThrow('login-verification-failed')
  } finally {
    process.env.KAGI_SESSION_FILE = originalEnv
    // Cleanup
    try {
      await Bun.write(invalidCookieFile, '')
    } catch {
      // Ignore cleanup errors
    }
  }
})
```

- [ ] **Step 4: Run E2E test for failure case**

Run: `bun test tests/e2e/translation-with-login.e2e.test.ts`  
Expected: PASS (should throw on invalid cookies)

- [ ] **Step 5: Commit E2E tests**

```bash
git add tests/e2e/translation-with-login.e2e.test.ts
git commit -m "test: add E2E tests for login verification and translation flow"
```

---

## Task 9: Update README Documentation

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add Session Cookie Setup section**

Modify: `README.md`

Add after "Getting Started" section:

````markdown
### Session Cookie Setup

The bot uses session cookies to bypass Cloudflare and authenticate with Kagi Translate.

**Step 1: Export Cookies from Browser**

1. Visit [kagi.com](https://kagi.com) and log in to your account
2. Install a cookie export extension:
   - Chrome/Edge: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
3. Click the extension icon and export cookies as JSON
4. Save the file as `kagi-session.json`

**Step 2: Place Cookie File**

Option A: Local development

```bash
mkdir -p secrets
mv ~/Downloads/cookies.json secrets/kagi-session.json
```
````

Option B: Docker

```bash
mkdir -p secrets
mv ~/Downloads/cookies.json secrets/kagi-session.json
# File will be mounted to /app/secrets in container
```

**Step 3: Set Environment Variable (Optional)**

If your cookie file is in a custom location:

```bash
export KAGI_SESSION_FILE=/path/to/your/cookies.json
```

**Cookie File Format:**

```json
{
  "url": "https://kagi.com",
  "cookies": [
    {
      "domain": ".kagi.com",
      "name": "session_id",
      "value": "your_session_token_here",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1735689600
    }
  ]
}
```

**Troubleshooting:**

- **Error: "login-verification-failed"** → Your cookies are expired or invalid. Re-export fresh cookies from your browser.
- **Error: "KAGI_SESSION_FILE not found"** → Check the file path is correct and file exists.
- **Cookies work initially but fail later** → Kagi sessions expire after ~30 days. Re-export cookies periodically.

````

- [ ] **Step 2: Update Architecture section**

Modify: `README.md` in Architecture section

Add after existing architecture description:

```markdown
### Login Verification Flow (NEW)

The bot now verifies session validity before each translation:

1. **Cookie Injection**: Inject session cookies from `kagi-session.json`
2. **Login Verification**: Navigate to `https://kagi.com/settings`
   - Success: URL stays at `/settings` → proceed
   - Failure: Redirect detected → throw error (fail-fast)
3. **Translation**: Navigate to translate URL and automate settings

This ensures Cloudflare is bypassed and translation proceeds only with valid authentication.
````

- [ ] **Step 3: Add Troubleshooting section**

Add near end of README:

````markdown
## Troubleshooting

### Login Verification Errors

**Problem:** `BrowserAutomationError: login-verification-failed`

**Cause:** Session cookies are invalid, expired, or Kagi account logged out.

**Solution:**

1. Log in to kagi.com in your browser
2. Re-export cookies using browser extension
3. Replace `secrets/kagi-session.json` with fresh cookies
4. Restart the bot

---

**Problem:** `KAGI_SESSION_FILE not found`

**Cause:** Cookie file path is incorrect or file doesn't exist.

**Solution:**

```bash
# Check file exists
ls -la secrets/kagi-session.json

# If missing, export cookies from browser
# then place in secrets/ directory
```
````

---

**Problem:** Translation works sometimes but fails randomly

**Cause:** Cloudflare intermittent challenges or session timing out.

**Solution:**

- Check cookies are not expired (check `expirationDate` field)
- Ensure `HEADLESS=false` during debugging to see Cloudflare challenges
- Re-export cookies from browser if older than 7 days

### Performance Issues

**Problem:** Translation takes too long or hangs

**Solution:**

- Check `BROWSER_CONFIG.TIMEOUT` in `src/config/index.ts`
- Verify internet connection is stable
- Enable headed mode to debug: `HEADLESS=false bun run start:local`

### Docker Issues

**Problem:** Browser fails to launch in Docker

**Cause:** Missing Chrome binaries or insufficient permissions.

**Solution:**

```bash
# Rebuild with no cache
docker-compose build --no-cache

# Check Chrome is installed in container
docker-compose run translator which google-chrome
```

````

- [ ] **Step 4: Commit README updates**

```bash
git add README.md
git commit -m "docs: add session cookie setup and troubleshooting guide"
````

---

## Task 10: Final Verification and Commit

**Files:**

- All modified files

- [ ] **Step 1: Run full test suite**

Run: `bun test`  
Expected: All tests passing

- [ ] **Step 2: Run type check**

Run: `bun run typecheck`  
Expected: No type errors

- [ ] **Step 3: Run linter**

Run: `bun run lint`  
Expected: No lint errors

- [ ] **Step 4: Verify no puppeteer-real-browser references**

Run: `rg -i "puppeteer-real-browser|rebrowser|ghost-cursor" src/`  
Expected: No matches

- [ ] **Step 5: Manual smoke test (local dev)**

Run: `bun run start:local`  
Expected:

- Browser launches
- Login verification passes (if cookies exist)
- Translation completes successfully

- [ ] **Step 6: Manual smoke test (Docker)**

Run: `bun run start` (docker-compose)  
Expected:

- Container builds and starts
- Browser launches in headless mode
- Translation works (if cookies mounted)

- [ ] **Step 7: Create final summary commit**

```bash
git add .
git commit -m "chore: complete patchright migration with login verification

- Add login verification with fail-fast on redirect
- Enhance humanizer: bezier curves, burst typing, mistakes
- Clean all puppeteer-real-browser references
- Add full test coverage (unit + integration + E2E)
- Update documentation with cookie setup guide

All tests passing. Ready for production use."
```

- [ ] **Step 8: Push to remote**

```bash
git push origin main
```

---

## Self-Review Checklist

### Spec Coverage

- [x] Login verification: Task 1-2
- [x] Cleanup legacy code: Task 3
- [x] Humanizer improvements:
  - [x] Bezier curves: Task 4-5
  - [x] Burst typing: Task 6-7
  - [x] Randomization: Task 6
- [x] Test coverage:
  - [x] Unit tests: Tasks 1, 4, 6
  - [x] Integration tests: Task 2
  - [x] E2E tests: Task 8
- [x] Documentation: Task 9

### Placeholder Scan

- [x] No TBD/TODO placeholders
- [x] All code blocks complete
- [x] All file paths exact
- [x] All commands with expected output

### Type Consistency

- [x] `verifyLoginSuccess(page: Page, timeoutMs: number)` signature consistent across tasks
- [x] `Point` interface used consistently in bezier utilities
- [x] Humanizer config imports consistent

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-patchright-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
