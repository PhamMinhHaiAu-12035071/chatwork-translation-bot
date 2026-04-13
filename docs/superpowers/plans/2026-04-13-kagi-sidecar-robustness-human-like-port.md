# Kagi Sidecar Robustness & Human-like Interaction Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 3 production enhancements (input clamping, dynamic delay, human interaction) from `nghien_cuu_cua_toi/` PoC to `packages/kagi-sidecar/`, shipped as 3 sequential PRs.

**Architecture:** PR #1 — pure functions for input clamping. PR #2 — delay config constants + wire scaling into browser-service. PR #3 — ghost-cursor/puppeteer-humanize dependencies, PageLike extension, IHumanInteraction interface + service, full browser-service interaction refactor + navigate-without-text strategy.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, ghost-cursor ^1.4.2, @forad/puppeteer-humanize ^1.1.8, puppeteer-real-browser (existing), Elysia (existing)

---

## File Map

**Created:**
| File | Purpose |
|------|---------|
| `packages/kagi-sidecar/src/constants/input-clamping.ts` | `MAX_INPUT_TEXT_LENGTH`, `clampInputText()` |
| `packages/kagi-sidecar/src/constants/input-clamping.test.ts` | Unit tests |
| `packages/kagi-sidecar/src/constants/delay-config.ts` | `HUMAN_INPUT_THRESHOLD`, `DELAY_TIERS`, `computeDelayMultiplier()`, `computeScaledDelay()` |
| `packages/kagi-sidecar/src/constants/delay-config.test.ts` | Unit tests |
| `packages/kagi-sidecar/src/types/human-interaction.interface.ts` | `IHumanInteraction` contract (6 methods, all accept `PageLike`) |
| `packages/kagi-sidecar/src/services/human-interaction.service.ts` | Port from PoC; `Page` → `PageLike`; Docker-safe fallbacks |
| `packages/kagi-sidecar/src/services/human-interaction.service.test.ts` | Tests for fallback paths |

**Modified:**
| File | What changes |
|------|-------------|
| `packages/kagi-sidecar/src/browser-service.ts` | PRs #1, #2, #3 (add clamp, add scaled delays, full interaction refactor) |
| `packages/kagi-sidecar/src/browser-service.test.ts` | Extend mockPage, add mockHumanInteraction, new test cases |
| `packages/kagi-sidecar/src/types/page.interface.ts` | Add `mouse`, `keyboard`, `type()`, `$()`, evaluate overloads |
| `packages/kagi-sidecar/src/constants/kagi-ui.ts` | Add `SOURCE_TEXT_INPUT` selector |
| `packages/kagi-sidecar/src/runtime-config.ts` | Default timeout `30_000` → `120_000` |
| `packages/kagi-sidecar/src/runtime-config.test.ts` | Update assertion for new default |
| `packages/kagi-sidecar/package.json` | Add `ghost-cursor`, `@forad/puppeteer-humanize` |

**Unchanged:** `packages/provider-kagi/`, `packages/dashboard/`, `src/server.ts`

---

## PR #1 — Input Clamping

### Task 1: Create input-clamping.ts and test

**Files:**

- Create: `packages/kagi-sidecar/src/constants/input-clamping.ts`
- Create: `packages/kagi-sidecar/src/constants/input-clamping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/kagi-sidecar/src/constants/input-clamping.test.ts
import { describe, expect, it } from 'bun:test'
import { MAX_INPUT_TEXT_LENGTH, clampInputText } from './input-clamping'

describe('clampInputText', () => {
  it('returns text unchanged when within limit', () => {
    expect(clampInputText('hello')).toBe('hello')
  })

  it('returns empty string unchanged', () => {
    expect(clampInputText('')).toBe('')
  })

  it('returns text unchanged at exact limit', () => {
    const text = 'a'.repeat(MAX_INPUT_TEXT_LENGTH)
    expect(clampInputText(text)).toBe(text)
  })

  it('truncates text exceeding 20k chars', () => {
    const text = 'a'.repeat(MAX_INPUT_TEXT_LENGTH + 500)
    const result = clampInputText(text)
    expect(result).toHaveLength(MAX_INPUT_TEXT_LENGTH)
    expect(result).toBe(text.slice(0, MAX_INPUT_TEXT_LENGTH))
  })

  it('MAX_INPUT_TEXT_LENGTH is 20000', () => {
    expect(MAX_INPUT_TEXT_LENGTH).toBe(20_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/constants/input-clamping.test.ts
```

Expected: `Cannot find module './input-clamping'`

- [ ] **Step 3: Write implementation**

```typescript
// packages/kagi-sidecar/src/constants/input-clamping.ts

/** Maximum character count for source text input. */
export const MAX_INPUT_TEXT_LENGTH = 20_000

/**
 * Clamp text to MAX_INPUT_TEXT_LENGTH characters.
 * Returns text unchanged if within limit; truncates otherwise.
 */
export function clampInputText(text: string): string {
  if (text.length <= MAX_INPUT_TEXT_LENGTH) return text
  return text.slice(0, MAX_INPUT_TEXT_LENGTH)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/kagi-sidecar && bun test src/constants/input-clamping.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Typecheck + lint**

```bash
cd packages/kagi-sidecar && bun run typecheck && bun run lint
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/constants/input-clamping.ts \
        packages/kagi-sidecar/src/constants/input-clamping.test.ts
git commit -m "feat(kagi-sidecar): add input clamping — truncate text > 20k chars"
```

---

### Task 2: Wire clampInputText into executeTranslation

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts:1,973-990`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe('KagiBrowserService', ...)` in `packages/kagi-sidecar/src/browser-service.test.ts`:

```typescript
it('truncates oversized input text and logs warning before translation', async () => {
  const service = createService()
  const longText = 'a'.repeat(25_000)

  const warnCalls: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args)
  }

  try {
    await service.translate({ text: longText, style: 'Clear' })
  } finally {
    console.warn = originalWarn
  }

  expect(warnCalls.some((args) => String(args[0]).includes('Input text truncated'))).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/browser-service.test.ts \
  --test-name-pattern="truncates oversized"
