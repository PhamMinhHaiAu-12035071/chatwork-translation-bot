# Kagi Translate Automation — Robustness & Human-like Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng automation pipeline lên production-grade bằng 3 phases độc lập: input clamping, dynamic delay scaling, và human-like interaction.

**Architecture:** 3 phases hoàn toàn độc lập — mỗi phase ship được riêng lẻ. Phase 1+2 chỉ thêm pure functions và config, không thay đổi browser interaction. Phase 3 thêm `HumanInteractionService` qua DI vào `KagiBrowserService`.

**Tech Stack:** Bun · TypeScript 5.4 strict · puppeteer-real-browser · puppeteer-core · ghost-cursor · puppeteer-humanize

---

## File Map

```
Phase 1 — Input Clamping
  Modify: nghien_cuu_cua_toi/src/config/translation.config.ts
  Modify: nghien_cuu_cua_toi/src/config/index.ts
  Modify: nghien_cuu_cua_toi/src/index.ts
  Modify: nghien_cuu_cua_toi/src/services/browser.service.ts  (fillSourceTextInput defensive)
  Modify: nghien_cuu_cua_toi/src/config/translation.config.test.ts

Phase 2 — Dynamic Delay
  Create: nghien_cuu_cua_toi/src/config/delay.config.ts
  Create: nghien_cuu_cua_toi/src/config/delay.config.test.ts
  Modify: nghien_cuu_cua_toi/src/config/index.ts
  Modify: nghien_cuu_cua_toi/src/services/browser.service.ts  (scale 3 delays + update waitForTranslationOutputStable sig)

Phase 3 — Human Interaction
  Create: nghien_cuu_cua_toi/src/services/interfaces/human-interaction.interface.ts
  Create: nghien_cuu_cua_toi/src/services/human-interaction.service.ts
  Create: nghien_cuu_cua_toi/src/services/human-interaction.service.test.ts
  Modify: nghien_cuu_cua_toi/src/services/browser.service.ts  (DI constructor, replace interactions, call waitForTranslationOutputStable)
  Modify: nghien_cuu_cua_toi/tests/e2e/translation-mocked.e2e.test.ts
```

---

## Phase 1 — Input Clamping

### Task 1: Add clampInputText to translation.config.ts

**Files:**

- Modify: `nghien_cuu_cua_toi/src/config/translation.config.test.ts`
- Modify: `nghien_cuu_cua_toi/src/config/translation.config.ts`
- Modify: `nghien_cuu_cua_toi/src/config/index.ts`

- [ ] **Step 1.1: Write failing tests**

Append to the bottom of `nghien_cuu_cua_toi/src/config/translation.config.test.ts`, inside the outer `describe('Translation Config', ...)` block, after the last `describe` block:

```typescript
describe('clampInputText', () => {
  it('should pass through text ≤ 20,000 chars unchanged', () => {
    const text = 'a'.repeat(20_000)
    expect(clampInputText(text)).toBe(text)
  })

  it('should pass through empty string', () => {
    expect(clampInputText('')).toBe('')
  })

  it('should truncate text > 20,000 chars to exactly 20,000', () => {
    const text = 'a'.repeat(20_001)
    const result = clampInputText(text)
    expect(result.length).toBe(20_000)
    expect(result).toBe('a'.repeat(20_000))
  })

  it('should truncate at exact boundary + 1', () => {
    const text = 'x'.repeat(25_000)
    const result = clampInputText(text)
    expect(result.length).toBe(20_000)
    expect(result).toBe('x'.repeat(20_000))
  })

  it('should preserve characters before the cut point', () => {
    const prefix = 'hello '
    const filler = 'x'.repeat(20_000 - prefix.length)
    const suffix = ' world'
    const text = prefix + filler + suffix
    const result = clampInputText(text)
    expect(result).toBe(prefix + filler)
  })

  it('MAX_INPUT_TEXT_LENGTH should equal 20000', () => {
    expect(MAX_INPUT_TEXT_LENGTH).toBe(20_000)
  })
})
```

Update the import at the top of `translation.config.test.ts` to include `clampInputText` and `MAX_INPUT_TEXT_LENGTH`:

```typescript
import {
  DEFAULT_TRANSLATION_CONFIG,
  BROWSER_CONFIG,
  KAGI_TRANSLATE_BASE_URL,
  KAGI_SELECTORS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  GENDER_PREFERENCE_UI_LABELS,
  getReadingLevelSliderValue,
  getDefaultTranslationOptions,
  MAX_TRANSLATION_CONTEXT_LENGTH,
  clampTranslationContext,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  MAX_INPUT_TEXT_LENGTH,
  clampInputText,
} from './translation.config'
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd nghien_cuu_cua_toi && bun test src/config/translation.config.test.ts
```

Expected: FAIL — `clampInputText is not a function` or similar import error.

- [ ] **Step 1.3: Implement MAX_INPUT_TEXT_LENGTH and clampInputText**

In `nghien_cuu_cua_toi/src/config/translation.config.ts`, add after the `clampTranslationContext` function (around line 63):

```typescript
/** Maximum character length accepted for source text input. Kagi API slows significantly above this. */
export const MAX_INPUT_TEXT_LENGTH = 20_000

/**
 * Truncates source text to {@link MAX_INPUT_TEXT_LENGTH} characters.
 * Primary call: index.ts (logs warning). Defensive call: fillSourceTextInput (silent).
 */
export function clampInputText(raw: string): string {
  if (raw.length <= MAX_INPUT_TEXT_LENGTH) return raw
  const charsRemoved = raw.length - MAX_INPUT_TEXT_LENGTH
  console.warn(
    `[clampInputText] Input truncated: ${raw.length} → ${MAX_INPUT_TEXT_LENGTH} chars (${charsRemoved} chars removed)`,
  )
  return raw.slice(0, MAX_INPUT_TEXT_LENGTH)
}
```

- [ ] **Step 1.4: Re-export from config/index.ts**

In `nghien_cuu_cua_toi/src/config/index.ts`, add `MAX_INPUT_TEXT_LENGTH` and `clampInputText` to the export list:

```typescript
export {
  DEFAULT_TRANSLATION_CONFIG,
  BROWSER_CONFIG,
  KAGI_TRANSLATE_BASE_URL,
  KAGI_SELECTORS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  GENDER_PREFERENCE_UI_LABELS,
  MAX_TRANSLATION_CONTEXT_LENGTH,
  MAX_INPUT_TEXT_LENGTH,
  clampTranslationContext,
  clampInputText,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  getReadingLevelSliderValue,
  getDefaultTranslationOptions,
} from './translation.config'
```