```

Expected: FAIL — no truncation warning in current code

- [ ] **Step 3: Add import in browser-service.ts**

In `packages/kagi-sidecar/src/browser-service.ts`, add after the `import { FORMALITY_LABELS... }` line (line 3–11 area):

```typescript
import { clampInputText } from './constants/input-clamping.js'
```

- [ ] **Step 4: Wire clamp at executeTranslation entry point**

In `executeTranslation()` (around line 973), replace:

```typescript
  private async executeTranslation(request: KagiTranslateRequest): Promise<string> {
    const startTime = Date.now()

    // Lookup preset for target style (guaranteed by KagiStyle type)
    const preset = KAGI_STYLE_PRESETS[request.style]

    console.log(`\n🎯 Translating with style: ${request.style}`)
```

With:

```typescript
  private async executeTranslation(request: KagiTranslateRequest): Promise<string> {
    const startTime = Date.now()

    // Lookup preset for target style (guaranteed by KagiStyle type)
    const preset = KAGI_STYLE_PRESETS[request.style]

    // Primary guard: clamp input text, log warning if truncated
    const originalLength = request.text.length
    const clampedText = clampInputText(request.text)
    if (clampedText.length < originalLength) {
      console.warn(
        `⚠️ Input text truncated: ${String(originalLength)} → ${String(clampedText.length)} chars (${String(originalLength - clampedText.length)} dropped)`,
      )
    }
    const charCount = clampedText.length

    console.log(`\n🎯 Translating with style: ${request.style}`)
```

- [ ] **Step 5: Use clampedText for navigation URL**

In `executeTranslation()`, replace:

```typescript
const simpleUrl = buildSimpleKagiUrl(request.text)
```

With:

```typescript
const simpleUrl = buildSimpleKagiUrl(clampedText)
```

- [ ] **Step 6: Run all tests**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 911+ tests pass, no errors

- [ ] **Step 7: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
        packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "feat(kagi-sidecar): wire input clamping into executeTranslation — PR #1 complete"
```

---

## PR #2 — Dynamic Delay

### Task 3: Create delay-config.ts and test

**Files:**

- Create: `packages/kagi-sidecar/src/constants/delay-config.ts`
- Create: `packages/kagi-sidecar/src/constants/delay-config.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/kagi-sidecar/src/constants/delay-config.test.ts
import { describe, expect, it } from 'bun:test'
import { HUMAN_INPUT_THRESHOLD, computeDelayMultiplier, computeScaledDelay } from './delay-config'

describe('computeDelayMultiplier', () => {
  it('returns 1.0 for 0 chars', () => expect(computeDelayMultiplier(0)).toBe(1.0))
  it('returns 1.0 for 2000 chars', () => expect(computeDelayMultiplier(2_000)).toBe(1.0))
  it('returns 1.5 for 2001 chars', () => expect(computeDelayMultiplier(2_001)).toBe(1.5))
  it('returns 1.5 for 8000 chars', () => expect(computeDelayMultiplier(8_000)).toBe(1.5))
  it('returns 2.5 for 8001 chars', () => expect(computeDelayMultiplier(8_001)).toBe(2.5))
  it('returns 2.5 for 15000 chars', () => expect(computeDelayMultiplier(15_000)).toBe(2.5))
  it('returns 4.0 for 15001 chars', () => expect(computeDelayMultiplier(15_001)).toBe(4.0))
  it('returns 4.0 for 20000 chars', () => expect(computeDelayMultiplier(20_000)).toBe(4.0))
})

describe('computeScaledDelay', () => {
  it('scales base 1000ms by 1.0x with neutral jitter (random=0.5)', () => {
    // 1000 * 1.0 = 1000; jitter = (0.5*0.2 - 0.1) * 1000 = 0
    expect(computeScaledDelay(1_000, 1_000, () => 0.5)).toBe(1_000)
  })

  it('scales base 2000ms by 1.5x with neutral jitter', () => {
    // 2000 * 1.5 = 3000; jitter = 0
    expect(computeScaledDelay(2_000, 5_000, () => 0.5)).toBe(3_000)
  })

  it('applies -10% jitter when random=0', () => {
    // 1000 * 1.0 = 1000; jitter = (0*0.2 - 0.1) * 1000 = -100 → 900
    expect(computeScaledDelay(1_000, 1_000, () => 0)).toBe(900)
  })

  it('applies +10% jitter when random=1', () => {
    // 1000 * 1.0 = 1000; jitter = (1*0.2 - 0.1) * 1000 = 100 → 1100
    expect(computeScaledDelay(1_000, 1_000, () => 1)).toBe(1_100)
  })

  it('applies 4.0x for 20k chars with neutral jitter', () => {
    // 1500 * 4.0 = 6000; jitter = 0
    expect(computeScaledDelay(1_500, 20_000, () => 0.5)).toBe(6_000)
  })
})

describe('HUMAN_INPUT_THRESHOLD', () => {
  it('is 500', () => expect(HUMAN_INPUT_THRESHOLD).toBe(500))
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/constants/delay-config.test.ts
```

Expected: `Cannot find module './delay-config'`

- [ ] **Step 3: Write implementation**

```typescript
// packages/kagi-sidecar/src/constants/delay-config.ts

/**
 * Char count threshold for choosing input strategy.
 * ≤ 500: typeIntoContentEditable. > 500: chunkPaste.
 */
export const HUMAN_INPUT_THRESHOLD = 500

/** 4-tier delay multiplier configuration. Checked in order; first match wins. */
export const DELAY_TIERS = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const

/**
 * Compute delay multiplier based on input text char count.
 *
 * | Range         | Multiplier |
 * |---------------|-----------|
 * | ≤ 2,000       | 1.0x      |
 * | 2,001–8,000   | 1.5x      |
 * | 8,001–15,000  | 2.5x      |
 * | 15,001–20,000 | 4.0x      |
 */
export function computeDelayMultiplier(charCount: number): number {
  for (const tier of DELAY_TIERS) {
    if (charCount <= tier.maxChars) return tier.multiplier
  }
  return 4.0
}

/**
 * Compute scaled delay with ±10% jitter.
 *
 * @param baseMs - Base delay in milliseconds
 * @param charCount - Input text char count (determines tier)
 * @param random - RNG function (default: Math.random, injectable for tests)
 */
export function computeScaledDelay(
  baseMs: number,
  charCount: number,
  random: () => number = Math.random,
): number {
  const multiplier = computeDelayMultiplier(charCount)
  const scaled = baseMs * multiplier
  const jitter = (random() * 0.2 - 0.1) * scaled
  return Math.round(scaled + jitter)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/kagi-sidecar && bun test src/constants/delay-config.test.ts
```

Expected: 14 tests pass

- [ ] **Step 5: Typecheck + lint**

```bash
cd packages/kagi-sidecar && bun run typecheck && bun run lint
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/constants/delay-config.ts \
        packages/kagi-sidecar/src/constants/delay-config.test.ts
git commit -m "feat(kagi-sidecar): add dynamic delay config — 4-tier scaling with ±10% jitter"
```

---

### Task 4: Wire computeScaledDelay into waitForTranslationOutputStable and Phase 2 delays

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts:841,1041-1058`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`

- [ ] **Step 1: Write a failing test for scaled stable window**

Add to `packages/kagi-sidecar/src/browser-service.test.ts` inside the `describe` block:

```typescript
it('waitForTranslationOutputStable uses scaled stable window proportional to charCount', async () => {
  // For 5000-char text (1.5x), stable window = computeScaledDelay(1500, 5000) ≈ 2250ms
  // We verify the poll loop eventually resolves even with a scaled window
  let callCount = 0
  mockPage.evaluate.mockImplementation(() => {
    callCount++
    // Return empty for first 2 polls, then return stable text
    if (callCount < 3) return Promise.resolve('')
    return Promise.resolve('Translated text')
  })

  const service = createService({ sleep: () => Promise.resolve() })

  const result = await service.translate({
    text: 'a'.repeat(5_000),
    style: 'Clear',
  })

  expect(result.translated).toBe('Translated text')
})
```

- [ ] **Step 2: Run to verify it fails (or passes incidentally)**

```bash
cd packages/kagi-sidecar && bun test src/browser-service.test.ts \
  --test-name-pattern="scaled stable window"
```

- [ ] **Step 3: Add import in browser-service.ts**

In `packages/kagi-sidecar/src/browser-service.ts`, add after the `clampInputText` import:

```typescript
import { computeScaledDelay } from './constants/delay-config.js'
```

- [ ] **Step 4: Add charCount parameter to waitForTranslationOutputStable**

Change the method signature at line ~841 from:

```typescript
  private async waitForTranslationOutputStable(page: PageLike): Promise<void> {
```

To:

```typescript
  private async waitForTranslationOutputStable(page: PageLike, charCount: number): Promise<void> {
```

Inside the method, change the stable check condition from:

```typescript
        if (Date.now() - lastChangeTime >= KAGI_TIMING.TRANSLATION_OUTPUT_STABLE_MS) {
```

To:

```typescript
        if (Date.now() - lastChangeTime >= computeScaledDelay(KAGI_TIMING.TRANSLATION_OUTPUT_STABLE_MS, charCount)) {
```

**Note:** `TRANSLATION_OUTPUT_MAX_WAIT_MS` (90s) stays unchanged — it is a fixed safety ceiling, NOT scaled.

- [ ] **Step 5: Update all call sites of waitForTranslationOutputStable**

In `executeTranslation()`, there are 3 calls to `this.waitForTranslationOutputStable(page)`. Update all three to pass `charCount`:

```typescript
// Line ~1067 (in chim mồi: wait Standard formality)
await this.waitForTranslationOutputStable(page, charCount)

// Line ~1099 (in chim mồi: wait new formality)
await this.waitForTranslationOutputStable(page, charCount)

// Line ~1105 (standard formality path)
await this.waitForTranslationOutputStable(page, charCount)
```

- [ ] **Step 6: Replace Phase 2 fixed delays with scaled delays**

In `executeTranslation()`, Phase 2 section.

**After `fillTranslationContext`**, replace:

```typescript
await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
this.verifyUrlContains(page, 'context=', 'Target: context')
```

With:

```typescript
await this.options.sleep(computeScaledDelay(1_500, charCount))
this.verifyUrlContains(page, 'context=', 'Target: context')
```

**After target `setReadingLevel`**, replace:

```typescript
await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
this.verifyUrlMatchesReadingLevel(page, preset.readingLevel, 'Target: reading level')
```

With:

```typescript
await this.options.sleep(computeScaledDelay(2_000, charCount))
this.verifyUrlMatchesReadingLevel(page, preset.readingLevel, 'Target: reading level')
```

**After target `clickTranslationStyleOption`**, replace:

```typescript
await this.options.sleep(KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS)
this.verifyUrlContains(page, 'style=literal', 'Target: translation style')
```

With:

```typescript
await this.options.sleep(computeScaledDelay(2_000, charCount))
this.verifyUrlContains(page, 'style=literal', 'Target: translation style')
```

**Phase 1 (baseline reset) delays all stay as `KAGI_TIMING.STYLE_OPTION_CLICK_GAP_MS` (200ms). Do not change them.**

- [ ] **Step 7: Run all tests**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
        packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "feat(kagi-sidecar): wire dynamic delay scaling into browser-service — PR #2 complete"
```

---

## PR #3 — Human Interaction

### Task 5: Add deps, extend PageLike, create IHumanInteraction, add SOURCE_TEXT_INPUT

**Files:**

- Modify: `packages/kagi-sidecar/package.json`
- Modify: `packages/kagi-sidecar/src/types/page.interface.ts`
- Create: `packages/kagi-sidecar/src/types/human-interaction.interface.ts`
- Modify: `packages/kagi-sidecar/src/constants/kagi-ui.ts`

- [ ] **Step 1: Add dependencies to package.json**

Edit `packages/kagi-sidecar/package.json` — replace dependencies block with:

```json
  "dependencies": {
    "@chatwork-bot/provider-kagi": "workspace:*",
    "@forad/puppeteer-humanize": "^1.1.8",
    "elysia": "^1.4.27",
    "ghost-cursor": "^1.4.2",
    "puppeteer-real-browser": "^1.4.4"
  }
```

- [ ] **Step 2: Install dependencies**

```bash
cd packages/kagi-sidecar && bun install
```

Expected: ghost-cursor and @forad/puppeteer-humanize installed, bun.lockb updated

- [ ] **Step 3: Extend PageLike in types/page.interface.ts**

Replace the entire contents of `packages/kagi-sidecar/src/types/page.interface.ts` with:

```typescript
/**
 * Minimal interface for element handles returned by waitForSelector or $().
 * Allows clicking elements after they're found.
 */
export interface ElementHandleLike {
  /**
   * Click this element.
   * @throws Error if element not clickable
   */
  click(): Promise<void>
}

export interface PageLike {
  // ═══════════════════════════════════════════════════════════
  // NAVIGATION & WAITING
  // ═══════════════════════════════════════════════════════════

  goto(url: string, options?: unknown): Promise<unknown>

  /** Wait for selector to appear in DOM. */
  waitForSelector(selector: string, options?: unknown): Promise<ElementHandleLike | null>

  /**
   * Wait for a function to return truthy value.
   * Used for polling URL changes, slider values, content stability.
   */
  waitForFunction(
    fn: (...args: unknown[]) => unknown,
    options?: { timeout?: number; polling?: number | 'raf' | 'mutation' },
    ...args: unknown[]
  ): Promise<void>

  /** Get current page URL (address bar). */
  url(): string

  // ═══════════════════════════════════════════════════════════
  // EVALUATE — Overloads for typed call sites
  // ═══════════════════════════════════════════════════════════

  /** Single-arg evaluate — matches existing browser-service.ts patterns. */
  evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>

  /**
   * Two-arg evaluate — used by HumanInteractionService.dragSlider and
   * typeIntoContentEditable fallback paths.
   */
  evaluate<TArg1, TArg2, TResult>(
    fn: (arg1: TArg1, arg2: TArg2) => TResult,
    arg1: TArg1,
    arg2: TArg2,
  ): Promise<TResult>

  /** Three-arg evaluate — used by HumanInteractionService.clickByTextContent. */
  evaluate<TArg1, TArg2, TArg3, TResult>(
    fn: (arg1: TArg1, arg2: TArg2, arg3: TArg3) => TResult,
    arg1: TArg1,
    arg2: TArg2,
    arg3: TArg3,
  ): Promise<TResult>

  /** Spread fallback — handles any remaining call patterns. */
  evaluate<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>

  /** Evaluate function with selector and return result ($eval pattern). */
  $eval<T>(selector: string, fn: (element: Element) => T): Promise<T>

  // ═══════════════════════════════════════════════════════════
  // ELEMENT INTERACTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Click element matching selector.
   * @throws Error if element not found or not clickable
   */
  click(selector: string): Promise<void>

  /**
   * Focus element matching selector.
   * @throws Error if element not found
   */
  focus(selector: string): Promise<void>

  /**
   * Type text into element matching selector.
   * @param options.delay - Delay between keystrokes in ms
   */
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>

  /**
   * Query single element matching selector.
   * Returns null if not found.
   */
  $(selector: string): Promise<ElementHandleLike | null>

  // ═══════════════════════════════════════════════════════════
  // LOW-LEVEL MOUSE & KEYBOARD — For HumanInteractionService
  // ═══════════════════════════════════════════════════════════

  /** Low-level mouse control for Bezier movement simulation. */
  mouse: {
    move(x: number, y: number): Promise<void>
    down(): Promise<void>
    up(): Promise<void>
  }

  /** Low-level keyboard control for modifier key simulation. */
  keyboard: {
    down(key: string): Promise<void>
    press(key: string): Promise<void>
    up(key: string): Promise<void>
  }
}
```

- [ ] **Step 4: Create IHumanInteraction interface**

```typescript
// packages/kagi-sidecar/src/types/human-interaction.interface.ts
import type { PageLike } from './page.interface.js'

/** Contract for human-like browser interaction methods. */
export interface IHumanInteraction {
  /**
   * Bezier mouse movement → click at selector.
   * Fallback: page.click(selector) when rect invalid or ghost-cursor throws.
   */
  click(page: PageLike, selector: string): Promise<void>

  /**
   * Find span by textContent, click its closest button ancestor.
   * Fallback: evaluate click when rect invalid or exception occurs.
   *
   * @param matchIndex - Index in the list of matching spans (0-based)
   */
  clickByTextContent(
    page: PageLike,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /**
   * Natural typing with mistake simulation into a textarea.
   * Fallback: page.type() with fixed 80ms delay.
   */
  typeIntoTextarea(page: PageLike, selector: string, text: string): Promise<void>

  /**
   * Per-character keystroke typing with variable speed into contenteditable.
   * Fallback: execCommand('insertText').
   */
  typeIntoContentEditable(page: PageLike, selector: string, text: string): Promise<void>

  /**
   * Drag slider from fromStep to toStep via Bezier mouse movement.
   * Steps are integer values matching slider min/max (0–6).
   * Fallback: evaluate set slider.value + dispatch events.
   */
  dragSlider(
    page: PageLike,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void>

  /**
   * Paste text in chunks via Clipboard API + Ctrl/Cmd+V.
   * Types last 3–5 chars via keystrokes to simulate editing.
   * Short text (≤10 chars): delegates to typeIntoContentEditable.
   */
  chunkPaste(page: PageLike, selector: string, text: string): Promise<void>
}
```

- [ ] **Step 5: Add SOURCE_TEXT_INPUT to kagi-ui.ts**

In `packages/kagi-sidecar/src/constants/kagi-ui.ts`, add to the `KAGI_SELECTORS` object after `TRANSLATION_SETTINGS_BUTTON`:

```typescript
  /** Source text input contenteditable area */
  SOURCE_TEXT_INPUT: '[aria-label="Source text input"]',
```

- [ ] **Step 6: Verify typecheck**

```bash
cd packages/kagi-sidecar && bun run typecheck
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/kagi-sidecar/package.json \
        bun.lockb \
        packages/kagi-sidecar/src/types/page.interface.ts \
        packages/kagi-sidecar/src/types/human-interaction.interface.ts \
        packages/kagi-sidecar/src/constants/kagi-ui.ts
git commit -m "feat(kagi-sidecar): add HI deps, extend PageLike, IHumanInteraction interface, SOURCE_TEXT_INPUT"
```

---

### Task 6: Create HumanInteractionService and test

**Files:**

- Create: `packages/kagi-sidecar/src/services/human-interaction.service.ts`
- Create: `packages/kagi-sidecar/src/services/human-interaction.service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/kagi-sidecar/src/services/human-interaction.service.test.ts
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { ElementHandleLike, PageLike } from '../types/page.interface'
import { HumanInteractionService } from './human-interaction.service'

// Mock ghost-cursor — tests verify fallback paths, not ghost-cursor integration
void mock.module('ghost-cursor', () => ({
  createCursor: (_page: unknown) => ({
    move: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
  }),
}))

// Mock @forad/puppeteer-humanize
void mock.module('@forad/puppeteer-humanize', () => ({
  typeInto: mock((_el: unknown, _text: string) => Promise.resolve()),
}))

const mockElementHandle: ElementHandleLike = {
  click: mock(() => Promise.resolve()),
}

function makePageLike(overrides: Partial<PageLike> = {}): PageLike {
  return {
    goto: mock(() => Promise.resolve(null)),
    waitForSelector: mock(() => Promise.resolve(mockElementHandle)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evaluate: mock((_fn: unknown, ..._args: unknown[]) => Promise.resolve(null)) as any,
    $eval: mock(() => Promise.resolve(null)),
    waitForFunction: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
    focus: mock(() => Promise.resolve()),
    url: mock(() => 'https://translate.kagi.com/'),
    type: mock(() => Promise.resolve()),
    $: mock(() => Promise.resolve(null)),
    mouse: {
      move: mock(() => Promise.resolve()),
      down: mock(() => Promise.resolve()),
      up: mock(() => Promise.resolve()),
    },
    keyboard: {
      down: mock(() => Promise.resolve()),
      press: mock(() => Promise.resolve()),
      up: mock(() => Promise.resolve()),
    },
    ...overrides,
  }
}

describe('HumanInteractionService', () => {
  let service: HumanInteractionService

  beforeEach(() => {
    service = new HumanInteractionService()
  })

  describe('click', () => {
    it('falls back to page.click when bounding rect width is 0', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, top: 0, left: 0 })),
      })
      await service.click(page, '[aria-label="test"]')
      expect(page.click).toHaveBeenCalledWith('[aria-label="test"]')
    })

    it('falls back to page.click and logs warning on exception', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.reject(new Error('evaluate failed'))),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.click(page, '[aria-label="test"]')
      expect(page.click).toHaveBeenCalledWith('[aria-label="test"]')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to standard click'))
      warnSpy.mockRestore()
    })
  })

  describe('clickByTextContent', () => {
    it('falls back to evaluate click when rect is invalid and logs warning', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, top: -1, left: -1 })),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.clickByTextContent(page, 'span.flex-grow', 'Unknown', 0)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to evaluate click'))
      warnSpy.mockRestore()
    })
  })

  describe('typeIntoTextarea', () => {
    it('falls back to page.type when element not found', async () => {
      const page = makePageLike({
        $: mock(() => Promise.resolve(null)),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.typeIntoTextarea(page, 'textarea', 'hello')
      expect(page.type).toHaveBeenCalledWith('textarea', 'hello', { delay: 80 })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Degraded to page.type'))
      warnSpy.mockRestore()
    })
  })

  describe('dragSlider', () => {
    it('falls back to evaluate set value when rect width is 0 and logs warning', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve({ width: 0, height: 0, left: 0, top: 0 })),
      })
      const warnSpy = spyOn(console, 'warn')
      await service.dragSlider(page, 'input[type="range"]', 0, 3)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Degraded to evaluate set value for slider'),
      )
      warnSpy.mockRestore()
    })
  })

  describe('chunkPaste', () => {
    it('delegates to typeIntoContentEditable for short text (≤10 chars)', async () => {
      const page = makePageLike()
      const typeSpy = spyOn(service, 'typeIntoContentEditable').mockImplementation(() =>
        Promise.resolve(),
      )
      await service.chunkPaste(page, '[aria-label="Source"]', 'hi')
      expect(typeSpy).toHaveBeenCalledWith(page, '[aria-label="Source"]', 'hi')
      typeSpy.mockRestore()
    })

    it('uses keyboard.down for paste modifier on longer text', async () => {
      const page = makePageLike({
        evaluate: mock(() => Promise.resolve(undefined)),
        waitForFunction: mock(() => Promise.resolve()),
      })
      // Spy typeIntoContentEditable to avoid slow keystroke loop
      spyOn(service, 'typeIntoContentEditable').mockImplementation(() => Promise.resolve())
      const longText = 'a'.repeat(600)
      await service.chunkPaste(page, '[aria-label="Source"]', longText)
      expect(page.keyboard.down).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/services/human-interaction.service.test.ts
```

Expected: `Cannot find module './human-interaction.service'`

- [ ] **Step 3: Write implementation**

```typescript
// packages/kagi-sidecar/src/services/human-interaction.service.ts

/**
 * Human-like interaction implementation using ghost-cursor and @forad/puppeteer-humanize.
 *
 * All methods degrade gracefully when ghost-cursor fails (e.g., Docker/Xvfb with
 * bounding rect width=0). Fallback uses standard PageLike APIs and logs a warning.
 *
 * @remarks
 * Implementation requires a runtime Page from puppeteer-real-browser.
 * PageLike is the compile-time contract; ghost-cursor createCursor(page as unknown)
 * and puppeteer-humanize typeInto(handle, ...) rely on runtime objects richer than
 * compile-time PageLike. Tests verify fallback paths with mock PageLike only —
 * not ghost-cursor/puppeteer-humanize integration.
 */

import type { IHumanInteraction } from '../types/human-interaction.interface.js'
import type { PageLike } from '../types/page.interface.js'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- ghost-cursor has incomplete types for puppeteer-core Page
const { createCursor } = require('ghost-cursor') as {
  createCursor: (page: unknown) => {
    move: (sel: string) => Promise<void>
    click: (sel: string) => Promise<void>
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- scoped package, runtime require matches plan
const { typeInto } = require('@forad/puppeteer-humanize') as {
  typeInto: (el: unknown, text: string, opts?: Record<string, unknown>) => Promise<void>
}

/** Checks if bounding rect is valid (non-zero size, non-negative coords). Docker-safe guard. */
function isValidRect(rect: { width: number; height: number; top: number; left: number }): boolean {
  return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0
}

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Delay helper */
async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Paste shortcut modifier key */
const PASTE_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

export class HumanInteractionService implements IHumanInteraction {
  async click(page: PageLike, selector: string): Promise<void> {
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

      const cursor = createCursor(page as unknown)
      await cursor.move(selector)
      await cursor.click(selector)
    } catch {
      console.warn(`⚠️ Degraded to standard click: ${selector}`)
      await page.click(selector)
    }
  }

  async clickByTextContent(
    page: PageLike,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void> {
    try {
      const rect = await page.evaluate(
        (sel: string, targetText: string, idx: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          if (!el) return { width: 0, height: 0, top: -1, left: -1 }
          const btn = el.closest('button')
          if (!btn) return { width: 0, height: 0, top: -1, left: -1 }
          const r = btn.getBoundingClientRect()
          return { width: r.width, height: r.height, top: r.top, left: r.left }
        },
        spanSelector,
        text,
        matchIndex,
      )

      if (!isValidRect(rect)) {
        await page.evaluate(
          (sel: string, targetText: string, idx: number) => {
            const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
            const matches = spans.filter((el) => el.textContent?.trim() === targetText)
            const el = matches[idx]
            const btn = el?.closest('button')
            btn?.click()
          },
          spanSelector,
          text,
          matchIndex,
        )
        console.warn(`⚠️ Degraded to evaluate click: "${text}" at index ${matchIndex}`)
        return
      }

      const centerX = rect.left + rect.width / 2 + randInt(-3, 3)
      const centerY = rect.top + rect.height / 2 + randInt(-3, 3)
      await page.mouse.move(centerX, centerY)
      await page.mouse.down()
      await sleep(randInt(40, 120))
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate click: "${text}"`)
      await page.evaluate(
        (sel: string, targetText: string, idx: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === targetText)
          const el = matches[idx]
          el?.closest('button')?.click()
        },
        spanSelector,
        text,
        matchIndex,
      )
    }
  }

  async typeIntoTextarea(page: PageLike, selector: string, text: string): Promise<void> {
    try {
      const handle = await page.$(selector)
      if (!handle) throw new Error(`Element not found: ${selector}`)
      await typeInto(handle as unknown, text, {
        mistakes: { chance: 3, delay: { min: 50, max: 150 } },
      })
    } catch {
      console.warn(`⚠️ Degraded to page.type() for textarea: ${selector}`)
      await page.type(selector, text, { delay: 80 })
    }
  }

  async typeIntoContentEditable(page: PageLike, selector: string, text: string): Promise<void> {
    try {
      const PUNCTUATION = new Set(['.', ',', '!', '?', ';', ':'])
      for (const char of text) {
        const delay = randInt(50, 150)
        await page.type(selector, char, { delay })
        if (PUNCTUATION.has(char)) {
          await sleep(randInt(100, 300))
        }
      }
    } catch {
      console.warn(`⚠️ Degraded to execCommand insertText: ${selector}`)
      await page.evaluate(
        (sel: string, value: string) => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (!el) return
          el.focus()
          /* eslint-disable-next-line @typescript-eslint/no-deprecated */
          document.execCommand('insertText', false, value)
        },
        selector,
        text,
      )
    }
  }

  async dragSlider(
    page: PageLike,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void> {
    try {
      const rect = await page.evaluate((sel: string) => {
        const slider = document.querySelector<HTMLInputElement>(sel)
        if (!slider) return { width: 0, height: 0, left: 0, top: 0 }
        const r = slider.getBoundingClientRect()
        return { width: r.width, height: r.height, left: r.left, top: r.top }
      }, sliderSelector)

      if (!isValidRect(rect) || rect.width === 0) {
        await page.evaluate(
          (sel: string, nextValue: number) => {
            const slider = document.querySelector<HTMLInputElement>(sel)
            if (!slider) return
            slider.focus()
            slider.value = String(nextValue)
            slider.style.setProperty('--slider-position', String(nextValue))
            slider.dispatchEvent(new Event('input', { bubbles: true }))
            slider.dispatchEvent(new Event('change', { bubbles: true }))
          },
          sliderSelector,
          toStep,
        )
        console.warn(`⚠️ Degraded to evaluate set value for slider: step ${String(toStep)}`)
        return
      }

      const maxSteps = 6
      const fromX = rect.left + (fromStep / maxSteps) * rect.width
      const toX = rect.left + (toStep / maxSteps) * rect.width
      const y = rect.top + rect.height / 2

      await page.mouse.move(fromX, y)
      await page.mouse.down()
      await sleep(randInt(50, 150))
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const x = fromX + ((toX - fromX) * i) / steps
        await page.mouse.move(x, y + randInt(-2, 2))
        await sleep(randInt(10, 30))
      }
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate set value for slider: step ${String(toStep)}`)
      await page.evaluate(
        (sel: string, nextValue: number) => {
          const slider = document.querySelector<HTMLInputElement>(sel)
          if (!slider) return
          slider.focus()
          slider.value = String(nextValue)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
          slider.dispatchEvent(new Event('change', { bubbles: true }))
        },
        sliderSelector,
        toStep,
      )
    }
  }

  async chunkPaste(page: PageLike, selector: string, text: string): Promise<void> {
    if (text.length <= 10) {
      await this.typeIntoContentEditable(page, selector, text)
      return
    }

    const CHUNK_MIN = 500
    const CHUNK_MAX = 2_000
    const TAIL_CHARS = randInt(3, 5)

    const body = text.slice(0, text.length - TAIL_CHARS)
    const tail = text.slice(text.length - TAIL_CHARS)

    await page.click(selector)
    await page.focus(selector)

    await page.waitForFunction(
      (sel: string) => document.activeElement?.matches(sel) ?? false,
      { timeout: 3_000 },
      selector,
    )

    let offset = 0
    while (offset < body.length) {
      const chunkSize = Math.min(randInt(CHUNK_MIN, CHUNK_MAX), body.length - offset)
      const chunk = body.slice(offset, offset + chunkSize)
      offset += chunkSize

      await page.evaluate((t: string) => {
        return navigator.clipboard.writeText(t)
      }, chunk)

      await page.keyboard.down(PASTE_MODIFIER)
      await page.keyboard.press('v')
      await page.keyboard.up(PASTE_MODIFIER)

      await sleep(randInt(200, 800))
    }

    await this.typeIntoContentEditable(page, selector, tail)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/kagi-sidecar && bun test src/services/human-interaction.service.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Typecheck + lint**

```bash
cd packages/kagi-sidecar && bun run typecheck && bun run lint
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/services/human-interaction.service.ts \
        packages/kagi-sidecar/src/services/human-interaction.service.test.ts
git commit -m "feat(kagi-sidecar): add HumanInteractionService with ghost-cursor + graceful fallbacks"
```

---

### Task 7: browser-service.ts structural — remove inline PageLike, add HIS DI, extend test infra

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts:1-46,117-128,169-196`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts:52-163`

- [ ] **Step 1: Remove inline ElementHandleLike + inline PageLike from browser-service.ts**

Delete lines 13–46 from `browser-service.ts`:

```typescript
/** Handle returned by waitForSelector for elements that can be clicked. */
export interface ElementHandleLike {
  click(): Promise<void>
}

interface PageLike {
  goto(
    url: string,
    options?: {
      waitUntil?: 'networkidle2' | 'load' | 'domcontentloaded'
      timeout?: number
    },
  ): Promise<unknown>
  waitForSelector(
    selector: string,
    options?: {
      timeout?: number
      visible?: boolean
    },
  ): Promise<ElementHandleLike | null>
  evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>
  /** Current page URL (address bar). Used for two-phase URL verification. */
  url(): string
  /** Focus element matching selector (e.g. translation context textarea). */
  focus(selector: string): Promise<void>
  /** Wait for function to return truthy in page context (polling with timeout). */
  waitForFunction<TArg>(
    fn: (arg: TArg) => boolean,
    options: { timeout: number; polling: number },
    arg: TArg,
  ): Promise<unknown>
  /** Evaluate function with selector and return result ($eval pattern). */
  $eval<TResult>(selector: string, fn: (el: Element) => TResult): Promise<TResult>
}
```

Replace with import + re-export (keep `ElementHandleLike` exported for test compatibility):

```typescript
import type { ElementHandleLike, PageLike } from './types/page.interface.js'

export type { ElementHandleLike }
```

- [ ] **Step 2: Add IHumanInteraction imports**

After the `import { FORMALITY_LABELS... }` line, add:

```typescript
import type { IHumanInteraction } from './types/human-interaction.interface.js'
import { HumanInteractionService } from './services/human-interaction.service.js'
```

- [ ] **Step 3: Add humanInteraction to KagiBrowserServiceOptions interface**

In `KagiBrowserServiceOptions` (around line 117), add:

```typescript
export interface KagiBrowserServiceOptions {
  minIntervalMs: number
  maxQueueDepth: number
  maxQueueWaitMs: number
  maxRetries: number
  retryBaseMs: number
  requestTimeoutMs: number
  sleep(ms: number): Promise<void>
  now(): number
  random(): number
  connect: BrowserConnect
  humanInteraction?: IHumanInteraction
}
```

- [ ] **Step 4: Add private field and wire in constructor**

In `KagiBrowserService` class, add the private field alongside other fields:

```typescript
  private readonly humanInteraction: IHumanInteraction
```

In the constructor, after the `this.options = { ... }` assignment block, add:

```typescript
this.humanInteraction = options.humanInteraction ?? new HumanInteractionService()
```

- [ ] **Step 5: Extend mockPage and add mockHumanInteraction in browser-service.test.ts**

Replace the `const mockPage = { ... }` block with the extended version (adds `type`, `$`, `mouse`, `keyboard`):

```typescript
const mockHumanInteraction = {
  click: mock(() => Promise.resolve()),
  clickByTextContent: mock(() => Promise.resolve()),
  typeIntoTextarea: mock(() => Promise.resolve()),
  typeIntoContentEditable: mock(() => Promise.resolve()),
  dragSlider: mock(() => Promise.resolve()),
  chunkPaste: mock(() => Promise.resolve()),
}

const mockPage = {
  setRequestInterception: mock((_enabled: boolean) => Promise.resolve()),
  on: mock((_event: string, _handler: unknown) => undefined),
  goto: mock((_url: string) => Promise.resolve()),
  waitForSelector: mock((_selector: string) => Promise.resolve(mockElementHandle)),
  focus: mock((_selector: string) => Promise.resolve()),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate: mock(
    (_fn: unknown, ..._args: unknown[]): Promise<unknown> => Promise.resolve('Xin chao'),
  ) as any,
  content: mock(() => Promise.resolve('<main>translated</main>')),
  close: mock(() => Promise.resolve()),
  url: mock(() => 'https://translate.kagi.com/?from=auto&to=vi&text=test'),
  waitForFunction: mock((_fn: unknown, _options: unknown, _arg?: unknown) => Promise.resolve()),
  $eval: mock((_selector: string, _fn: unknown) => Promise.resolve('Xin chao')),
  click: mock((_selector: string) => Promise.resolve()),
  type: mock((_selector: string, _text: string, _options?: unknown) => Promise.resolve()),
  $: mock((_selector: string) => Promise.resolve(mockElementHandle)),
  mouse: {
    move: mock((_x: number, _y: number) => Promise.resolve()),
    down: mock(() => Promise.resolve()),
    up: mock(() => Promise.resolve()),
  },
  keyboard: {
    down: mock((_key: string) => Promise.resolve()),
    press: mock((_key: string) => Promise.resolve()),
    up: mock((_key: string) => Promise.resolve()),
  },
}
```

- [ ] **Step 6: Add mockHumanInteraction resets in beforeEach**

In the `beforeEach` block, add resets for mockHumanInteraction after the other mock resets:

```typescript
mockHumanInteraction.click.mockReset()
mockHumanInteraction.click.mockImplementation(() => Promise.resolve())
mockHumanInteraction.clickByTextContent.mockReset()
mockHumanInteraction.clickByTextContent.mockImplementation(() => Promise.resolve())
mockHumanInteraction.typeIntoTextarea.mockReset()
mockHumanInteraction.typeIntoTextarea.mockImplementation(() => Promise.resolve())
mockHumanInteraction.typeIntoContentEditable.mockReset()
mockHumanInteraction.typeIntoContentEditable.mockImplementation(() => Promise.resolve())
mockHumanInteraction.dragSlider.mockReset()
mockHumanInteraction.dragSlider.mockImplementation(() => Promise.resolve())
mockHumanInteraction.chunkPaste.mockReset()
mockHumanInteraction.chunkPaste.mockImplementation(() => Promise.resolve())
```

Also add resets for the new mockPage fields:

```typescript
mockPage.click.mockReset()
mockPage.click.mockImplementation(() => Promise.resolve())
mockPage.type.mockReset()
mockPage.type.mockImplementation(() => Promise.resolve())
mockPage.$.mockReset()
mockPage.$.mockImplementation(() => Promise.resolve(mockElementHandle))
mockPage.mouse.move.mockReset()
mockPage.mouse.move.mockImplementation(() => Promise.resolve())
mockPage.mouse.down.mockReset()
mockPage.mouse.down.mockImplementation(() => Promise.resolve())
mockPage.mouse.up.mockReset()
mockPage.mouse.up.mockImplementation(() => Promise.resolve())
mockPage.keyboard.down.mockReset()
mockPage.keyboard.down.mockImplementation(() => Promise.resolve())
mockPage.keyboard.press.mockReset()
mockPage.keyboard.press.mockImplementation(() => Promise.resolve())
mockPage.keyboard.up.mockReset()
mockPage.keyboard.up.mockImplementation(() => Promise.resolve())
```

- [ ] **Step 7: Inject mockHumanInteraction in createService**

Update the `createService` helper to inject `mockHumanInteraction` by default:

```typescript
function createService(overrides: ConstructorParameters<typeof KagiBrowserService>[0] = {}) {
  return new KagiBrowserService({
    minIntervalMs: 0,
    maxQueueDepth: 10,
    maxQueueWaitMs: 10_000,
    maxRetries: 0,
    sleep: (_ms) => Promise.resolve(),
    humanInteraction: mockHumanInteraction,
    ...overrides,
  })
}
```

- [ ] **Step 8: Run tests to verify all pass**

```bash
cd packages/kagi-sidecar && bun test && bun run typecheck
```

Expected: All tests pass, no typecheck errors

- [ ] **Step 9: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
        packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "refactor(kagi-sidecar): remove inline PageLike, inject IHumanInteraction, extend test infra"
```

---

### Task 8: Navigate-without-text + clearSourceTextInput + fillSourceTextInput

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts:1,462-491,973-994`

- [ ] **Step 1: Write failing tests**

Add to `packages/kagi-sidecar/src/browser-service.test.ts`:

```typescript
it('navigates to language-pair URL without text', async () => {
  const service = createService()
  await service.translate({ text: 'Hello', style: 'Clear' })
  const gotoUrl = mockPage.goto.mock.calls[0]?.[0] as string
  expect(gotoUrl).toBe('https://translate.kagi.com/?from=auto&to=vi')
  expect(gotoUrl).not.toContain('text=')
})

it('calls chunkPaste for text longer than HUMAN_INPUT_THRESHOLD (>500 chars)', async () => {
  const service = createService()
  await service.translate({ text: 'a'.repeat(600), style: 'Clear' })
  expect(mockHumanInteraction.chunkPaste).toHaveBeenCalledTimes(1)
  expect(mockHumanInteraction.typeIntoContentEditable).not.toHaveBeenCalled()
})

it('calls typeIntoContentEditable for text at or below HUMAN_INPUT_THRESHOLD', async () => {
  const service = createService()
  await service.translate({ text: 'Short text', style: 'Clear' })
  expect(mockHumanInteraction.typeIntoContentEditable).toHaveBeenCalledTimes(1)
  expect(mockHumanInteraction.chunkPaste).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd packages/kagi-sidecar && bun test src/browser-service.test.ts \
  --test-name-pattern="navigates to language-pair"
```

Expected: FAIL — current code navigates with `buildSimpleKagiUrl`

- [ ] **Step 3: Update import — remove buildSimpleKagiUrl**

In `browser-service.ts`, change:

```typescript
import { buildSimpleKagiUrl, KAGI_STYLE_PRESETS } from '@chatwork-bot/provider-kagi'
```

To:

```typescript
import { KAGI_STYLE_PRESETS } from '@chatwork-bot/provider-kagi'
```

Also update the delay-config import to include `HUMAN_INPUT_THRESHOLD`:

```typescript
import { computeScaledDelay, HUMAN_INPUT_THRESHOLD } from './constants/delay-config.js'
```

- [ ] **Step 4: Add clearSourceTextInput method**

Add after `clearTranslationContext` method:

```typescript
  /**
   * Clear source text input (selectAll + delete via evaluate).
   * Uses evaluate — preparation step, not human interaction.
   */
  private async clearSourceTextInput(page: PageLike): Promise<void> {
    const selector = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    await page.evaluate((sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return
      el.focus()
      /* eslint-disable-next-line @typescript-eslint/no-deprecated */
      document.execCommand('selectAll', false)
      /* eslint-disable-next-line @typescript-eslint/no-deprecated */
      document.execCommand('delete', false)
    }, selector)
    console.log('🧹 Cleared source text input')
  }
```

- [ ] **Step 5: Add fillSourceTextInput method**

Add after `clearSourceTextInput`:

```typescript
  /**
   * Fill source text input with human-like interaction.
   * ≤500 chars: typeIntoContentEditable (per-keystroke, variable speed).
   * >500 chars: chunkPaste (clipboard chunks + keystroke tail).
   * Includes defensive silent clamp as safety net.
   */
  private async fillSourceTextInput(
    page: PageLike,
    text: string,
    charCount: number,
  ): Promise<void> {
    const clampedText = clampInputText(text) // defensive silent clamp, no log
    const selector = KAGI_SELECTORS.SOURCE_TEXT_INPUT
    if (charCount <= HUMAN_INPUT_THRESHOLD) {
      await this.humanInteraction.typeIntoContentEditable(page, selector, clampedText)
    } else {
      await this.humanInteraction.chunkPaste(page, selector, clampedText)
    }
    console.log(`✍️  Filled source text: ${String(charCount)} chars`)
  }
```

- [ ] **Step 6: Update executeTranslation — change navigation + add source text entry**

In `executeTranslation()`, replace the navigation block:

```typescript
const page = await this.ensurePage()

// 1. Navigate to simple URL (no style params)
const simpleUrl = buildSimpleKagiUrl(clampedText)
console.log(`🌐 Navigating to: ${simpleUrl}`)
await page.goto(simpleUrl, { waitUntil: 'networkidle2' })

// 2. Open Translation Settings dialog
await this.clickTranslationSettingsButton(page)
```

With:

```typescript
const page = await this.ensurePage()

// 1. Navigate to language-pair URL only (text entered via human interaction)
const navUrl = 'https://translate.kagi.com/?from=auto&to=vi'
console.log(`🌐 Navigating to: ${navUrl}`)
await page.goto(navUrl, { waitUntil: 'networkidle2' })

// 2. Clear and fill source text (human-like)
await this.clearSourceTextInput(page)
await this.fillSourceTextInput(page, clampedText, charCount)

// 3. Open Translation Settings dialog
await this.clickTranslationSettingsButton(page)
```

- [ ] **Step 7: Run all tests**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
        packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "feat(kagi-sidecar): navigate without text, add clearSourceTextInput + fillSourceTextInput"
```

---

### Task 9: Refactor all interaction methods → HIS; remove clickSettingsOptionBySpanLabel; remove context URL verify

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts:426-799,1041-1045`

This task replaces every machine-like interaction with `this.humanInteraction.*` calls, deletes the now-unused `clickSettingsOptionBySpanLabel` method, and removes the context URL verify that doesn't work with human typing.

- [ ] **Step 1: Refactor clickTranslationSettingsButton**

Replace the body of `clickTranslationSettingsButton` (lines 426–457). Change the `try` block from:

```typescript
    try {
      const handle = await page.waitForSelector(KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON, {
        visible: true,
        timeout: 30_000,
      })

      if (handle === null) {
        throw new Error('Translation Settings button not found')
      }

      await handle.click()
      console.log('⚙️  Clicked Translation Settings button')
    } catch (error: unknown) {
```

To:

```typescript
    try {
      await this.humanInteraction.click(page, KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON)
      console.log('⚙️  Clicked Translation Settings button')
    } catch (error: unknown) {
```

- [ ] **Step 2: Refactor fillTranslationContext**

Replace the `try` block in `fillTranslationContext` (lines 496–530). Change from the `page.evaluate(set textarea.value)` approach to:

```typescript
try {
  await this.humanInteraction.typeIntoTextarea(page, KAGI_SELECTORS.CONTEXT_TEXTAREA, context)
  const preview = context.length > 50 ? `${context.slice(0, 50)}...` : context
  console.log(`📝 Filled context: "${preview}"`)
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[UI_INTERACTION] Failed to fill context textarea', {
    step: 'fillTranslationContext',
    selector: KAGI_SELECTORS.CONTEXT_TEXTAREA,
    contextLength: context.length,
    error: message,
    timestamp: new Date().toISOString(),
  })
  throw new KagiSidecarError('UI_INTERACTION', `Failed to fill context textarea: ${message}`, {
    status: 502,
    cause: error,
  })
}
```

- [ ] **Step 3: Delete clickSettingsOptionBySpanLabel method**

Delete lines 532–590 — the entire `private async clickSettingsOptionBySpanLabel(...)` method. Its callers (`clickSpeakerGenderOption`, `clickAddresseeGenderOption`, `clickTranslationStyleOption`) are replaced in next steps.

- [ ] **Step 4: Refactor clickSpeakerGenderOption**

Replace the entire method body (currently delegates to `clickSettingsOptionBySpanLabel`):

```typescript
  private async clickSpeakerGenderOption(page: PageLike, label: string): Promise<void> {
    try {
      await this.humanInteraction.clickByTextContent(page, KAGI_SELECTORS.GENDER_LABEL, label, 0)
      console.log(`🗣️  Clicked speaker gender: "${label}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click speaker gender', {
        step: 'clickSpeakerGenderOption',
        selector: KAGI_SELECTORS.GENDER_LABEL,
        label,
        error: message,
        timestamp: new Date().toISOString(),
      })
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click speaker gender "${label}": ${message}`,
        { status: 502, cause: error },
      )
    }
  }
```

- [ ] **Step 5: Refactor clickAddresseeGenderOption**

Replace the entire method body:

```typescript
  private async clickAddresseeGenderOption(page: PageLike, label: string): Promise<void> {
    try {
      await this.humanInteraction.clickByTextContent(page, KAGI_SELECTORS.GENDER_LABEL, label, 1)
      console.log(`👤 Clicked addressee gender: "${label}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click addressee gender', {
        step: 'clickAddresseeGenderOption',
        selector: KAGI_SELECTORS.GENDER_LABEL,
        label,
        error: message,
        timestamp: new Date().toISOString(),
      })
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click addressee gender "${label}": ${message}`,
        { status: 502, cause: error },
      )
    }
  }
```

- [ ] **Step 6: Refactor setReadingLevel**

Replace the entire method body — reads current slider step first, then drags:

```typescript
  private async setReadingLevel(page: PageLike, level: string): Promise<void> {
    try {
      const targetStep = READING_LEVEL_TO_STEP[level]
      if (targetStep === undefined) {
        throw new Error(`Unknown reading level: ${level}`)
      }

      const currentStep = await page.$eval(
        KAGI_SELECTORS.READING_LEVEL_SLIDER,
        (el) => Number((el as HTMLInputElement).value),
      )

      await this.humanInteraction.dragSlider(
        page,
        KAGI_SELECTORS.READING_LEVEL_SLIDER,
        currentStep,
        targetStep,
      )

      console.log(`📊 Set reading level: "${level}" (step ${String(targetStep)})`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const targetStep = READING_LEVEL_TO_STEP[level]
      console.error('[UI_INTERACTION] Failed to set reading level', {
        step: 'setReadingLevel',
        level,
        targetStep,
        error: message,
        timestamp: new Date().toISOString(),
      })
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to set reading level "${level}": ${message}`,
        { status: 502, cause: error },
      )
    }
  }