- [ ] **Step 1.5: Run tests to verify they pass**

```bash
cd nghien_cuu_cua_toi && bun test src/config/translation.config.test.ts
```

Expected: All tests PASS, including new `clampInputText` describe block.

- [ ] **Step 1.6: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/config/translation.config.ts src/config/index.ts src/config/translation.config.test.ts
git commit -m "feat(config): add MAX_INPUT_TEXT_LENGTH and clampInputText"
```

---

### Task 2: Wire clampInputText into the pipeline

**Files:**

- Modify: `nghien_cuu_cua_toi/src/index.ts`
- Modify: `nghien_cuu_cua_toi/src/services/browser.service.ts`

- [ ] **Step 2.1: Update index.ts — primary guard**

In `nghien_cuu_cua_toi/src/index.ts`, update the import block:

```typescript
import {
  BROWSER_CONFIG,
  DEFAULT_TRANSLATION_CONFIG,
  INDEX_ENTRY_SAMPLE_TRANSLATION_CONTEXT,
  clampTranslationContext,
  clampInputText,
  getDefaultTranslationOptions,
} from '~/config/translation.config'
```

Then find the line:

```typescript
const inputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
```

Replace with:

```typescript
const rawInputText = DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT
const inputText = clampInputText(rawInputText)
```

- [ ] **Step 2.2: Add defensive clamp in fillSourceTextInput**

In `nghien_cuu_cua_toi/src/services/browser.service.ts`, update the import at the top to include `clampInputText`:

```typescript
import {
  BROWSER_CONFIG,
  KAGI_SELECTORS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  getDefaultTranslationOptions,
  getReadingLevelSliderValue,
  clampTranslationContext,
  clampInputText,
} from '~/config'
```

In `fillSourceTextInput(page: Page, rawText: string)`, replace the first two lines of the try block body:

```typescript
// BEFORE (around line 782-786):
try {
  console.log(`Setting source text (${rawText.length} chars)...`)
  await page.waitForSelector(selector, { timeout, visible: true })

// AFTER:
try {
  // Defensive clamp — primary guard is in index.ts; this is a silent safety net
  const text = rawText.length <= 20_000 ? rawText : rawText.slice(0, 20_000)
  console.log(`Setting source text (${text.length} chars)...`)
  await page.waitForSelector(selector, { timeout, visible: true })
```

Also update all subsequent references to `rawText` inside that try block to use `text`:

Replace the evaluate call's `rawText` argument with `text`:

```typescript
await page.evaluate(
  (sel: string, value: string) => {
    // ... (unchanged)
  },
  selector,
  text, // was: rawText
)
```

- [ ] **Step 2.3: Run full test suite**

```bash
cd nghien_cuu_cua_toi && bun test && bun run typecheck && bun run lint
```

Expected: All tests PASS, no type errors, no lint errors.

- [ ] **Step 2.4: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/index.ts src/services/browser.service.ts
git commit -m "feat(pipeline): wire clampInputText as primary guard in index.ts and defensive guard in fillSourceTextInput"
```

---

## Phase 2 — Dynamic Delay

### Task 3: Create delay.config.ts with pure functions

**Files:**

- Create: `nghien_cuu_cua_toi/src/config/delay.config.test.ts`
- Create: `nghien_cuu_cua_toi/src/config/delay.config.ts`
- Modify: `nghien_cuu_cua_toi/src/config/index.ts`

- [ ] **Step 3.1: Write failing tests**

Create `nghien_cuu_cua_toi/src/config/delay.config.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import {
  DELAY_TIERS,
  HUMAN_INPUT_THRESHOLD,
  computeDelayMultiplier,
  computeScaledDelay,
} from './delay.config'

describe('delay.config', () => {
  describe('DELAY_TIERS', () => {
    it('should have 4 tiers in ascending maxChars order', () => {
      expect(DELAY_TIERS).toHaveLength(4)
      expect(DELAY_TIERS[0].maxChars).toBe(2_000)
      expect(DELAY_TIERS[1].maxChars).toBe(8_000)
      expect(DELAY_TIERS[2].maxChars).toBe(15_000)
      expect(DELAY_TIERS[3].maxChars).toBe(20_000)
    })

    it('should have correct multipliers', () => {
      expect(DELAY_TIERS[0].multiplier).toBe(1.0)
      expect(DELAY_TIERS[1].multiplier).toBe(1.5)
      expect(DELAY_TIERS[2].multiplier).toBe(2.5)
      expect(DELAY_TIERS[3].multiplier).toBe(4.0)
    })
  })

  describe('HUMAN_INPUT_THRESHOLD', () => {
    it('should be 500', () => {
      expect(HUMAN_INPUT_THRESHOLD).toBe(500)
    })
  })

  describe('computeDelayMultiplier', () => {
    it('should return 1.0 for 0 chars', () => {
      expect(computeDelayMultiplier(0)).toBe(1.0)
    })

    it('should return 1.0 for 2000 chars (tier 1 boundary)', () => {
      expect(computeDelayMultiplier(2_000)).toBe(1.0)
    })

    it('should return 1.5 for 2001 chars (tier 2 start)', () => {
      expect(computeDelayMultiplier(2_001)).toBe(1.5)
    })

    it('should return 1.5 for 8000 chars (tier 2 boundary)', () => {
      expect(computeDelayMultiplier(8_000)).toBe(1.5)
    })

    it('should return 2.5 for 8001 chars (tier 3 start)', () => {
      expect(computeDelayMultiplier(8_001)).toBe(2.5)
    })

    it('should return 2.5 for 15000 chars (tier 3 boundary)', () => {
      expect(computeDelayMultiplier(15_000)).toBe(2.5)
    })

    it('should return 4.0 for 15001 chars (tier 4 start)', () => {
      expect(computeDelayMultiplier(15_001)).toBe(4.0)
    })

    it('should return 4.0 for 20000 chars (tier 4 boundary)', () => {
      expect(computeDelayMultiplier(20_000)).toBe(4.0)
    })

    it('should return 4.0 for > 20000 chars (cap at max tier)', () => {
      expect(computeDelayMultiplier(25_000)).toBe(4.0)
    })
  })

  describe('computeScaledDelay', () => {
    it('should return value within ±10% of base×1.0 for charCount=1000', () => {
      const base = 1500
      // Run 50 times to cover jitter range
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 1_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 1.0 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 1.0 * 1.1))
      }
    })

    it('should return value within ±10% of base×1.5 for charCount=5000', () => {
      const base = 2000
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 5_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 1.5 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 1.5 * 1.1))
      }
    })

    it('should return value within ±10% of base×2.5 for charCount=10000', () => {
      const base = 1500
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 10_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 2.5 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 2.5 * 1.1))
      }
    })

    it('should return value within ±10% of base×4.0 for charCount=18000', () => {
      const base = 2000
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 18_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 4.0 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 4.0 * 1.1))
      }
    })

    it('should return a positive integer', () => {
      const result = computeScaledDelay(1000, 500)
      expect(result).toBeGreaterThan(0)
      expect(Number.isInteger(result)).toBe(true)
    })
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd nghien_cuu_cua_toi && bun test src/config/delay.config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement delay.config.ts**

Create `nghien_cuu_cua_toi/src/config/delay.config.ts`:

```typescript
/**
 * Delay tier configuration and scaling utilities
 *
 * Pure functions — stateless, side-effect free.
 * Used by KagiBrowserService to scale wait times based on source text length.
 */

interface DelayTier {
  readonly maxChars: number
  readonly multiplier: number
}

/**
 * Tier thresholds: the longer the source text, the more time Kagi needs to re-translate
 * after each settings change. Multipliers are applied to base delay values from BROWSER_CONFIG.
 */
export const DELAY_TIERS = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const satisfies readonly DelayTier[]

/**
 * Source text length threshold (chars) that determines entry method:
 * ≤ threshold → typeIntoContentEditable (full keystroke)
 * > threshold → chunkPaste (Clipboard API chunks)
 */
export const HUMAN_INPUT_THRESHOLD = 500

/**
 * Returns the delay multiplier for the given character count.
 * Uses first-match scan through DELAY_TIERS (ascending maxChars).
 * Caps at max tier multiplier (4.0) for charCount > 20,000.
 */
export function computeDelayMultiplier(charCount: number): number {
  for (const tier of DELAY_TIERS) {
    if (charCount <= tier.maxChars) return tier.multiplier
  }
  return DELAY_TIERS[DELAY_TIERS.length - 1].multiplier
}

/**
 * Returns a scaled delay in milliseconds.
 * Formula: baseMs × multiplier(charCount) × jitter(±10%), rounded to integer.
 */
export function computeScaledDelay(baseMs: number, charCount: number): number {
  const multiplier = computeDelayMultiplier(charCount)
  const jitter = 0.9 + Math.random() * 0.2 // [0.9, 1.1]
  return Math.round(baseMs * multiplier * jitter)
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
cd nghien_cuu_cua_toi && bun test src/config/delay.config.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3.5: Add exports to config/index.ts**

Append to `nghien_cuu_cua_toi/src/config/index.ts`:

```typescript
export {
  DELAY_TIERS,
  HUMAN_INPUT_THRESHOLD,
  computeDelayMultiplier,
  computeScaledDelay,
} from './delay.config'
```

- [ ] **Step 3.6: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/config/delay.config.ts src/config/delay.config.test.ts src/config/index.ts
git commit -m "feat(config): add delay tier config with computeDelayMultiplier and computeScaledDelay"
```

---

### Task 4: Wire scaled delays into KagiBrowserService

**Files:**

- Modify: `nghien_cuu_cua_toi/src/services/browser.service.ts`

- [ ] **Step 4.1: Import computeScaledDelay in browser.service.ts**

Update the import from `~/config` at the top of `browser.service.ts`:

```typescript
import {
  BROWSER_CONFIG,
  KAGI_SELECTORS,
  SPEAKER_GENDER_UI_LABELS,
  ADDRESSEE_GENDER_UI_LABELS,
  TRANSLATION_STYLE_UI_LABELS,
  FORMALITY_UI_LABELS,
  getDefaultTranslationOptions,
  getReadingLevelSliderValue,
  clampTranslationContext,
  clampInputText,
  computeScaledDelay,
} from '~/config'
```

- [ ] **Step 4.2: Capture inputCharCount at start of translate()**

In the `translate()` method, after the opening line `const page: Page = this.connection.getPage()`, add:

```typescript
const inputCharCount = sourceText?.length ?? 0
```

- [ ] **Step 4.3: Scale delay after context fill**

Find in `translate()`:

```typescript
await this.delayMs(BROWSER_CONFIG.CONTEXT_URL_SETTLE_MS)
```

Replace with:

```typescript
await this.delayMs(computeScaledDelay(BROWSER_CONFIG.CONTEXT_URL_SETTLE_MS, inputCharCount))
```

- [ ] **Step 4.4: Scale delay before reading level**

Find in `translate()`:

```typescript
// ── BƯỚC 9: Set reading level theo options.readingLevel ──
const readingLevel = options.readingLevel
await this.delayMs(2_000)
```

Replace with:

```typescript
// ── BƯỚC 9: Set reading level theo options.readingLevel ──
const readingLevel = options.readingLevel
await this.delayMs(computeScaledDelay(2_000, inputCharCount))
```

- [ ] **Step 4.5: Scale delay after formality**

Find in `translate()`:

```typescript
await this.verifyFormalityInAddressBar(
  page,
  formalityUrlFragment.value,
  formalityUrlFragment.context,
)
await this.delayMs(2_000)
```

Replace with:

```typescript
await this.verifyFormalityInAddressBar(
  page,
  formalityUrlFragment.value,
  formalityUrlFragment.context,
)
await this.delayMs(computeScaledDelay(2_000, inputCharCount))
```

- [ ] **Step 4.6: Update waitForTranslationOutputStable signature to accept charCount**

Find the private method signature:

```typescript
  private async waitForTranslationOutputStable(page: Page): Promise<void> {
    const selector: string = KAGI_SELECTORS.TRANSLATION_CONTENT
    const stableMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS
    const maxMs: number = BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS
```

Replace with:

```typescript
  private async waitForTranslationOutputStable(page: Page, charCount = 0): Promise<void> {
    const selector: string = KAGI_SELECTORS.TRANSLATION_CONTENT
    const stableMs: number = computeScaledDelay(BROWSER_CONFIG.TRANSLATION_OUTPUT_STABLE_MS, charCount)
    const maxMs: number = computeScaledDelay(BROWSER_CONFIG.TRANSLATION_OUTPUT_MAX_WAIT_MS, charCount)
```

- [ ] **Step 4.7: Run full test suite**

```bash
cd nghien_cuu_cua_toi && bun test && bun run typecheck && bun run lint
```

Expected: All tests PASS, no type errors, no lint errors.

- [ ] **Step 4.8: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/services/browser.service.ts
git commit -m "feat(browser): scale delays by input text length using computeScaledDelay"
```

---

## Phase 3 — Human Interaction

### Task 5: Research ghost-cursor package compatibility

**Files:** none — research only

- [ ] **Step 5.1: Check ghost-cursor npm for puppeteer-core support**

```bash
cd nghien_cuu_cua_toi && bunx npm info ghost-cursor
```

Check if the package has `peerDependencies` for `puppeteer-core` or if types accept `puppeteer-core`'s `Page`. Also check:

```bash
bunx npm info ghost-cursor-playwright
```

- [ ] **Step 5.2: Decision**

**If** ghost-cursor v4+ accepts `puppeteer-core` Page (same shape at runtime): install it directly.

**If not** (likely): proceed with `page as any` approach — runtime compatible since puppeteer and puppeteer-core share the same Page shape.

```bash
cd nghien_cuu_cua_toi && bun add ghost-cursor @forad/puppeteer-humanize
```

- [ ] **Step 5.3: Verify install**

```bash
cd nghien_cuu_cua_toi && bun run typecheck
```

Expected: Type errors may appear for ghost-cursor import. These will be addressed in Task 6.

- [ ] **Step 5.4: Commit**

```bash
cd nghien_cuu_cua_toi && git add package.json bun.lock
git commit -m "chore(deps): add ghost-cursor and puppeteer-humanize for human-like interaction"
```

---

### Task 6: Create IHumanInteraction interface

**Files:**

- Create: `nghien_cuu_cua_toi/src/services/interfaces/human-interaction.interface.ts`

- [ ] **Step 6.1: Create the interface file**

Create `nghien_cuu_cua_toi/src/services/interfaces/human-interaction.interface.ts`:

```typescript
import type { Page } from 'puppeteer-core'

/**
 * Human-like interaction abstraction (Dependency Inversion Principle).
 *
 * KagiBrowserService depends on this interface, not on ghost-cursor or puppeteer-humanize directly.
 * All methods must degrade gracefully in Docker (bounding rect may be 0).
 */
export interface IHumanInteraction {
  /**
   * Ghost-cursor Bezier move to element → click at random point within element.
   * Fallback: page.click(selector) if bounding rect invalid or ghost-cursor throws.
   */
  click(page: Page, selector: string): Promise<void>

  /**
   * Find span element by text content + matchIndex → ghost-cursor move to rect center ± jitter → click parent button.
   * Fallback: page.evaluate(() => btn.click()) if bounding rect invalid or ghost-cursor throws.
   */
  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /**
   * puppeteer-humanize typeInto() for standard <textarea> elements.
   * Fallback: page.type() with fixed delay if puppeteer-humanize throws.
   */
  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  /**
   * page.type() with variable keystroke delay (50–150ms) + pause after punctuation.
   * For CodeMirror contenteditable — puppeteer-humanize is NOT compatible.
   * Fallback: page.evaluate(() => execCommand('insertText', ...)).
   */
  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  /**
   * Ghost-cursor drag from slider's fromStep pixel position to toStep pixel position.
   * Fallback: page.evaluate(() => { slider.value = toStep; slider.dispatchEvent(new Event('input', {bubbles: true})) })
   * if bounding rect.width === 0 (Docker scenario).
   */
  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  /**
   * Divide text into random chunks (500–2000 chars), paste each via Clipboard API + Ctrl/Cmd+V.
   * Type last 3–5 chars via typeIntoContentEditable for natural finish.
   * Used for sourceText > HUMAN_INPUT_THRESHOLD chars.
   */
  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
```

- [ ] **Step 6.2: Run typecheck**

```bash
cd nghien_cuu_cua_toi && bun run typecheck
```

Expected: No new type errors from this file.

- [ ] **Step 6.3: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/services/interfaces/human-interaction.interface.ts
git commit -m "feat(interface): add IHumanInteraction for DIP-based human-like browser interaction"
```

---

### Task 7: Implement HumanInteractionService

**Files:**

- Create: `nghien_cuu_cua_toi/src/services/human-interaction.service.test.ts`
- Create: `nghien_cuu_cua_toi/src/services/human-interaction.service.ts`

- [ ] **Step 7.1: Write failing tests**

Create `nghien_cuu_cua_toi/src/services/human-interaction.service.test.ts`:

```typescript
import { describe, it, expect, mock } from 'bun:test'
import { HumanInteractionService } from './human-interaction.service'

// Minimal mock page — only methods used by HumanInteractionService
function createMockPage(overrides: Record<string, unknown> = {}) {
  return {
    click: mock(async (_selector: string) => {}),
    type: mock(async (_selector: string, _text: string, _opts?: unknown) => {}),
    evaluate: mock(async (_fn: unknown, ..._args: unknown[]) => undefined as unknown),
    waitForSelector: mock(async (_selector: string, _opts?: unknown) => null),
    $: mock(async (_selector: string) => null),
    keyboard: {
      down: mock(async (_key: string) => {}),
      press: mock(async (_key: string) => {}),
      up: mock(async (_key: string) => {}),
    },
    mouse: {
      move: mock(async (_x: number, _y: number) => {}),
      down: mock(async () => {}),
      up: mock(async () => {}),
    },
    ...overrides,
  }
}

describe('HumanInteractionService', () => {
  describe('click()', () => {
    it('should fallback to page.click() when bounding rect width is 0 (Docker)', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage({
        // Simulate Docker: getBoundingClientRect returns width=0
        evaluate: mock(async () => ({ width: 0, height: 0, top: 0, left: 0 })),
      })

      await service.click(page as never, 'button[aria-label="Translation Settings"]')

      expect(page.click).toHaveBeenCalledWith('button[aria-label="Translation Settings"]')
    })

    it('should fallback to page.click() when evaluate throws (ghost-cursor error)', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage({
        evaluate: mock(async () => {
          throw new Error('evaluate failed')
        }),
      })

      // Should not throw — fallback must handle the error
      await expect(service.click(page as never, '.some-button')).resolves.toBeUndefined()
      expect(page.click).toHaveBeenCalledWith('.some-button')
    })
  })

  describe('typeIntoContentEditable()', () => {
    it('should call page.type() with delay option', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()

      await service.typeIntoContentEditable(
        page as never,
        '[aria-label="Source text input"]',
        'hello',
      )

      expect(page.type).toHaveBeenCalledWith(
        '[aria-label="Source text input"]',
        'hello',
        expect.objectContaining({ delay: expect.any(Number) }),
      )
    })
  })

  describe('chunkPaste()', () => {
    it('should call Clipboard API via evaluate and keyboard shortcuts', async () => {
      const service = new HumanInteractionService()
      const evaluateCalls: unknown[] = []
      const page = createMockPage({
        evaluate: mock(async (fn: unknown, ...args: unknown[]) => {
          evaluateCalls.push({ fn: fn?.toString().slice(0, 50), args })
          return undefined
        }),
        type: mock(async () => {}),
      })

      await service.chunkPaste(page as never, '[aria-label="Source text input"]', 'Hello World')

      // Should have called keyboard shortcuts for paste
      expect(page.keyboard.down).toHaveBeenCalled()
      expect(page.keyboard.press).toHaveBeenCalledWith('v')
      expect(page.keyboard.up).toHaveBeenCalled()
    })

    it('should type last 3-5 chars via typeIntoContentEditable for small text', async () => {
      const service = new HumanInteractionService()
      const page = createMockPage()

      await service.chunkPaste(page as never, '[aria-label="Source text input"]', 'Hi')

      // For very short text, should use type directly
      expect(page.type).toHaveBeenCalled()
    })
  })

  describe('dragSlider()', () => {
    it('should fallback to evaluate set value when slider rect width is 0 (Docker)', async () => {
      const service = new HumanInteractionService()
      let evaluateCallCount = 0
      const page = createMockPage({
        evaluate: mock(async () => {
          evaluateCallCount++
          // First call: getBoundingClientRect → width=0 (Docker)
          if (evaluateCallCount === 1) {
            return { width: 0, height: 0, left: 0, top: 0 }
          }
          // Second call: set slider value
          return true
        }),
      })

      await service.dragSlider(page as never, 'input[type="range"]', 0, 3)

      // Should have called evaluate twice: once for rect, once to set value
      expect(evaluateCallCount).toBe(2)
    })
  })
})
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
cd nghien_cuu_cua_toi && bun test src/services/human-interaction.service.test.ts
```

Expected: FAIL — `HumanInteractionService` not found.

- [ ] **Step 7.3: Implement HumanInteractionService**

Create `nghien_cuu_cua_toi/src/services/human-interaction.service.ts`:

```typescript
/**
 * Human-like interaction implementation using ghost-cursor and puppeteer-humanize.
 *
 * All methods degrade gracefully when ghost-cursor fails (e.g., Docker/Xvfb with
 * bounding rect width=0). Fallback path uses standard Puppeteer APIs and logs a warning.
 */

import type { Page } from 'puppeteer-core'
import type { IHumanInteraction } from './interfaces/human-interaction.interface'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCursor } = require('ghost-cursor') as {
  createCursor: (page: unknown) => {
    move: (sel: string) => Promise<void>
    click: (sel: string) => Promise<void>
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { typeInto } = require('puppeteer-humanize') as {
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

/** Detects modifier key for paste shortcut */
const PASTE_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

export class HumanInteractionService implements IHumanInteraction {
  async click(page: Page, selector: string): Promise<void> {
    try {
      const rect = await (page as unknown as { evaluate: Function }).evaluate((sel: string) => {
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
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void> {
    try {
      const rect = await (page as unknown as { evaluate: Function }).evaluate(
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
        // Fallback: evaluate click
        await (page as unknown as { evaluate: Function }).evaluate(
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

      // Ghost-cursor: move to center of button ± jitter, then click
      const centerX = rect.left + rect.width / 2 + randInt(-3, 3)
      const centerY = rect.top + rect.height / 2 + randInt(-3, 3)
      await page.mouse.move(centerX, centerY)
      await page.mouse.down()
      await sleep(randInt(40, 120))
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate click: "${text}"`)
      await (page as unknown as { evaluate: Function }).evaluate(
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

  async typeIntoTextarea(page: Page, selector: string, text: string): Promise<void> {
    try {
      const handle = await page.$(selector)
      if (!handle) throw new Error(`Element not found: ${selector}`)
      await typeInto(handle, text, { mistakes: { chance: 3, delay: { min: 50, max: 150 } } })
    } catch {
      console.warn(`⚠️ Degraded to page.type() for textarea: ${selector}`)
      await page.type(selector, text, { delay: 80 })
    }
  }

  async typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void> {
    try {
      // Variable delay per keystroke (50-150ms) + extra pause after punctuation
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
      await (page as unknown as { evaluate: Function }).evaluate(
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
    page: Page,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void> {
    try {
      const rect = await (page as unknown as { evaluate: Function }).evaluate((sel: string) => {
        const slider = document.querySelector<HTMLInputElement>(sel)
        if (!slider) return { width: 0, height: 0, left: 0, top: 0 }
        const r = slider.getBoundingClientRect()
        return { width: r.width, height: r.height, left: r.left, top: r.top }
      }, sliderSelector)

      if (!isValidRect(rect) || rect.width === 0) {
        // Fallback: evaluate set value + dispatch events (proven Docker-safe method)
        await (page as unknown as { evaluate: Function }).evaluate(
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
        console.warn(`⚠️ Degraded to evaluate set value for slider: step ${toStep}`)
        return
      }

      const maxSteps = 6 // slider 0–6
      const fromX = rect.left + (fromStep / maxSteps) * rect.width
      const toX = rect.left + (toStep / maxSteps) * rect.width
      const y = rect.top + rect.height / 2

      await page.mouse.move(fromX, y)
      await page.mouse.down()
      await sleep(randInt(50, 150))
      // Bezier-like: move in small steps toward target
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const x = fromX + ((toX - fromX) * i) / steps
        await page.mouse.move(x, y + randInt(-2, 2))
        await sleep(randInt(10, 30))
      }
      await page.mouse.up()
    } catch {
      console.warn(`⚠️ Degraded to evaluate set value for slider: step ${toStep}`)
      await (page as unknown as { evaluate: Function }).evaluate(
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

  async chunkPaste(page: Page, selector: string, text: string): Promise<void> {
    // For very short text, just type it directly
    if (text.length <= 10) {
      await this.typeIntoContentEditable(page, selector, text)
      return
    }

    const CHUNK_MIN = 500
    const CHUNK_MAX = 2_000
    const TAIL_CHARS = randInt(3, 5)

    // Split off tail chars for natural keystroke finish
    const body = text.slice(0, text.length - TAIL_CHARS)
    const tail = text.slice(text.length - TAIL_CHARS)

    // Paste body in chunks
    let offset = 0
    while (offset < body.length) {
      const chunkSize = Math.min(randInt(CHUNK_MIN, CHUNK_MAX), body.length - offset)
      const chunk = body.slice(offset, offset + chunkSize)
      offset += chunkSize

      // Write chunk to clipboard via page context
      await (page as unknown as { evaluate: Function }).evaluate((text: string) => {
        return navigator.clipboard.writeText(text)
      }, chunk)

      // Paste via keyboard shortcut
      await page.keyboard.down(PASTE_MODIFIER)
      await page.keyboard.press('v')
      await page.keyboard.up(PASTE_MODIFIER)

      // Random delay between chunks (200–800ms)
      await sleep(randInt(200, 800))
    }

    // Type tail chars via real keystrokes for natural finish
    await this.typeIntoContentEditable(page, selector, tail)
  }
}
```

- [ ] **Step 7.4: Run tests**

```bash
cd nghien_cuu_cua_toi && bun test src/services/human-interaction.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7.5: Run typecheck + lint**

```bash
cd nghien_cuu_cua_toi && bun run typecheck && bun run lint
```

Fix any type errors. For ghost-cursor/puppeteer-humanize type imports, add `// eslint-disable-next-line` directives with justification comments if needed.

- [ ] **Step 7.6: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/services/human-interaction.service.ts src/services/human-interaction.service.test.ts
git commit -m "feat(service): implement HumanInteractionService with ghost-cursor and puppeteer-humanize"
```

---

### Task 8: Refactor KagiBrowserService to use IHumanInteraction via DI

**Files:**

- Modify: `nghien_cuu_cua_toi/src/services/browser.service.ts`

- [ ] **Step 8.1: Import IHumanInteraction and HumanInteractionService**

Add to the imports at the top of `browser.service.ts`:

```typescript
import type { IHumanInteraction } from './interfaces/human-interaction.interface'
import { HumanInteractionService } from './human-interaction.service'
import { HUMAN_INPUT_THRESHOLD } from '~/config'
```

- [ ] **Step 8.2: Add DI constructor to KagiBrowserService**

Replace the class opening:

```typescript
export class KagiBrowserService implements IBrowserService {
  private connection: BrowserConnection | null = null
```

With:

```typescript
export class KagiBrowserService implements IBrowserService {
  private connection: BrowserConnection | null = null

  constructor(
    private readonly humanInteraction: IHumanInteraction = new HumanInteractionService(),
  ) {}
```

- [ ] **Step 8.3: Replace fillSourceTextInput interactions**

In `translate()`, the source text entry block (BƯỚC 3) currently:

```typescript
if (sourceText !== undefined) {
  await this.clearSourceTextInput(page)
  await this.fillSourceTextInput(page, sourceText)
}
```

Replace with:

```typescript
if (sourceText !== undefined) {
  await this.clearSourceTextInput(page)
  await this.fillSourceTextInput(page, sourceText, inputCharCount)
}
```

Update `fillSourceTextInput` signature to receive charCount:

```typescript
private async fillSourceTextInput(page: Page, rawText: string, charCount = 0): Promise<void> {
```

Inside the try block of `fillSourceTextInput`, after the defensive clamp, replace the `page.click` + `page.focus` + `page.evaluate` block with:

```typescript
const text = rawText.length <= 20_000 ? rawText : rawText.slice(0, 20_000)
console.log(`Setting source text (${text.length} chars)...`)
await page.waitForSelector(selector, { timeout, visible: true })

if (charCount <= HUMAN_INPUT_THRESHOLD) {
  await this.humanInteraction.typeIntoContentEditable(page, selector, text)
} else {
  await this.humanInteraction.chunkPaste(page, selector, text)
}
```

- [ ] **Step 8.4: Replace clickTranslationSettingsButton**

In `clickTranslationSettingsButton()`, replace the `handle.click()` approach:

```typescript
// FIND:
const handle = await page.waitForSelector(selector, {
  timeout: clickTimeout,
  visible: true,
})
if (handle != null) {
  await handle.click()
}

// REPLACE WITH:
await page.waitForSelector(selector, { timeout: clickTimeout, visible: true })
await this.humanInteraction.click(page, selector)
```

- [ ] **Step 8.5: Replace fillTranslationContext**

In `fillTranslationContext()`, replace the `page.evaluate(set value)` block (keeping the `waitForFunction` scroll-into-view):

```typescript
// KEEP the waitForFunction block as-is, then replace:
await this.delayMs(BROWSER_CONFIG.STYLE_OPTION_CLICK_GAP_MS)

// REMOVE the page.evaluate() block and REPLACE WITH:
await this.humanInteraction.typeIntoTextarea(page, primarySel, text)
```

- [ ] **Step 8.6: Replace clickSettingsOptionBySpanLabel final click**

In `clickSettingsOptionBySpanLabel()`, replace the entire method body with a version that keeps the `waitForFunction` for element readiness, then delegates click to `humanInteraction.clickByTextContent()`:

```typescript
  private async clickSettingsOptionBySpanLabel(
    page: Page,
    spanSelector: string,
    label: string,
    logKind: string,
    matchIndex = 0,
  ): Promise<void> {
    const timeout: number = BROWSER_CONFIG.WAIT_FOR_SELECTOR_TIMEOUT

    try {
      console.log(`⚙️  Clicking ${logKind} "${label}"…`)
      await page.waitForFunction(
        (sel: string, text: string, index: number) => {
          const spans = Array.from(document.querySelectorAll<HTMLElement>(sel))
          const matches = spans.filter((el) => el.textContent?.trim() === text)
          const el = matches[index]
          if (el === undefined) return false
          const btn = el.closest('button')
          const rect = el.getBoundingClientRect()
          return btn !== null && rect.width > 0 && rect.height > 0
        },
        { timeout },
        spanSelector,
        label,
        matchIndex,
      )

      await this.humanInteraction.clickByTextContent(page, spanSelector, label, matchIndex)
    } catch (error) {
      console.warn(
        `⚠️  Could not click ${logKind} "${label}":`,
        error instanceof Error ? error.message : error,
      )
    }
  }
```

- [ ] **Step 8.7: Replace setReadingLevel interaction**

In `setReadingLevel()`, replace the `page.evaluate(set value)` block and subsequent `page.waitForFunction` with `humanInteraction.dragSlider()`:

```typescript
// KEEP the first waitForFunction (waiting for slider visibility), then REPLACE:
const targetValue: number = getReadingLevelSliderValue(readingLevel)
// ...
// REMOVE: const applied: boolean = await page.evaluate(...)
// REMOVE: await page.waitForFunction(aria-valuenow check)
// ADD:
const currentValue = 0 // conservative: assume slider starts at 0
await this.humanInteraction.dragSlider(page, selector, currentValue, targetValue)

await page.waitForFunction(
  (sel: string, nextValue: number, searchFragment: string) => {
    const slider = document.querySelector<HTMLInputElement>(sel)
    if (!slider) return false
    const ariaNow = slider.getAttribute('aria-valuenow')
    if (ariaNow !== String(nextValue)) return false
    if (searchFragment === '') return !location.search.includes('language_complexity')
    return location.search.includes(searchFragment)
  },
  { timeout },
  selector,
  targetValue,
  expectedSearchFragment,
)
```

- [ ] **Step 8.8: Replace clickFormalityOption final click**

In `clickFormalityOption()`, find the final `btn.click()` evaluate call. Replace it with `humanInteraction.clickByTextContent()`:

```typescript
// KEEP the waitForFunction (complex root-finding logic) as-is, then REPLACE the second page.evaluate:
// REMOVE: const clicked = await page.evaluate(find + btn.click)
// REMOVE: if (!clicked) throw new Error(...)
// ADD:
await this.humanInteraction.clickByTextContent(page, spanSelector, label, 0)
```

- [ ] **Step 8.9: Add waitForTranslationOutputStable call in translate()**

In `translate()`, find:

```typescript
const finalUrl: string = page.url()
const translated = await this.scrapeTranslatedText(page)
```

Replace with:

```typescript
await this.waitForTranslationOutputStable(page, inputCharCount)
const finalUrl: string = page.url()
const translated = await this.scrapeTranslatedText(page)
```

- [ ] **Step 8.10: Run typecheck**

```bash
cd nghien_cuu_cua_toi && bun run typecheck
```

Fix any type errors before proceeding.

- [ ] **Step 8.11: Commit**

```bash
cd nghien_cuu_cua_toi && git add src/services/browser.service.ts
git commit -m "feat(browser): refactor KagiBrowserService to use IHumanInteraction via DI"
```

---

### Task 9: Update e2e tests and final verification

**Files:**

- Modify: `nghien_cuu_cua_toi/tests/e2e/translation-mocked.e2e.test.ts`

- [ ] **Step 9.1: Add MockHumanInteraction and update KagiBrowserService instantiation**

At the top of `translation-mocked.e2e.test.ts`, add after the existing imports:

```typescript
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'
import type { Page } from 'puppeteer-core'

// Mock IHumanInteraction — delegates directly to page standard APIs for test isolation
const mockHumanInteraction: IHumanInteraction = {
  click: mock(async (_page: Page, selector: string) => {
    await mockPage.click(selector)
  }),
  clickByTextContent: mock(
    async (_page: Page, _spanSel: string, _text: string, _idx: number) => {},
  ),
  typeIntoTextarea: mock(async (_page: Page, _selector: string, _text: string) => {}),
  typeIntoContentEditable: mock(async (_page: Page, _selector: string, _text: string) => {}),
  dragSlider: mock(async (_page: Page, _selector: string, _from: number, _to: number) => {}),
  chunkPaste: mock(async (_page: Page, _selector: string, _text: string) => {}),
}
```

- [ ] **Step 9.2: Update browserService instantiation in beforeEach**

Replace:

```typescript
browserService = new KagiBrowserService()
```

With:

```typescript
browserService = new KagiBrowserService(mockHumanInteraction)
```

Also reset mock interaction in beforeEach:

```typescript
// Reset human interaction mocks
;(mockHumanInteraction.click as ReturnType<typeof mock>).mockClear()
;(mockHumanInteraction.clickByTextContent as ReturnType<typeof mock>).mockClear()
;(mockHumanInteraction.typeIntoTextarea as ReturnType<typeof mock>).mockClear()
;(mockHumanInteraction.typeIntoContentEditable as ReturnType<typeof mock>).mockClear()
;(mockHumanInteraction.dragSlider as ReturnType<typeof mock>).mockClear()
;(mockHumanInteraction.chunkPaste as ReturnType<typeof mock>).mockClear()
```

- [ ] **Step 9.3: Update queueEvaluateForOneTranslate for waitForTranslationOutputStable**

Since Task 8.9 adds `waitForTranslationOutputStable()` before scrape, it now calls `page.evaluate()` once (to delete `__kagiTranslationStable`). Add one more `mockResolvedValueOnce` to each queue function:

```typescript
function queueEvaluateForOneTranslate(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(undefined as never) // waitForTranslationOutputStable: delete __kagiTranslationStable
    .mockResolvedValueOnce(result)
}

function queueEvaluateForOneTranslateWithFormalitySwitch(result: string) {
  mockPage.evaluate
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(true as never)
    .mockResolvedValueOnce(undefined as never)
    .mockResolvedValueOnce(undefined as never) // waitForTranslationOutputStable: delete __kagiTranslationStable
    .mockResolvedValueOnce(result)
}
```

- [ ] **Step 9.4: Add DI test describe block**

Append to the bottom of `translation-mocked.e2e.test.ts`, before the comment block:

```typescript
describe('Human Interaction DI', () => {
  it('should call humanInteraction.dragSlider when setting reading level c2', async () => {
    const options = getDefaultTranslationOptions()
    options.readingLevel = 'c2'
    queueEvaluateForOneTranslate('C2 translation')

    const url = urlBuilder.build('Test', options)
    await browserService.translate(url, options)

    expect(mockHumanInteraction.dragSlider).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('range'),
      0,
      6, // c2 = step 6
    )
  })

  it('should call humanInteraction.chunkPaste for sourceText > 500 chars', async () => {
    const options = getDefaultTranslationOptions()
    const longText = 'x'.repeat(600)
    queueEvaluateForOneTranslate('Long text translation')

    const url = urlBuilder.build('Test', options)
    await browserService.translate(url, options, longText)

    expect(mockHumanInteraction.chunkPaste).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Source text input'),
      longText,
    )
  })

  it('should call humanInteraction.typeIntoContentEditable for sourceText ≤ 500 chars', async () => {
    const options = getDefaultTranslationOptions()
    const shortText = 'Hello world'
    queueEvaluateForOneTranslate('Short text translation')

    const url = urlBuilder.build('Test', options)
    await browserService.translate(url, options, shortText)

    expect(mockHumanInteraction.typeIntoContentEditable).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Source text input'),
      shortText,
    )
  })
})
```

- [ ] **Step 9.5: Run full test suite**

```bash
cd nghien_cuu_cua_toi && bun test
```

If tests fail due to evaluate queue miscount, adjust the number of `mockResolvedValueOnce` calls in the queue functions. The key invariant: the last queued value must be the translation result string.

- [ ] **Step 9.6: Run complete DoD check**

```bash
cd nghien_cuu_cua_toi && bun test && bun run typecheck && bun run lint
```

Expected: All tests PASS, no type errors, no lint errors.

- [ ] **Step 9.7: Final commit**

```bash
cd nghien_cuu_cua_toi && git add tests/e2e/translation-mocked.e2e.test.ts
git commit -m "test(e2e): inject MockHumanInteraction via DI and verify human interaction dispatch"
```

---

### Task 10: End-to-End Acceptance Verification (Plan Completion Gate)

> **This task is the final gate. Plan is NOT complete until both commands produce a successful translation output.**

**Acceptance success criteria (binding):**

1. `bun run start:local` → Chrome mở, thao tác human-like (Bezier mouse, keystroke delay, chunk paste), translation output xuất hiện, process exit without error
2. `bun run start` (Docker) → container runs, translation output xuất hiện trong logs, container exits clean

**Files:** none — verification only

- [ ] **Step 10.1: Run local verification**

```bash
cd nghien_cuu_cua_toi && bun run start:local
```

**Observe in Chrome (human review required):**

- [ ] Browser window opens
- [ ] Mouse moves với Bezier curve (không instant) khi click settings button
- [ ] Source text được nhập theo chunks / keystrokes (không paste ngay lập tức)
- [ ] Reading level slider được drag (không set value programmatically)
- [ ] Settings options được click với mouse movement tự nhiên

**Observe in terminal output:**

- [ ] Line: `Setting source text (N chars)...` xuất hiện
- [ ] Line: `⚙️  Clicking Translation Settings…` xuất hiện
- [ ] Line: `⚙️  Setting reading level "c2" → step 6…` xuất hiện
- [ ] Line: `Final translation output: <non-empty translated text>` xuất hiện
- [ ] Process exits 0 (no unhandled error, no crash)
- [ ] **CRITICAL**: Nếu thấy `⚠️ Degraded to standard` warnings → ghi nhận lại, đây là fallback path (acceptable), nhưng nếu MỌI interaction đều degrade thì cần investigate ghost-cursor compatibility

**Expected terminal snippet (approximate):**

```
🌐 KAGI TRANSLATE AUTOMATION (Production-Ready)
Setting source text (NNN chars)...
⚙️  Clicking Translation Settings…
⚙️  Setting reading level "c2" → step 6…
⚙️  Clicking formality "Vietnamese Casual"…
Final translation output: <Vietnamese translated text here>
✅ Complete!
```

If process hangs or shows error → **do not proceed to Step 10.2**. Debug first.

- [ ] **Step 10.2: Run Docker verification**

```bash
cd nghien_cuu_cua_toi && docker-compose up --build 2>&1 | tee /tmp/docker-run.log
```

**Watch logs for:**

- [ ] Container builds without error (`Successfully built` or `exiting with code 0` from build)
- [ ] Line: `Setting source text` appears
- [ ] Line: `Final translation output: <non-empty text>` appears
- [ ] Container exits with code 0 (not 1)

**Quick check after run:**

```bash
grep -E "(Final translation output|ERROR|Error|Unhandled)" /tmp/docker-run.log | head -20
```

Expected: Shows `Final translation output: <text>`, no ERROR lines.

- [ ] **Step 10.3: Confirm acceptance criteria met**

Only mark plan as complete when ALL of the following are true:

- [ ] `bun run start:local`: Chrome opened ✓, human-like interaction observed ✓, translation output non-empty ✓, no crash ✓
- [ ] `bun run start` (Docker): container ran ✓, translation output in logs ✓, exit code 0 ✓

If any criterion fails → do NOT mark complete. Open a bug task describing which criterion failed and what error was observed.

---

## Self-Review Checklist

**Spec coverage check:**

- [x] Input clamping at 20,000 chars with warning → Task 1
- [x] Defensive silent clamp in fillSourceTextInput → Task 2
- [x] Primary guard in index.ts → Task 2
- [x] 4-tier delay config → Task 3
- [x] computeDelayMultiplier + computeScaledDelay → Task 3
- [x] HUMAN_INPUT_THRESHOLD = 500 → Task 3
- [x] 3 hardcoded delays scaled → Task 4
- [x] waitForTranslationOutputStable signature updated → Task 4
- [x] ghost-cursor package research → Task 5
- [x] IHumanInteraction interface with 6 methods → Task 6
- [x] HumanInteractionService with Docker fallback → Task 7
- [x] DI constructor in KagiBrowserService → Task 8
- [x] All UI interactions delegated to humanInteraction → Task 8
- [x] waitForTranslationOutputStable called before scrape → Task 8
- [x] chunkPaste uses Clipboard API + Ctrl/Cmd+V (DEC-001) → Task 7
- [x] Docker bounding rect guard (DEC-003) → Task 7
- [x] Slider fallback to evaluate when rect.width=0 (DEC-004) → Task 7
- [x] IBrowserService interface unchanged → confirmed, no changes
- [x] e2e tests updated with MockHumanInteraction → Task 9
- [x] `bun run start:local` acceptance gate → Task 10
- [x] `bun run start` Docker acceptance gate → Task 10

**Type consistency:** All method signatures in Task 6 (interface) match implementations in Task 7 and call sites in Task 8.

---

## Plan Completion Definition

Plan is **DONE** when and only when:

1. `bun test && bun run typecheck && bun run lint` all pass (Task 9.6)
2. `bun run start:local` produces non-empty translation output with no crash (Task 10.1)
3. `bun run start` (Docker) produces non-empty translation output with exit code 0 (Task 10.2)

**No partial completion accepted.**