```

- [ ] **Step 7: Refactor clickTranslationStyleOption**

Replace the entire method body:

```typescript
  private async clickTranslationStyleOption(page: PageLike, label: string): Promise<void> {
    try {
      await this.humanInteraction.clickByTextContent(page, KAGI_SELECTORS.STYLE_LABEL, label, 0)
      console.log(`🎨 Clicked translation style: "${label}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click translation style', {
        step: 'clickTranslationStyleOption',
        selector: KAGI_SELECTORS.STYLE_LABEL,
        label,
        error: message,
        timestamp: new Date().toISOString(),
      })
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click translation style "${label}": ${message}`,
        { status: 502, cause: error },
      )
    }
  }
```

- [ ] **Step 8: Refactor clickFormalityOption**

Replace the entire 99-line method with the simplified HIS version.

**NOTE:** `matchIndex: 0` works when the Kagi page has a single formality option group with the Vietnamese Casual anchor present. Verify from PoC runtime if the formality section has multiple distinct groups.

```typescript
  private async clickFormalityOption(page: PageLike, label: string): Promise<void> {
    try {
      // NOTE: matchIndex=0 — formality spans appear in a single option group.
      // Verify from PoC runtime if Kagi UI changes introduce multiple formality sections.
      await this.humanInteraction.clickByTextContent(
        page,
        KAGI_SELECTORS.FORMALITY_LABEL,
        label,
        0,
      )
      console.log(`💼 Clicked formality: "${label}"`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[UI_INTERACTION] Failed to click formality', {
        step: 'clickFormalityOption',
        selector: KAGI_SELECTORS.FORMALITY_LABEL,
        label,
        error: message,
        timestamp: new Date().toISOString(),
      })
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Failed to click formality "${label}": ${message}`,
        { status: 502, cause: error },
      )
    }
  }
```

- [ ] **Step 9: Remove context URL verify in executeTranslation Phase 2**

In `executeTranslation()`, the context fill block currently reads:

```typescript
if (request.context) {
  await this.fillTranslationContext(page, request.context)
  await this.options.sleep(computeScaledDelay(1_500, charCount))
  this.verifyUrlContains(page, 'context=', 'Target: context')
}
```

Remove `this.verifyUrlContains(page, 'context=', 'Target: context')`:

```typescript
if (request.context) {
  await this.fillTranslationContext(page, request.context)
  await this.options.sleep(computeScaledDelay(1_500, charCount))
  // NOTE: No URL verify — Kagi does not reflect context= in URL when entered via HIS typing.
}
```

- [ ] **Step 10: Run all tests**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass, no errors

- [ ] **Step 11: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts
git commit -m "refactor(kagi-sidecar): replace all machine interactions with HumanInteractionService"
```

---

### Task 10: runtime-config.ts timeout 30s → 120s + test update

**Files:**

- Modify: `packages/kagi-sidecar/src/runtime-config.ts:45-49`
- Modify: `packages/kagi-sidecar/src/runtime-config.test.ts:13`

- [ ] **Step 1: Write failing test**

In `packages/kagi-sidecar/src/runtime-config.test.ts`, change the assertion on line 13:

```typescript
expect(config.browser.requestTimeoutMs).toBe(30_000)
```

To:

```typescript
expect(config.browser.requestTimeoutMs).toBe(120_000)
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/runtime-config.test.ts
```

Expected: FAIL — `Expected: 120000, Received: 30000`

- [ ] **Step 3: Update runtime-config.ts default**

In `packages/kagi-sidecar/src/runtime-config.ts`, change line 49:

```typescript
        30_000,
```

To:

```typescript
        120_000,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/kagi-sidecar && bun test src/runtime-config.test.ts
```

Expected: All 3 tests pass

- [ ] **Step 5: Full test suite + typecheck**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/runtime-config.ts \
        packages/kagi-sidecar/src/runtime-config.test.ts
git commit -m "feat(kagi-sidecar): increase default requestTimeoutMs from 30s to 120s"
```

---

### Task 11: Additional browser-service tests for PR #3 coverage

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`

- [ ] **Step 1: Add HIS delegation tests**

Add these `it` blocks in `packages/kagi-sidecar/src/browser-service.test.ts`:

```typescript
it('delegates Translation Settings click to humanInteraction.click', async () => {
  const service = createService()
  await service.translate({ text: 'Hello', style: 'Clear' })
  expect(mockHumanInteraction.click).toHaveBeenCalledWith(
    mockPage,
    '[aria-label="Translation Settings"]',
  )
})

it('delegates context fill to humanInteraction.typeIntoTextarea', async () => {
  const service = createService()
  await service.translate({ text: 'Hello', style: 'WithContext', context: 'Test context' })
  expect(mockHumanInteraction.typeIntoTextarea).toHaveBeenCalledWith(
    mockPage,
    expect.stringContaining('placeholder'),
    'Test context',
  )
})

it('propagates KagiSidecarError when humanInteraction.click throws', async () => {
  mockHumanInteraction.click.mockRejectedValueOnce(new Error('ghost-cursor failed'))

  const service = createService()

  try {
    await service.translate({ text: 'Hello', style: 'Clear' })
    expect.unreachable('should have thrown')
  } catch (error) {
    expect(error).toMatchObject({ code: 'UI_INTERACTION' })
  }
})
```

**Note:** The `'WithContext'` style in the test assumes a preset with context. If no such preset exists, replace with a style that has `context` set, or pass `context` in the request directly (if the code supports `request.context` override). Looking at `KagiTranslateRequest`, it has `context?: string`, so use:

```typescript
await service.translate({ text: 'Hello', style: 'Clear', context: 'Test context' })
```

And update the assertion to check `KAGI_SELECTORS.CONTEXT_TEXTAREA`:

```typescript
it('delegates context fill to humanInteraction.typeIntoTextarea', async () => {
  const service = createService()
  await service.translate({ text: 'Hello', style: 'Clear', context: 'Test context' })
  expect(mockHumanInteraction.typeIntoTextarea).toHaveBeenCalledWith(
    mockPage,
    'textarea[placeholder*="Brief context for translation"]',
    'Test context',
  )
})
```

- [ ] **Step 2: Run all tests**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "test(kagi-sidecar): add HIS delegation coverage for PR #3"
```

---

### Task 12: E2E Acceptance Gate

**Definition of Done:** `bun packages/kagi-sidecar/src/index.ts` (local) AND `docker compose up kagi-translator` (Docker) both produce a translated result for a test request with no `UI_INTERACTION` errors in logs.

- [ ] **Step 1: Run local E2E test**

Terminal 1 — start the sidecar:

```bash
bun packages/kagi-sidecar/src/index.ts
```

Expected startup log: server listening on port 3002

Terminal 2 — send test request:

```bash
curl -s -X POST http://localhost:3002/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?", "style": "Clear"}' | jq .
```

Expected response (non-empty `translated` field):

```json
{
  "translated": "Xin chào, bạn có khỏe không?",
  "attempts": 1,
  "queueWaitMs": 0,
  "transportLatencyMs": 12345
}
```

Expected: NO `[UI_INTERACTION]` errors in Terminal 1 logs. May see `⚠️ Degraded to...` warnings if running headless without display — this is acceptable (graceful fallback working).

- [ ] **Step 2: Run Docker E2E test**

```bash
docker compose up kagi-translator
```

In another terminal:

```bash
curl -s -X POST http://localhost:3002/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Good morning, everyone.", "style": "BusinessFormal"}' | jq .
```

Expected: Non-empty `translated` field, no `UI_INTERACTION` errors, possible `⚠️ Degraded to...` warnings (Docker Xvfb environment — expected, not an error).

- [ ] **Step 3: Tag PR #3 as ready for review**

```bash
git log --oneline -10
```

Confirm all PR #3 commits are present (Tasks 5–11). Create a PR or tag as appropriate for your team's workflow.

---

## Self-Review Checklist

- [x] **Spec coverage**: Input clamping (Flow 1) → Tasks 1–2. Dynamic delay (Flow 5) → Tasks 3–4. Human interaction (Flows 2–4a) → Tasks 5–9. E2E gate (DEC-007) → Task 12.
- [x] **Type consistency**: `clampInputText` defined in Task 1, used in Tasks 2 and 8. `computeScaledDelay` defined in Task 3, used in Tasks 4, 8. `IHumanInteraction` defined in Task 5, implemented in Task 6, injected in Task 7. `HUMAN_INPUT_THRESHOLD` defined in Task 3, imported in Task 8. `evaluate` overloads: 1-arg (browser-service.ts call sites), 2-arg (HIS.dragSlider + typeIntoContentEditable fallbacks), 3-arg (HIS.clickByTextContent), spread fallback.
- [x] **No placeholders**: All steps have complete code or exact commands.
- [x] **DEC-007 E2E gate**: Explicit local + Docker tests in Task 12.
- [x] **DEC-008 no URL verify for source text**: `fillSourceTextInput` in Task 8 has no URL check.
- [x] **Context URL verify removal**: Removed in Task 9 step 9.
- [x] **ElementHandleLike re-export**: Task 7 step 1 uses `export type { ElementHandleLike }` to preserve test import compatibility.
- [x] **3-PR sequential dependency**: Task 2 depends on Task 1 (uses `clampInputText`). Task 4 depends on Task 3 (uses `computeScaledDelay`). PR #3 depends on PR #2 (uses both).
- [x] **provider-kagi unchanged**: No tasks touch `packages/provider-kagi/`.
- [x] **dashboard unchanged**: No tasks touch `packages/dashboard/`.
