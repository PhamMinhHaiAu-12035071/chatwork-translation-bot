# Kagi Sidecar PoC Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the validated PoC in `nghien_cuu_cua_toi/` into `packages/kagi-sidecar` so the production sidecar runs on `patchright` (patched Playwright + Chromium), uses a singleton browser with `openNewTab()` per request, and fails fast on any browser/context/login failure.

**Architecture:** Replace `puppeteer-real-browser` with `patchright`. Keep the Elysia HTTP server but make it long-running: launch one browser at boot, verify the Kagi login session once, then serve each HTTP `/translate` by opening a new tab and closing the previous one. The HTTP contract to `@chatwork-bot/provider-kagi` (`KagiClient.translate`) and every caller stay unchanged.

**Tech Stack:** Bun 1.1+, TypeScript 5.4 strict, `patchright ^1.59.0`, Elysia 1.4, Bun test runner, Docker Compose.

**Spec reference:** [`docs/superpowers/specs/2026-04-16-kagi-sidecar-poc-migration-design.md`](../specs/2026-04-16-kagi-sidecar-poc-migration-design.md).

**PoC reference path:** all relative paths starting with `nghien_cuu_cua_toi/` refer to the PoC tree in the same monorepo.

---

## Ground rules for this plan

- Every task ends with a commit. Commit messages follow the repo convention: `<type>(<scope>): <summary>` where `<scope>` is one of `kagi | repo | translator | chatwork | core | dashboard | webhook-logger | translation-prompt | provider-gemini | provider-openai | provider-cursor`. For this migration, use scope `kagi`.
- When a task says "port verbatim from `nghien_cuu_cua_toi/<path>`", use `cp` to copy the file and only adjust imports (see each task for the exact import rewrites). Do not hand-retype files unless noted.
- Tests are colocated (see `ai_rules/test-colocation.md`): `foo.ts` and `foo.test.ts` live in the same folder.
- TDD discipline: write the failing test first, run it to confirm it fails with the expected message, then implement.
- After each task's final commit, run at least `bun run typecheck` and the relevant package tests. Full repo `bun test && bun run typecheck && bun run lint` runs in Task 17.
- Working directory for every shell command: repo root `/Users/phamau/Desktop/projects/research/chatwork-translation-bot`. Where a command needs a package directory, it is marked `(in packages/kagi-sidecar)`.

---

## Task 1: Swap browser automation dependency to patchright

**Goal:** Replace `puppeteer-real-browser`, `@forad/puppeteer-humanize`, `ghost-cursor` with `patchright ^1.59.0` and prove it launches a Chromium process under Bun. Validating this first derisks the whole migration (spec risk R1).

**Files:**

- Modify: `packages/kagi-sidecar/package.json`
- Create: `packages/kagi-sidecar/scripts/smoke-patchright-launch.ts`
- Modify: `bun.lock` (auto-regenerated)

- [ ] **Step 1: Stage the new package.json dependencies**

Open `packages/kagi-sidecar/package.json`. Replace the `"dependencies"` block so the file reads exactly:

```json
{
  "name": "@chatwork-bot/kagi-sidecar",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "smoke:patchright": "bun run scripts/smoke-patchright-launch.ts"
  },
  "dependencies": {
    "@chatwork-bot/provider-kagi": "workspace:*",
    "elysia": "^1.4.27",
    "patchright": "^1.59.0"
  }
}
```

- [ ] **Step 2: Install deps**

Run: `bun install`
Expected: bun resolves patchright, removes the three old packages, updates `bun.lock`. No errors.

- [ ] **Step 3: Write the smoke script**

Create `packages/kagi-sidecar/scripts/smoke-patchright-launch.ts`:

```typescript
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
```

- [ ] **Step 4: Install patchright's browser binaries**

Run: `bunx patchright install chromium`
Expected: patchright downloads Chromium (several hundred MB; takes ~1 minute on a warm cache). If download fails in CI, fall back to `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` — but for local machines it should succeed.

- [ ] **Step 5: Run the smoke script**

Run: `bun run --cwd packages/kagi-sidecar smoke:patchright`
Expected output:

```
[smoke] opened about:blank, title=""
[smoke] ok
```

If this fails with `ERR_MODULE_NOT_FOUND` or a native-binding error, patchright is not viable on the current Bun version. **Stop and escalate** — do not continue. Workaround options: use `playwright` instead, or keep `puppeteer-real-browser` and only port `openNewTab` + login-verify logic. Report the exact error.

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/package.json packages/kagi-sidecar/scripts/smoke-patchright-launch.ts bun.lock
git commit -m "feat(kagi): swap puppeteer-real-browser for patchright

Remove puppeteer-real-browser, @forad/puppeteer-humanize, ghost-cursor.
Add patchright ^1.59.0 and a smoke script that validates Chromium
launches under Bun. De-risks the PoC migration before wider code changes."
```

---

## Task 2: Port mouse-path utilities (bezier + humanizer-config)

**Goal:** Move the pure-function utilities from the PoC into the sidecar. These have no patchright/puppeteer coupling, so they port verbatim.

**Files:**

- Create: `packages/kagi-sidecar/src/utils/bezier.ts` + `.test.ts`
- Create: `packages/kagi-sidecar/src/utils/humanizer-config.ts` + `.test.ts`

- [ ] **Step 1: Copy bezier + its test**

Run:

```bash
mkdir -p packages/kagi-sidecar/src/utils
cp nghien_cuu_cua_toi/src/utils/bezier.ts       packages/kagi-sidecar/src/utils/bezier.ts
cp nghien_cuu_cua_toi/src/utils/bezier.test.ts  packages/kagi-sidecar/src/utils/bezier.test.ts
```

- [ ] **Step 2: Copy humanizer-config + its test**

Run:

```bash
cp nghien_cuu_cua_toi/src/utils/humanizer-config.ts       packages/kagi-sidecar/src/utils/humanizer-config.ts
cp nghien_cuu_cua_toi/src/utils/humanizer-config.test.ts  packages/kagi-sidecar/src/utils/humanizer-config.test.ts
```

- [ ] **Step 3: Rewrite imports in humanizer-config**

The PoC files use `~/config` path alias to import `HUMANIZER_CONFIG`. The sidecar will keep the same constants in its own constants folder (see Task 4), so open `packages/kagi-sidecar/src/utils/humanizer-config.ts` and change the import line:

From (PoC):

```typescript
import { HUMANIZER_CONFIG } from '~/config'
```

To (sidecar):

```typescript
import { HUMANIZER_CONFIG } from '../constants/humanizer-config'
```

Do the same inside `humanizer-config.test.ts`:

```typescript
import { HUMANIZER_CONFIG } from '../constants/humanizer-config'
```

The `bezier.ts` file has no internal imports — leave untouched.

- [ ] **Step 4: Run tests (they will fail — the constants file does not exist yet)**

Run: `bun test packages/kagi-sidecar/src/utils/`
Expected: `Cannot find module '../constants/humanizer-config'`. This is fine — Task 4 creates it. Do not write the constants file yet; we want to commit the ported utilities first so the history is clean.

- [ ] **Step 5: Commit (tests red; next task makes them green)**

```bash
git add packages/kagi-sidecar/src/utils/
git commit -m "feat(kagi): port bezier path + humanizer utils from PoC

Copies bezier.ts and humanizer-config.ts verbatim from nghien_cuu_cua_toi
into packages/kagi-sidecar/src/utils. Imports are rewritten to the
sidecar's constants folder (constants created in Task 4)."
```

---

## Task 3: Port kagi-session-cookies utility

**Goal:** Port the cookie-injection helper that reads a Chrome-exported JSON file and applies the cookies through patchright's `BrowserContext.addCookies`.

**Files:**

- Create: `packages/kagi-sidecar/src/utils/kagi-session-cookies.ts` + `.test.ts`

- [ ] **Step 1: Copy the file + its test**

```bash
cp nghien_cuu_cua_toi/src/utils/kagi-session-cookies.ts       packages/kagi-sidecar/src/utils/kagi-session-cookies.ts
cp nghien_cuu_cua_toi/src/utils/kagi-session-cookies.test.ts  packages/kagi-sidecar/src/utils/kagi-session-cookies.test.ts
```

- [ ] **Step 2: Rewrite the config import**

Open `packages/kagi-sidecar/src/utils/kagi-session-cookies.ts`. Change the import of `KAGI_ORIGIN_URL`:

From (PoC):

```typescript
import { KAGI_ORIGIN_URL } from '~/config'
```

To (sidecar):

```typescript
import { KAGI_ORIGIN_URL } from '../constants/kagi-ui'
```

If the test file also imports from `~/config`, rewrite the same way. Otherwise leave it.

- [ ] **Step 3: Run tests (still red because kagi-ui.ts hasn't been extended yet)**

Run: `bun test packages/kagi-sidecar/src/utils/kagi-session-cookies.test.ts`
Expected: module-not-found for `../constants/kagi-ui` OR export-not-found for `KAGI_ORIGIN_URL`. Either is fine; Task 4 resolves it.

- [ ] **Step 4: Commit**

```bash
git add packages/kagi-sidecar/src/utils/kagi-session-cookies.ts packages/kagi-sidecar/src/utils/kagi-session-cookies.test.ts
git commit -m "feat(kagi): port Kagi session-cookie injector from PoC

Adds visitKagiOriginAndInjectSessionCookies helper and the
ChromeExportCookie → Playwright Cookie mapper used at boot to
authenticate the long-running browser against kagi.com."
```

---

## Task 4: Extend sidecar constants (delay-config, kagi-ui, humanizer-config)

**Goal:** Give the ported utilities and the rewritten browser service everything they need from `src/constants/`. This unifies spec Section 4.2 items `humanizer.config.ts`, `delay.config.ts`, and `translation.config.ts` into sidecar-shaped modules.

**Files:**

- Create: `packages/kagi-sidecar/src/constants/humanizer-config.ts`
- Modify: `packages/kagi-sidecar/src/constants/delay-config.ts`
- Modify: `packages/kagi-sidecar/src/constants/kagi-ui.ts`

- [ ] **Step 1: Create `humanizer-config.ts`**

Create `packages/kagi-sidecar/src/constants/humanizer-config.ts` — copy the entire exported `HUMANIZER_CONFIG`, `NumberRangeMs`, and `HumanizerPunctuationPauseMap` from `nghien_cuu_cua_toi/src/config/humanizer.config.ts`:

```typescript
/**
 * Human-like interaction settings used by HumanInteractionService and helper utilities.
 * Ported verbatim from nghien_cuu_cua_toi/src/config/humanizer.config.ts.
 */

export interface NumberRangeMs {
  readonly minMs: number
  readonly maxMs: number
}

export type HumanizerPunctuationPauseMap = Record<string, NumberRangeMs>

export const HUMANIZER_CONFIG = {
  WORDS_PER_MINUTE: 200,
  CHAR_DELAY_JITTER: 0.35,
  MIN_CHAR_DELAY_MS: 28,
  MAX_CHAR_DELAY_MS: 260,
  AVERAGE_CHARS_PER_WORD: 5,
  MISTAKE_RATE: 0.03,
  TYPING_MISTAKE_PAUSE_MS: { minMs: 90, maxMs: 220 },
  HESITATION_PROBABILITY: 0.16,
  TYPING_BURST_MIN: 2,
  TYPING_BURST_MAX: 7,
  TYPING_BURST_HESITATION_PROBABILITY: 0.22,
  TYPING_BURST_HESITATION_MS: { minMs: 55, maxMs: 140 },
  PUNCTUATION_PAUSE_MS: {
    '.': { minMs: 180, maxMs: 320 },
    ',': { minMs: 120, maxMs: 220 },
    '!': { minMs: 190, maxMs: 310 },
    '?': { minMs: 190, maxMs: 320 },
    ';': { minMs: 150, maxMs: 280 },
    ':': { minMs: 140, maxMs: 270 },
  } satisfies HumanizerPunctuationPauseMap,
  MOUSE_PATH_OFFSET_MIN: 14,
  MOUSE_PATH_OFFSET_MAX: 58,
  MOUSE_STEP_DELAY_MS: { minMs: 3, maxMs: 12 },
  MOUSE_OVERSHOOT_CHANCE: 0.28,
} as const
```

- [ ] **Step 2: Extend `delay-config.ts`**

Open `packages/kagi-sidecar/src/constants/delay-config.ts` and merge the PoC keys. The sidecar already exports `HUMAN_INPUT_THRESHOLD`, `DELAY_TIERS`, `computeScaledDelay`, `computeDelayMultiplier` — keep those. **Add** a `BROWSER_CONFIG` export with every key the PoC uses:

```typescript
/**
 * BROWSER_CONFIG: timing knobs for the patchright-driven flow.
 * Merged from nghien_cuu_cua_toi/src/config/translation.config.ts `BROWSER_CONFIG`.
 */
export const BROWSER_CONFIG = {
  HEADLESS: false,
  TIMEOUT: 30_000,
  WAIT_FOR_SELECTOR_TIMEOUT: 15_000,
  CLOUDFLARE_VERIFICATION_TIMEOUT_MS: 45_000,
  CLOUDFLARE_VERIFICATION_POLL_MS: 250,
  POST_RENDER_DELAY: 1_000,
  READING_LEVEL_SWEEP_DELAY_MS: 1_000,
  TRANSLATION_OUTPUT_STABLE_MS: 1_500,
  TRANSLATION_OUTPUT_POLL_MS: 400,
  TRANSLATION_OUTPUT_MAX_WAIT_MS: 90_000,
  POST_STABLE_EXTRA_MS: 250,
  CONTEXT_URL_SETTLE_MS: 1_500,
  OUTPUT_READY_PRE_SETTINGS_MS: 2_000,
  POST_DIALOG_SETTLE_MS: 400,
  STYLE_OPTION_CLICK_GAP_MS: 200,
  POST_DISMISS_SETTINGS_MS: 200,
  POST_FORMALITY_CASUAL_SETTLE_MS: 3_000,
  TRANSLATION_VISIBLE_AFTER_SETTINGS_MS: 45_000,
} as const
```

If the file already has `KAGI_TIMING` (sidecar's current naming), keep it exported for backward compatibility with existing code until Task 8 replaces the consumer. Do not delete `KAGI_TIMING` until Task 8 lands.

- [ ] **Step 3: Extend `kagi-ui.ts`**

Open `packages/kagi-sidecar/src/constants/kagi-ui.ts`. **Add** the missing selectors, labels, URL, env-name constants, and the `getReadingLevelSliderValue` helper. The PoC source is `nghien_cuu_cua_toi/src/config/translation.config.ts`. Copy these exports (and keep everything already there):

```typescript
/** Kagi origin for the first-hop navigation before translate.kagi.com. */
export const KAGI_ORIGIN_URL = 'https://kagi.com/'

/** Env-var name that overrides automatic session-file lookup. */
export const KAGI_SESSION_FILE_ENV = 'KAGI_SESSION_FILE' as const

/** Default session-cookie filename looked up in ./secrets and /app/secrets. */
export const KAGI_SESSION_FILE_NAME = 'kagi.com_16-04-2026.json' as const

/** Kagi "Brief context for translation" textarea max length. */
export const MAX_TRANSLATION_CONTEXT_LENGTH = 100

export function clampTranslationContext(raw: string | undefined): string {
  if (raw === undefined || raw === '') return ''
  return raw.length <= MAX_TRANSLATION_CONTEXT_LENGTH
    ? raw
    : raw.slice(0, MAX_TRANSLATION_CONTEXT_LENGTH)
}

export const READING_LEVELS = ['standard', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const
export type ReadingLevel = (typeof READING_LEVELS)[number]

export function getReadingLevelSliderValue(level: ReadingLevel): number {
  return READING_LEVELS.indexOf(level)
}
```

Then extend `KAGI_SELECTORS` to include the login + formality selectors (keep everything already present):

```typescript
export const KAGI_SELECTORS = {
  // ... existing selectors ...
  TRANSLATION_SETTINGS_BUTTON: 'button[aria-label="Translation Settings"]',
  READING_LEVEL_SLIDER: 'input[type="range"][aria-valuemin="0"][aria-valuemax="6"][step="1"]',
  TRANSLATION_STYLE_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  FORMALITY_OPTION_LABEL_SPAN: 'span.flex-grow.text-start, span.grow.text-start',
  SPEAKER_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  ADDRESSEE_GENDER_OPTION_LABEL_SPAN: 'span.flex-grow.text-start',
  TRANSLATION_CONTENT: '.translation-content',
  TEXT_SPAN: '.font-universal, .text-direction-auto, span[dir]',
  TEXTAREA_PLACEHOLDER:
    'textarea[placeholder*="translation"], textarea[placeholder*="Translation"]',
  TRANSLATION_CONTEXT_TEXTAREA: 'textarea[placeholder*="Brief context for translation"]',
  SOURCE_TEXT_INPUT: '[aria-label="Source text input"]',
  LOGGED_IN_INDICATOR: 'a[href="/logout"]',
  SIGNIN_EMAIL_INPUT: '#signInEmailBox',
  SIGNIN_QR_AUTH: '#qr-code-auth',
} as const
```

Add the UI-label maps (if not already present — check the existing file first to avoid duplicating keys):

```typescript
export const TRANSLATION_STYLE_UI_LABELS = {
  NATURAL: 'Natural',
  LITERAL: 'Literal',
} as const

export const FORMALITY_UI_LABELS = {
  VIETNAMESE_CASUAL: 'Vietnamese Casual',
  VIETNAMESE_FORMAL: 'Vietnamese Formal',
  STANDARD: 'Standard',
} as const

export const GENDER_PREFERENCE_UI_LABELS = {
  UNKNOWN: 'Unknown',
  NEUTRAL: 'Neutral',
  FEMININE: 'Feminine',
  MASCULINE: 'Masculine',
} as const

export const SPEAKER_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS
export const ADDRESSEE_GENDER_UI_LABELS = GENDER_PREFERENCE_UI_LABELS
```

If the file has `KAGI_UI_LABELS` and `FORMALITY_LABELS` already, keep them exported. Task 8 will standardize on the new names; keeping both during migration avoids breaking the old `browser-service.ts`.

- [ ] **Step 4: Run the colocated constants tests**

Run: `bun test packages/kagi-sidecar/src/constants/`
Expected: tests that existed pre-migration still pass. Any new keys you added are not directly tested here — they get exercised transitively via the browser-service tests.

- [ ] **Step 5: Re-run the utils tests (they should pass now)**

Run: `bun test packages/kagi-sidecar/src/utils/`
Expected: all tests pass (bezier, humanizer-config, kagi-session-cookies).

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/constants/
git commit -m "feat(kagi): extend sidecar constants for patchright flow

Adds HUMANIZER_CONFIG, BROWSER_CONFIG, Kagi origin/session env
constants, reading-level mapping, and the login/formality selectors
that the patchright-driven KagiBrowserService will consume.
Existing exports (KAGI_TIMING, KAGI_UI_LABELS, FORMALITY_LABELS)
are kept to avoid breaking the still-active puppeteer service."
```

---

## Task 5: Add `IBrowserService`/`IBrowserConnection` types; retarget `IHumanInteraction` to patchright

**Goal:** Establish the dependency-inversion boundary. `browser-service.ts` (Task 8) will implement `IBrowserService`; tests will swap in fakes.

**Files:**

- Create: `packages/kagi-sidecar/src/types/browser.interface.ts`
- Modify: `packages/kagi-sidecar/src/types/human-interaction.interface.ts`

- [ ] **Step 1: Create `browser.interface.ts`**

```typescript
/**
 * Dependency-inversion boundary for the Kagi browser automation layer.
 * Ported from nghien_cuu_cua_toi/src/services/interfaces/browser.interface.ts.
 */

import type { BrowserContext } from 'patchright'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'

export interface IBrowserConnection {
  close(): Promise<void>
  getContext?(): BrowserContext
}

export interface TranslateResult {
  /** Scraped translation text from the output pane. */
  translated: string
  /** Address-bar URL after settings application. Useful for debugging. */
  finalUrl: string
}

export interface KagiTranslateUiRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface IBrowserService {
  /** Launches the persistent Chromium context. Call ONCE at boot. */
  launch(): Promise<IBrowserConnection>

  /**
   * Opens a new tab within the existing context and closes the previous one.
   * Call for every request after the first so each translation gets a clean tab.
   */
  openNewTab?(): Promise<void>

  /**
   * Runs the full translate flow (navigate → fill → settings → stabilize → scrape).
   * Callers must ensure `launch()` has completed and login has been verified.
   */
  translate(request: KagiTranslateUiRequest): Promise<TranslateResult>

  /** Closes the browser context. Safe to call multiple times. */
  close(): Promise<void>
}
```

- [ ] **Step 2: Replace `human-interaction.interface.ts`**

Open `packages/kagi-sidecar/src/types/human-interaction.interface.ts`. The current file types methods against puppeteer's `PageLike`. Replace the file with patchright-aligned signatures:

```typescript
/**
 * Human-like DOM interaction surface used by KagiBrowserService.
 * Mirrors nghien_cuu_cua_toi/src/services/interfaces/human-interaction.interface.ts.
 */

import type { Page } from 'patchright'

export interface IHumanInteraction {
  click(page: Page, selector: string): Promise<void>

  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
```

- [ ] **Step 3: typecheck**

Run: `bun run --cwd packages/kagi-sidecar typecheck`
Expected: it fails on `browser-service.ts` and `services/human-interaction.service.ts` because the old puppeteer-based code doesn't satisfy the new signatures. **Leave the failure in place** — Tasks 6 and 8 will fix it. Commit now so the interface change is isolated.

- [ ] **Step 4: Commit**

```bash
git add packages/kagi-sidecar/src/types/
git commit -m "feat(kagi): retarget service interfaces to patchright

Adds IBrowserService + IBrowserConnection + TranslateResult in a new
browser.interface.ts. Replaces IHumanInteraction's puppeteer PageLike
with patchright Page. Typecheck is deliberately red until the service
impls land in Tasks 6 and 8."
```

---

## Task 6: Replace `human-interaction.service.ts` with the PoC implementation

**Goal:** Swap the puppeteer humanizer for the patchright humanizer from the PoC. This is a drop-in replacement — same responsibilities, different underlying library.

**Files:**

- Modify: `packages/kagi-sidecar/src/services/human-interaction.service.ts`
- Modify: `packages/kagi-sidecar/src/services/human-interaction.service.test.ts`

- [ ] **Step 1: Copy PoC implementation into sidecar path**

```bash
cp nghien_cuu_cua_toi/src/services/human-interaction.service.ts \
   packages/kagi-sidecar/src/services/human-interaction.service.ts
```

- [ ] **Step 2: Rewrite imports in the copied file**

Open `packages/kagi-sidecar/src/services/human-interaction.service.ts` and change these four import lines:

From:

```typescript
import type { IHumanInteraction } from '~/services/interfaces/human-interaction.interface'
import { HUMANIZER_CONFIG } from '~/config'
import {
  calculateCharDelay,
  getMistakeChar,
  getPauseAfterPunctuation,
  shouldAddHesitation,
  shouldMakeMistake,
} from '~/utils/humanizer-config'
import { type Point, generateNaturalBezierPath } from '~/utils/bezier'
```

To:

```typescript
import type { IHumanInteraction } from '../types/human-interaction.interface'
import { HUMANIZER_CONFIG } from '../constants/humanizer-config'
import {
  calculateCharDelay,
  getMistakeChar,
  getPauseAfterPunctuation,
  shouldAddHesitation,
  shouldMakeMistake,
} from '../utils/humanizer-config'
import { type Point, generateNaturalBezierPath } from '../utils/bezier'
```

- [ ] **Step 3: Port the test file**

```bash
cp nghien_cuu_cua_toi/src/services/human-interaction.service.test.ts \
   packages/kagi-sidecar/src/services/human-interaction.service.test.ts
```

Rewrite imports in the test the same way (swap `~/` for relative paths). Ensure the mock `Page` shape uses patchright types — the PoC already does, so no further edits needed.

- [ ] **Step 4: Run the ported tests**

Run: `bun test packages/kagi-sidecar/src/services/human-interaction.service.test.ts`
Expected: all PoC assertions pass (bezier path has intermediate steps; typing bursts insert/backspace mistakes; chunkPaste splits body then types tail; dragSlider falls back when rect invalid).

- [ ] **Step 5: typecheck**

Run: `bun run --cwd packages/kagi-sidecar typecheck`
Expected: still fails on `browser-service.ts` (it imports the old interface). Acceptable — Task 8 fixes it.

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/services/human-interaction.service.ts \
       packages/kagi-sidecar/src/services/human-interaction.service.test.ts
git commit -m "feat(kagi): port patchright-based HumanInteractionService

Replaces the puppeteer implementation with the PoC version: bezier
mouse paths, typing bursts with mistake correction, chunkPaste for
long input, and an evaluate-based slider fallback when the rect is
invalid under Xvfb."
```

---

## Task 7: Add internal `runBatchTranslation` helper

**Goal:** Import the PoC's batch helper. It is not exposed over HTTP (DEC-004) but it is the reusable tab-lifecycle primitive that both `/translate` and future tests rely on.

**Files:**

- Create: `packages/kagi-sidecar/src/services/batch-translation.service.ts` + `.test.ts`

- [ ] **Step 1: Copy + rewrite imports**

```bash
cp nghien_cuu_cua_toi/src/services/batch-translation.service.ts \
   packages/kagi-sidecar/src/services/batch-translation.service.ts
cp nghien_cuu_cua_toi/src/services/batch-translation.service.test.ts \
   packages/kagi-sidecar/src/services/batch-translation.service.test.ts
```

Open `packages/kagi-sidecar/src/services/batch-translation.service.ts`. Change imports:

From (PoC):

```typescript
import type { IBrowserService } from './interfaces/browser.interface'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { TranslationOptions } from '~/types'
```

To (sidecar):

```typescript
import type { IBrowserService, KagiTranslateUiRequest } from '../types/browser.interface'
```

The PoC's `BatchTranslationDeps` has `urlBuilder` and `TranslationOptions`. The sidecar does not use the URL builder (it navigates directly to `https://translate.kagi.com/?from=auto&to=vi`). Replace the function signature so messages are `KagiTranslateUiRequest` and there is no `urlBuilder` dep:

```typescript
export interface BatchTranslationResult {
  index: number
  original: string
  translated: string
  finalUrl: string
}

export interface BatchTranslationDeps {
  browserService: IBrowserService
  log?: (message: string) => void
}

export async function runBatchTranslation(
  messages: readonly KagiTranslateUiRequest[],
  deps: BatchTranslationDeps,
): Promise<BatchTranslationResult[]> {
  const { browserService, log } = deps
  const results: BatchTranslationResult[] = []

  await browserService.launch()

  try {
    for (const [index, message] of messages.entries()) {
      log?.(`\n🔁 Message ${String(index + 1)}/${String(messages.length)}`)

      if (index > 0) {
        await browserService.openNewTab?.()
      }

      const { translated, finalUrl } = await browserService.translate(message)

      results.push({
        index,
        original: message.text,
        translated,
        finalUrl,
      })

      log?.(`Final translation output: ${translated}`)
    }

    return results
  } finally {
    await browserService.close()
  }
}
```

- [ ] **Step 2: Rewrite the test to match the new signature**

Open `packages/kagi-sidecar/src/services/batch-translation.service.test.ts`. Replace its content with:

```typescript
import { describe, expect, it, mock } from 'bun:test'
import { runBatchTranslation, type BatchTranslationDeps } from './batch-translation.service'
import type {
  IBrowserConnection,
  IBrowserService,
  KagiTranslateUiRequest,
  TranslateResult,
} from '../types/browser.interface'

function createFakeBrowserService(
  translate: (request: KagiTranslateUiRequest) => Promise<TranslateResult>,
): IBrowserService & {
  launchCount: number
  openNewTabCount: number
  closeCount: number
} {
  let launchCount = 0
  let openNewTabCount = 0
  let closeCount = 0
  const connection: IBrowserConnection = { close: async () => undefined }

  const service = {
    async launch() {
      launchCount += 1
      return connection
    },
    async openNewTab() {
      openNewTabCount += 1
    },
    translate,
    async close() {
      closeCount += 1
    },
    get launchCount() {
      return launchCount
    },
    get openNewTabCount() {
      return openNewTabCount
    },
    get closeCount() {
      return closeCount
    },
  } satisfies IBrowserService & {
    launchCount: number
    openNewTabCount: number
    closeCount: number
  }

  return service
}

describe('runBatchTranslation', () => {
  it('reuses the initial tab for message[0] and opens a new tab for each subsequent message', async () => {
    const browserService = createFakeBrowserService(async (req) => ({
      translated: `VI:${req.text}`,
      finalUrl: `https://example.test/?t=${req.text}`,
    }))
    const messages: KagiTranslateUiRequest[] = [
      { text: 'a', style: 'Clear' },
      { text: 'b', style: 'Clear' },
      { text: 'c', style: 'Clear' },
    ]

    const results = await runBatchTranslation(messages, { browserService })

    expect(browserService.launchCount).toBe(1)
    expect(browserService.openNewTabCount).toBe(2) // items[1], items[2]
    expect(browserService.closeCount).toBe(1)
    expect(results).toEqual([
      { index: 0, original: 'a', translated: 'VI:a', finalUrl: 'https://example.test/?t=a' },
      { index: 1, original: 'b', translated: 'VI:b', finalUrl: 'https://example.test/?t=b' },
      { index: 2, original: 'c', translated: 'VI:c', finalUrl: 'https://example.test/?t=c' },
    ])
  })

  it('closes the browser even when translate throws (fail-fast aborts remaining items)', async () => {
    let calls = 0
    const browserService = createFakeBrowserService(async (req) => {
      calls += 1
      if (req.text === 'b') throw new Error('simulated Kagi failure')
      return { translated: `VI:${req.text}`, finalUrl: 'https://example.test/' }
    })
    const messages: KagiTranslateUiRequest[] = [
      { text: 'a', style: 'Clear' },
      { text: 'b', style: 'Clear' },
      { text: 'c', style: 'Clear' },
    ]

    await expect(runBatchTranslation(messages, { browserService })).rejects.toThrow(
      'simulated Kagi failure',
    )

    expect(calls).toBe(2) // items[2] must not run
    expect(browserService.closeCount).toBe(1) // finally must run
  })

  it('logs per-message progress when a log function is provided', async () => {
    const lines: string[] = []
    const browserService = createFakeBrowserService(async (req) => ({
      translated: `VI:${req.text}`,
      finalUrl: 'https://example.test/',
    }))

    await runBatchTranslation([{ text: 'a', style: 'Clear' }], {
      browserService,
      log: (line) => {
        lines.push(line)
      },
    })

    expect(lines.some((l) => l.includes('Message 1/1'))).toBe(true)
    expect(lines.some((l) => l.includes('Final translation output: VI:a'))).toBe(true)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `bun test packages/kagi-sidecar/src/services/batch-translation.service.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add packages/kagi-sidecar/src/services/batch-translation.service.ts \
       packages/kagi-sidecar/src/services/batch-translation.service.test.ts
git commit -m "feat(kagi): add runBatchTranslation internal helper

Ports the PoC's batch service, adapted to the sidecar's
KagiTranslateUiRequest shape (no URL builder). Item[0] reuses the
tab from launch(); subsequent items call openNewTab(). The
browser always closes in the finally block."
```

---

## Task 8: Rewrite `browser-service.ts` — skeleton, launch, openNewTab

**Goal:** Build the new `KagiBrowserService` incrementally. In this task: connection wrapper, `launch()`, `openNewTab()`, `close()`. Login verify and translate flow come in Tasks 9 and 10.

**Files:**

- Rewrite: `packages/kagi-sidecar/src/browser-service.ts`
- Rewrite: `packages/kagi-sidecar/src/browser-service.test.ts`
- Create: `packages/kagi-sidecar/src/browser-service.openNewTab.test.ts`

- [ ] **Step 1: Write the first failing test (launch returns a closable connection)**

Replace the content of `packages/kagi-sidecar/src/browser-service.test.ts` with this bootstrap — we will add more tests in Tasks 9 and 10:

```typescript
import { describe, expect, it, mock } from 'bun:test'
import { KagiBrowserService } from './browser-service'
import type { BrowserContext, Page } from 'patchright'

function createFakeContext(pages: Page[] = []): BrowserContext {
  return {
    pages: () => pages,
    newPage: async () => {
      const page = createFakePage('about:blank')
      pages.push(page)
      return page
    },
    close: async () => undefined,
    addCookies: async () => undefined,
  } as unknown as BrowserContext
}

function createFakePage(url: string): Page {
  return {
    url: () => url,
    goto: async () => null,
    close: async () => undefined,
    keyboard: { press: async () => undefined } as Page['keyboard'],
    mouse: {} as Page['mouse'],
    evaluate: async () => undefined,
    waitForFunction: async () => ({ jsonValue: async () => true }) as any,
    waitForSelector: async () => null,
    focus: async () => undefined,
    click: async () => undefined,
    locator: () => ({ first: () => ({ scrollIntoViewIfNeeded: async () => undefined }) }) as any,
  } as unknown as Page
}

describe('KagiBrowserService.launch + close', () => {
  it('launches a persistent context, returns a BrowserConnection, and close() tears it down', async () => {
    const existingPage = createFakePage('about:blank')
    const context = createFakeContext([existingPage])
    const launchMock = mock(async () => context)

    const service = new KagiBrowserService({ launchContext: launchMock as any })
    const connection = await service.launch()

    expect(connection).toBeDefined()
    expect(launchMock).toHaveBeenCalledTimes(1)

    await service.close()
    // Second close is a no-op, not an error
    await service.close()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: FAIL — `KagiBrowserService` either has the old puppeteer constructor signature or the `launchContext` option doesn't exist yet.

- [ ] **Step 3: Rewrite `browser-service.ts` with the new skeleton**

Replace the entire file with the skeleton below. Keep the existing `KagiSidecarError` class exactly as-is (copy it from the current file) because provider-kagi's HTTP contract depends on those `code` values (`ANTI_ABUSE`, `BACKPRESSURE`, `PAYLOAD_TOO_LARGE`, `TIMEOUT`, `TRANSPORT`, `INVALID_RESPONSE`, `UI_INTERACTION`). Do not rename them.

```typescript
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'patchright'

import { KAGI_STYLE_PRESETS, type KagiStyle } from '@chatwork-bot/provider-kagi'

import { clampInputText } from './constants/input-clamping.js'
import { BROWSER_CONFIG, computeScaledDelay, HUMAN_INPUT_THRESHOLD } from './constants/delay-config.js'
import {
  KAGI_ORIGIN_URL,
  KAGI_SELECTORS,
  KAGI_SESSION_FILE_ENV,
  KAGI_SESSION_FILE_NAME,
  clampTranslationContext,
} from './constants/kagi-ui.js'
import type {
  IBrowserConnection,
  IBrowserService,
  KagiTranslateUiRequest,
  TranslateResult,
} from './types/browser.interface.js'
import type { IHumanInteraction } from './types/human-interaction.interface.js'
import { HumanInteractionService } from './services/human-interaction.service.js'

export type KagiSidecarErrorCode =
  | 'ANTI_ABUSE'
  | 'BACKPRESSURE'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | 'TRANSPORT'
  | 'INVALID_RESPONSE'
  | 'UI_INTERACTION'

export class KagiSidecarError extends Error {
  constructor(
    public readonly code: KagiSidecarErrorCode,
    message: string,
    options?: { retryable?: boolean; status?: number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'KagiSidecarError'
    this.retryable = options?.retryable ?? false
    this.status = options?.status ?? 502
  }

  public readonly retryable: boolean
  public readonly status: number
}

export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslationResult {
  translated: string
  attempts: number
  queueWaitMs: number
  transportLatencyMs: number
}

export interface KagiHealthSnapshot {
  ready: boolean
  activeCount: number
  queuedCount: number
}

type LaunchContext = (
  userDataDir: string,
  options: Parameters<typeof chromium.launchPersistentContext>[1],
) => Promise<BrowserContext>

export interface KagiBrowserServiceOptions {
  minIntervalMs: number
  maxQueueDepth: number
  maxQueueWaitMs: number
  maxRetries: number
  retryBaseMs: number
  requestTimeoutMs: number
  userDataDir: string
  headless: boolean
  sessionFile?: string
  sleep(ms: number): Promise<void>
  now(): number
  random(): number
  /** Override for tests — defaults to patchright's `chromium.launchPersistentContext`. */
  launchContext: LaunchContext
  /** Ensures the user-data dir exists before launch. Injectable for tests. */
  ensureUserDataDir(path: string): Promise<void>
  humanInteraction?: IHumanInteraction
}

class BrowserConnection implements IBrowserConnection {
  constructor(private context: BrowserContext, private page: Page) {}

  async close(): Promise<void> {
    await this.context.close()
  }

  getContext(): BrowserContext {
    return this.context
  }

  getPage(): Page {
    return this.page
  }

  setPage(page: Page): void {
    this.page = page
  }
}

export class KagiBrowserService implements IBrowserService {
  private readonly options: KagiBrowserServiceOptions
  private readonly humanInteraction: IHumanInteraction
  private connection: BrowserConnection | null = null
  private isLoginVerified = false
  private hasServedFirstRequest = false

  private activeCount = 0
  private queuedCount = 0
  private lastRequestStartedAt = 0
  private queueTail: Promise<void> = Promise.resolve()

  constructor(options: Partial<KagiBrowserServiceOptions> = {}) {
    this.options = {
      minIntervalMs: options.minIntervalMs ?? 1_500,
      maxQueueDepth: options.maxQueueDepth ?? 10,
      maxQueueWaitMs: options.maxQueueWaitMs ?? 15_000,
      maxRetries: options.maxRetries ?? 2,
      retryBaseMs: options.retryBaseMs ?? 1_000,
      requestTimeoutMs: options.requestTimeoutMs ?? 120_000,
      userDataDir: options.userDataDir ?? join(process.cwd(), 'user-data'),
      headless: options.headless ?? BROWSER_CONFIG.HEADLESS,
      sessionFile: options.sessionFile,
      sleep: options.sleep ?? ((ms) => Bun.sleep(ms)),
      now: options.now ?? (() => Date.now()),
      random: options.random ?? (() => Math.random()),
      launchContext: options.launchContext ?? ((dir, opts) =>
        chromium.launchPersistentContext(dir, opts),
      ),
      ensureUserDataDir:
        options.ensureUserDataDir ?? ((path) => mkdir(path, { recursive: true }).then(() => undefined)),
    }
    this.humanInteraction = options.humanInteraction ?? new HumanInteractionService()
  }

  getHealthSnapshot(): KagiHealthSnapshot {
    return {
      ready: this.connection !== null && this.isLoginVerified,
      activeCount: this.activeCount,
      queuedCount: this.queuedCount,
    }
  }

  async launch(): Promise<IBrowserConnection> {
    if (this.connection !== null) return this.connection

    await this.options.ensureUserDataDir(this.options.userDataDir)

    const context = await this.options.launchContext(this.options.userDataDir, {
      headless: this.options.headless,
      viewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized',
      ],
    })

    const existing = context.pages()[0]
    const page = existing ?? (await context.newPage())
    this.connection = new BrowserConnection(context, page)
    return this.connection
  }

  async openNewTab(): Promise<void> {
    if (this.connection === null) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        'openNewTab called before launch; no browser connection',
        { status: 502 },
      )
    }
    const context = this.connection.getContext()
    const oldPage = this.connection.getPage()
    const newPage = await context.newPage()
    this.connection.setPage(newPage)
    if (typeof oldPage.close === 'function') {
      await oldPage.close()
    }
  }

  async close(): Promise<void> {
    if (this.connection !== null) {
      await this.connection.close()
      this.connection = null
    }
    this.isLoginVerified = false
    this.hasServedFirstRequest = false
  }

  // translate(): implemented in Task 10
  async translate(_request: KagiTranslateUiRequest): Promise<TranslateResult> {
    throw new KagiSidecarError('UI_INTERACTION', 'translate not implemented yet (Task 10)', {
      status: 500,
    })
  }
}
```

- [ ] **Step 4: Run the failing test — it should now pass**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: PASS. The skeleton plus `launch/close` satisfies the first test.

- [ ] **Step 5: Write the openNewTab test in its own file**

Create `packages/kagi-sidecar/src/browser-service.openNewTab.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import type { BrowserContext, Page } from 'patchright'
import { KagiBrowserService, KagiSidecarError } from './browser-service'

function createPageMock(id: string) {
  const closed = { value: false }
  return {
    id,
    closed,
    page: {
      url: () => `about:blank#${id}`,
      close: async () => {
        closed.value = true
      },
    } as unknown as Page,
  }
}

describe('KagiBrowserService.openNewTab', () => {
  it('opens a new page, swaps the connection pointer, then closes the old page', async () => {
    const first = createPageMock('first')
    const second = createPageMock('second')
    let createdPages: Page[] = [first.page]

    const context = {
      pages: () => createdPages,
      newPage: async () => {
        createdPages = [...createdPages, second.page]
        return second.page
      },
      close: async () => undefined,
    } as unknown as BrowserContext

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()

    await service.openNewTab()

    expect(first.closed.value).toBe(true) // old page closed
    expect(second.closed.value).toBe(false) // new page still open
    // connection now references the second page
    expect(service['connection']?.getPage()).toBe(second.page)
  })

  it('throws KagiSidecarError(UI_INTERACTION) when called before launch', async () => {
    const service = new KagiBrowserService({
      launchContext: async () => ({}) as BrowserContext,
      ensureUserDataDir: async () => undefined,
    })

    await expect(service.openNewTab()).rejects.toBeInstanceOf(KagiSidecarError)
  })
})
```

- [ ] **Step 6: Run both browser-service test files**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts packages/kagi-sidecar/src/browser-service.openNewTab.test.ts`
Expected: all pass (3 tests total so far).

- [ ] **Step 7: typecheck the package**

Run: `bun run --cwd packages/kagi-sidecar typecheck`
Expected: PASS now that `browser-service.ts` uses the new interface. Note: `server.ts` and `index.ts` may still typecheck green because the `translate()` placeholder still compiles. If anything else breaks, report and fix before committing.

- [ ] **Step 8: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
       packages/kagi-sidecar/src/browser-service.test.ts \
       packages/kagi-sidecar/src/browser-service.openNewTab.test.ts
git commit -m "feat(kagi): rewrite KagiBrowserService skeleton on patchright

Adds singleton browser lifecycle: launch() opens a persistent context
with options.userDataDir, openNewTab() closes the old page after
the new one is ready, close() resets isLoginVerified /
hasServedFirstRequest flags. translate() still throws — implemented
in Task 10 once login verify is in place."
```

---

## Task 9: Add boot-time session cookie inject + `verifyLoginSuccess`

**Goal:** Add the one-time login verification that the sidecar calls from `index.ts` at boot. Failure here must propagate so `index.ts` can `process.exit(1)`.

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`

- [ ] **Step 1: Add a test for `verifyStartupSession()` — happy path**

Append this to `browser-service.test.ts` (keep the existing `describe` block above):

```typescript
describe('KagiBrowserService.verifyStartupSession', () => {
  it('sets isLoginVerified=true when /settings renders the logout link', async () => {
    const pages: Page[] = []
    const context = {
      pages: () => pages,
      newPage: async () => {
        const page = fakeAuthenticatedPage()
        pages.push(page)
        return page
      },
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    function fakeAuthenticatedPage(): Page {
      return {
        url: () => 'https://kagi.com/settings',
        goto: async () => null,
        evaluate: async (_fn: unknown, selectors: unknown) => {
          // Simulate an authenticated DOM
          return { hasLogout: true, hasSigninEmail: false, hasSigninQr: false }
        },
      } as unknown as Page
    }

    pages.push(fakeAuthenticatedPage())

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()
    await service.verifyStartupSession()

    expect(service.getHealthSnapshot().ready).toBe(true)
  })

  it('throws KagiSidecarError(UI_INTERACTION) when /settings shows the signin DOM', async () => {
    function fakeUnauthenticatedPage(): Page {
      return {
        url: () => 'https://kagi.com/settings',
        goto: async () => null,
        evaluate: async () => ({ hasLogout: false, hasSigninEmail: true, hasSigninQr: false }),
      } as unknown as Page
    }

    const pages: Page[] = [fakeUnauthenticatedPage()]
    const context = {
      pages: () => pages,
      newPage: async () => fakeUnauthenticatedPage(),
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
    })
    await service.launch()

    await expect(service.verifyStartupSession()).rejects.toBeInstanceOf(KagiSidecarError)
    expect(service.getHealthSnapshot().ready).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: FAIL on `service.verifyStartupSession is not a function`.

- [ ] **Step 3: Implement `verifyStartupSession` in `browser-service.ts`**

Add this method to `KagiBrowserService`. Also add a private helper `resolveKagiSessionFilePath` that matches the PoC (see `nghien_cuu_cua_toi/src/services/browser.service.ts:150-168`) — copy its body verbatim, swap `process.env[KAGI_SESSION_FILE_ENV]` to read from `this.options.sessionFile ?? process.env[KAGI_SESSION_FILE_ENV]`:

```typescript
  async verifyStartupSession(): Promise<void> {
    if (this.connection === null) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        'verifyStartupSession called before launch',
        { status: 500 },
      )
    }

    const context = this.connection.getContext()
    const page = this.connection.getPage()

    // 1) Optional cookie injection
    const sessionFilePath = this.resolveKagiSessionFilePath()
    if (sessionFilePath !== undefined && existsSync(sessionFilePath)) {
      const { visitKagiOriginAndInjectSessionCookies } = await import('./utils/kagi-session-cookies.js')
      await visitKagiOriginAndInjectSessionCookies(page, context, {
        sessionFilePath,
        timeoutMs: BROWSER_CONFIG.TIMEOUT,
        defaultOriginUrl: KAGI_ORIGIN_URL,
      })
    }

    // 2) Hit /settings and read DOM
    const settingsUrl = 'https://kagi.com/settings'
    try {
      await page.goto(settingsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: BROWSER_CONFIG.TIMEOUT,
      })
    } catch (error) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        { status: 502, cause: error },
      )
    }

    const currentUrl = page.url()
    if (!currentUrl.startsWith(settingsUrl)) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — redirected away from /settings to ${currentUrl}`,
        { status: 502 },
      )
    }

    const state = (await page.evaluate(
      (selectors: { loggedIn: string; signinEmail: string; signinQr: string }) => ({
        hasLogout: document.querySelector(selectors.loggedIn) !== null,
        hasSigninEmail: document.querySelector(selectors.signinEmail) !== null,
        hasSigninQr: document.querySelector(selectors.signinQr) !== null,
      }),
      {
        loggedIn: KAGI_SELECTORS.LOGGED_IN_INDICATOR,
        signinEmail: KAGI_SELECTORS.SIGNIN_EMAIL_INPUT,
        signinQr: KAGI_SELECTORS.SIGNIN_QR_AUTH,
      },
    )) as { hasLogout: boolean; hasSigninEmail: boolean; hasSigninQr: boolean }

    if (state.hasSigninEmail || state.hasSigninQr) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — signin DOM present at ${currentUrl}`,
        { status: 502 },
      )
    }
    if (!state.hasLogout) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        `Login verify failed — logout link absent at ${currentUrl}`,
        { status: 502 },
      )
    }

    this.isLoginVerified = true
  }

  private resolveKagiSessionFilePath(): string | undefined {
    const fromOptions = this.options.sessionFile?.trim()
    if (fromOptions !== undefined && fromOptions !== '') return fromOptions
    const fromEnv = process.env[KAGI_SESSION_FILE_ENV]?.trim()
    if (fromEnv !== undefined && fromEnv !== '') return fromEnv

    const candidates = [
      join(process.cwd(), 'secrets', KAGI_SESSION_FILE_NAME),
      join('/app', 'secrets', KAGI_SESSION_FILE_NAME),
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return undefined
  }
```

- [ ] **Step 4: Run the tests — they should pass**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: PASS (5 tests in browser-service, 2 in browser-service.openNewTab).

- [ ] **Step 5: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
       packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "feat(kagi): add boot-time login verify + session cookie inject

verifyStartupSession() resolves the session file (env override, then
./secrets/<name>, then /app/secrets/<name>), injects cookies via the
ported kagi-session-cookies helper, navigates kagi.com/settings, and
fails fast when the DOM shows a signin form or no logout link.
Sets isLoginVerified=true on success; getHealthSnapshot reports
ready only when connection is up AND login verified."
```

---

## Task 10: Implement `translate()` — two-phase UI flow

**Goal:** Bring the existing two-phase translate flow (already working in the puppeteer-based sidecar) onto patchright. Reuse the PoC's primitives as private methods.

**Files:**

- Modify: `packages/kagi-sidecar/src/browser-service.ts`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`

- [ ] **Step 1: Write the happy-path test**

Append to `browser-service.test.ts`:

```typescript
describe('KagiBrowserService.translate', () => {
  it('runs the two-phase flow and returns translated text + final url', async () => {
    const pages: Page[] = []

    function fakePage(): Page {
      let currentUrl = 'https://translate.kagi.com/?from=auto&to=vi&text=xin%20chao'
      return {
        url: () => currentUrl,
        goto: async (url: string) => {
          currentUrl = url
          return null
        },
        evaluate: async (fn: unknown, payload: unknown) => {
          // HumanInteraction helpers call evaluate for rect / value readings.
          // For this happy-path test, return benign shapes.
          if (typeof fn === 'function') return {} as any
          return {}
        },
        waitForFunction: async () => ({ jsonValue: async () => 'ready' }) as any,
        waitForSelector: async () => null,
        focus: async () => undefined,
        click: async () => undefined,
        keyboard: {
          press: async () => undefined,
          down: async () => undefined,
          up: async () => undefined,
        } as Page['keyboard'],
        mouse: {
          click: async () => undefined,
          move: async () => undefined,
          down: async () => undefined,
          up: async () => undefined,
        } as Page['mouse'],
        locator: () =>
          ({
            first: () => ({
              scrollIntoViewIfNeeded: async () => undefined,
              pressSequentially: async () => undefined,
              fill: async () => undefined,
            }),
          }) as any,
      } as unknown as Page
    }

    const page = fakePage()
    pages.push(page)
    const context = {
      pages: () => pages,
      newPage: async () => page,
      close: async () => undefined,
      addCookies: async () => undefined,
    } as unknown as BrowserContext

    const fakeHumanInteraction = {
      click: async () => undefined,
      clickByTextContent: async () => undefined,
      typeIntoTextarea: async () => undefined,
      typeIntoContentEditable: async () => undefined,
      dragSlider: async () => undefined,
      chunkPaste: async () => undefined,
    }

    const service = new KagiBrowserService({
      launchContext: async () => context,
      ensureUserDataDir: async () => undefined,
      humanInteraction: fakeHumanInteraction,
      sleep: async () => undefined, // skip all pacing delays in tests
    })

    // Stub verifyStartupSession for this test — it is covered by its own suite.
    await service.launch()
    // @ts-expect-error — set a private flag for the happy-path
    service['isLoginVerified'] = true

    // Stub scrape to return deterministic text
    ;(service as unknown as { scrapeTranslatedText: () => Promise<string> }).scrapeTranslatedText =
      async () => 'Xin chào'

    const result = await service.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chào')
    expect(result.finalUrl).toContain('translate.kagi.com')
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: FAIL on the placeholder `translate not implemented yet`.

- [ ] **Step 3: Port the PoC `translate()` body into `browser-service.ts`**

Replace the placeholder `translate()` with the full two-phase implementation. Base it on `nghien_cuu_cua_toi/src/services/browser.service.ts:255-422` (the `translate` method) plus the helpers it calls (`clearSourceTextInput`, `fillSourceTextInput`, `clickTranslationSettingsButton`, `dismissTranslationSettingsDialog`, `clickTranslationStyleOption`, `clickSpeakerGenderOption`, `clickAddresseeGenderOption`, `setReadingLevel`, `verifyReadingLevelInAddressBar`, `clickFormalityOption`, `verifyFormalityInAddressBar`, `fillTranslationContext`, `waitForCloudflareReady`, `waitForTranslationOutputStable`, `scrapeTranslatedText`, `humanDelayBeforeNavigate`, `delayMs`).

Differences from PoC:

1. The entry point receives `KagiTranslateUiRequest` (not a URL and `TranslationOptions`). Derive the style via `preset = KAGI_STYLE_PRESETS[request.style]`, and use preset.readingLevel / preset.formality / preset.translationType / preset.speakerGender and addresseeGender (defaults `'unknown'`).
2. Build the nav URL directly: `const navUrl = 'https://translate.kagi.com/?from=auto&to=vi'`.
3. Short-circuit: the first request after boot reuses `this.connection.getPage()` via the flag `this.hasServedFirstRequest`. Subsequent requests call `await this.openNewTab()` before fetching the page.
4. Before any UI interaction assert `this.isLoginVerified === true`; if not, throw `KagiSidecarError('UI_INTERACTION', 'translate called before verifyStartupSession', { status: 500 })`.
5. On any `Target page, context or browser has been closed` substring in the caught error, re-throw a fresh `KagiSidecarError('UI_INTERACTION', ...)` with a `cause` so `index.ts` can detect and exit.
6. Use `BROWSER_CONFIG.*` keys throughout instead of `KAGI_TIMING.*`.
7. Error wrapping: every UI interaction failure becomes `KagiSidecarError('UI_INTERACTION', msg, { status: 502, cause })`. Preserve the PoC's `ANTI_ABUSE` detection (`detectVerificationRequirement`) but under the patchright `Page` type.

Copy the private helpers from the PoC, adjust imports, and wire them into `translate()`. The file will end up ~700–800 lines; this is the single largest task in the migration. **Take your time, port one helper at a time, and re-run the failing test after each helper to watch green lights accumulate.**

After all helpers are in place the `translate()` method should read top-to-bottom like:

```typescript
  async translate(request: KagiTranslateUiRequest): Promise<TranslateResult> {
    if (this.connection === null) {
      throw new KagiSidecarError('UI_INTERACTION', 'translate called before launch', { status: 500 })
    }
    if (!this.isLoginVerified) {
      throw new KagiSidecarError(
        'UI_INTERACTION',
        'translate called before verifyStartupSession',
        { status: 500 },
      )
    }

    if (this.hasServedFirstRequest) {
      await this.openNewTab()
    } else {
      this.hasServedFirstRequest = true
    }

    const page = this.connection.getPage()
    const preset = KAGI_STYLE_PRESETS[request.style]
    const clampedText = clampInputText(request.text)
    const charCount = clampedText.length
    const navUrl = 'https://translate.kagi.com/?from=auto&to=vi'

    try {
      await this.humanDelayBeforeNavigate(navUrl)
      await page.goto(navUrl, { waitUntil: 'networkidle', timeout: BROWSER_CONFIG.TIMEOUT })
      await this.waitForCloudflareReady(page)

      await this.clearSourceTextInput(page)
      await this.fillSourceTextInput(page, clampedText, charCount)

      await this.clickTranslationSettingsButton(page)

      // PHASE 1: baseline reset
      await this.clearTranslationContext(page)
      await this.clickSpeakerGenderOption(page, SPEAKER_GENDER_UI_LABELS.UNKNOWN)
      await this.clickAddresseeGenderOption(page, ADDRESSEE_GENDER_UI_LABELS.UNKNOWN)
      await this.setReadingLevel(page, 'standard')
      await this.clickTranslationStyleOption(page, TRANSLATION_STYLE_UI_LABELS.NATURAL)

      // PHASE 2: apply target settings
      if (request.context !== undefined && request.context.trim() !== '') {
        await this.fillTranslationContext(page, request.context)
        await this.options.sleep(computeScaledDelay(BROWSER_CONFIG.CONTEXT_URL_SETTLE_MS, charCount))
      }
      if (preset.readingLevel !== 'standard') {
        await this.setReadingLevel(page, preset.readingLevel)
        await this.verifyReadingLevelInAddressBar(page, preset.readingLevel)
      }
      if (preset.translationType !== 'natural') {
        await this.clickTranslationStyleOption(page, TRANSLATION_STYLE_UI_LABELS.LITERAL)
      }
      if (preset.formality !== 'standard') {
        const formalityLabel =
          preset.formality === 'vietnamese_formal'
            ? FORMALITY_UI_LABELS.VIETNAMESE_FORMAL
            : FORMALITY_UI_LABELS.VIETNAMESE_CASUAL
        await this.clickFormalityOption(page, formalityLabel)
        const formalityValue = preset.formality === 'vietnamese_formal' ? 'more' : 'less'
        const formalityContext = preset.formality === 'vietnamese_formal' ? 'vi_formal' : 'vi_casual'
        await this.verifyFormalityInAddressBar(page, formalityValue, formalityContext)
      }

      await this.waitForTranslationOutputStable(page, charCount)
      const finalUrl = page.url()
      const translated = await this.scrapeTranslatedText(page)
      if (translated === '' || translated.includes('[No translation result found')) {
        throw new KagiSidecarError('INVALID_RESPONSE', 'Kagi returned empty translation', { status: 502 })
      }

      return { translated, finalUrl }
    } catch (error) {
      if (error instanceof KagiSidecarError) throw error
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('Target page, context or browser has been closed')) {
        throw new KagiSidecarError('UI_INTERACTION', `Browser died mid-translate: ${msg}`, {
          status: 502,
          cause: error,
        })
      }
      throw new KagiSidecarError('UI_INTERACTION', `translate flow failed: ${msg}`, {
        status: 502,
        cause: error,
      })
    }
  }
```

Each of the private helpers (`humanDelayBeforeNavigate`, `waitForCloudflareReady`, `clearSourceTextInput`, `fillSourceTextInput`, `clickTranslationSettingsButton`, `clearTranslationContext`, `clickSpeakerGenderOption`, `clickAddresseeGenderOption`, `setReadingLevel`, `verifyReadingLevelInAddressBar`, `clickTranslationStyleOption`, `clickFormalityOption`, `verifyFormalityInAddressBar`, `fillTranslationContext`, `waitForTranslationOutputStable`, `scrapeTranslatedText`, `dismissTranslationSettingsDialog`, `detectVerificationRequirement`) is a direct port from `nghien_cuu_cua_toi/src/services/browser.service.ts`. Adjust each for:

- Error class: `BrowserAutomationError` → `KagiSidecarError('UI_INTERACTION', ...)`
- Config: `BROWSER_CONFIG.*` (already imported)
- Humanizer: `this.humanInteraction.*` (injected)

Do NOT skip `detectVerificationRequirement` — it is the anti-abuse detector that returns `KagiSidecarError('ANTI_ABUSE', 429)`. Call it from `waitForTranslationOutputStable` (same pattern as the current puppeteer-based service uses it).

Add these imports at the top of `browser-service.ts`:

```typescript
import {
  ADDRESSEE_GENDER_UI_LABELS,
  FORMALITY_UI_LABELS,
  SPEAKER_GENDER_UI_LABELS,
  TRANSLATION_STYLE_UI_LABELS,
  getReadingLevelSliderValue,
  type ReadingLevel,
} from './constants/kagi-ui.js'
```

- [ ] **Step 4: Run `browser-service.test.ts`**

Run: `bun test packages/kagi-sidecar/src/browser-service.test.ts`
Expected: all tests pass. If any assertion about `page.evaluate` shape fails, relax the happy-path test's `evaluate` mock to return `{ hasLogout: true }` when called with the login-check selector payload — your test doubles are free to be more specific.

- [ ] **Step 5: Run the full package**

Run: `bun run --cwd packages/kagi-sidecar typecheck && bun test packages/kagi-sidecar/`
Expected: all tests pass, typecheck green.

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/browser-service.ts \
       packages/kagi-sidecar/src/browser-service.test.ts
git commit -m "feat(kagi): port two-phase translate flow to patchright

Implements KagiBrowserService.translate with the full
navigate → Cloudflare-ready → fill → settings-dialog → phase-1
baseline reset → phase-2 target apply → stabilize → scrape flow
from the PoC. Preserves anti-abuse detection and URL verifications.
Reuses connection page on first request, opens a new tab on
subsequent requests, and closes the previous tab each time."
```

---

## Task 11: Update `runtime-config.ts` with new env vars

**Goal:** Expose `USER_DATA_DIR`, `KAGI_SESSION_FILE`, `KAGI_HEADLESS` so `index.ts` can hand them to `KagiBrowserService`.

**Files:**

- Modify: `packages/kagi-sidecar/src/runtime-config.ts`
- Modify: `packages/kagi-sidecar/src/runtime-config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `runtime-config.test.ts`:

```typescript
describe('runtime-config new env vars', () => {
  it('resolves USER_DATA_DIR, KAGI_SESSION_FILE, KAGI_HEADLESS', () => {
    const config = resolveKagiRuntimeConfig({
      USER_DATA_DIR: '/tmp/kagi-user-data',
      KAGI_SESSION_FILE: '/app/secrets/kagi.com_16-04-2026.json',
      KAGI_HEADLESS: 'true',
    } as NodeJS.ProcessEnv)

    expect(config.browser.userDataDir).toBe('/tmp/kagi-user-data')
    expect(config.browser.sessionFile).toBe('/app/secrets/kagi.com_16-04-2026.json')
    expect(config.browser.headless).toBe(true)
  })

  it('defaults userDataDir to cwd()/user-data and headless to false when env unset', () => {
    const config = resolveKagiRuntimeConfig({} as NodeJS.ProcessEnv)
    expect(config.browser.userDataDir.endsWith('user-data')).toBe(true)
    expect(config.browser.sessionFile).toBeUndefined()
    expect(config.browser.headless).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test (fails — new fields are missing)**

Run: `bun test packages/kagi-sidecar/src/runtime-config.test.ts`
Expected: FAIL on `config.browser.userDataDir` undefined.

- [ ] **Step 3: Extend `runtime-config.ts`**

Update the `Pick` of `KagiBrowserServiceOptions` to include the new keys and add parsing logic:

```typescript
import { join } from 'node:path'
import type { KagiBrowserServiceOptions } from './browser-service'

export interface KagiRuntimeConfig {
  port: number
  browser: Pick<
    KagiBrowserServiceOptions,
    | 'maxQueueDepth'
    | 'maxQueueWaitMs'
    | 'maxRetries'
    | 'minIntervalMs'
    | 'requestTimeoutMs'
    | 'retryBaseMs'
    | 'userDataDir'
    | 'headless'
    | 'sessionFile'
  >
}

function parsePositiveInteger(
  input: string | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (input === undefined || input.trim() === '') return fallback
  const parsed = Number.parseInt(input, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`)
  }
  return parsed
}

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined) return fallback
  const normalized = input.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0' || normalized === '') return false
  return fallback
}

export function resolveKagiRuntimeConfig(input: NodeJS.ProcessEnv): KagiRuntimeConfig {
  const userDataDirRaw = input['USER_DATA_DIR']?.trim()
  const sessionFileRaw = input['KAGI_SESSION_FILE']?.trim()

  return {
    port: parsePositiveInteger(input['KAGI_PORT'], 'KAGI_PORT', 3002),
    browser: {
      minIntervalMs: parsePositiveInteger(
        input['KAGI_MIN_INTERVAL_MS'],
        'KAGI_MIN_INTERVAL_MS',
        1_500,
      ),
      maxRetries: parsePositiveInteger(input['KAGI_MAX_RETRIES'], 'KAGI_MAX_RETRIES', 2),
      retryBaseMs: parsePositiveInteger(input['KAGI_RETRY_BASE_MS'], 'KAGI_RETRY_BASE_MS', 1_000),
      requestTimeoutMs: parsePositiveInteger(
        input['KAGI_REQUEST_TIMEOUT_MS'],
        'KAGI_REQUEST_TIMEOUT_MS',
        120_000,
      ),
      maxQueueDepth: parsePositiveInteger(
        input['KAGI_MAX_QUEUE_DEPTH'],
        'KAGI_MAX_QUEUE_DEPTH',
        10,
      ),
      maxQueueWaitMs: parsePositiveInteger(
        input['KAGI_MAX_QUEUE_WAIT_MS'],
        'KAGI_MAX_QUEUE_WAIT_MS',
        15_000,
      ),
      userDataDir:
        userDataDirRaw !== undefined && userDataDirRaw !== ''
          ? userDataDirRaw
          : join(process.cwd(), 'user-data'),
      headless: parseBoolean(input['KAGI_HEADLESS'], false),
      ...(sessionFileRaw !== undefined && sessionFileRaw !== ''
        ? { sessionFile: sessionFileRaw }
        : {}),
    },
  }
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `bun test packages/kagi-sidecar/src/runtime-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kagi-sidecar/src/runtime-config.ts \
       packages/kagi-sidecar/src/runtime-config.test.ts
git commit -m "feat(kagi): parse USER_DATA_DIR, KAGI_SESSION_FILE, KAGI_HEADLESS

Extends KagiRuntimeConfig.browser so the boot code in index.ts
can hand user-data / session-file / headless overrides into
KagiBrowserService. Defaults: userDataDir=cwd()/user-data,
headless=false, sessionFile undefined (automatic lookup)."
```

---

## Task 12: Make `index.ts` eager-launch + graceful-shutdown

**Goal:** Before Elysia listens, launch the browser and verify the login session. Any failure exits with code 1. Add SIGTERM/SIGINT handlers that drain the queue and close the browser.

**Files:**

- Rewrite: `packages/kagi-sidecar/src/index.ts`

- [ ] **Step 1: Replace `index.ts`**

```typescript
export * from './browser-service'
export * from './runtime-config'
export * from './server'

import { KagiBrowserService } from './browser-service'
import { resolveKagiRuntimeConfig } from './runtime-config'
import { createKagiServer } from './server'

async function main(): Promise<void> {
  const config = resolveKagiRuntimeConfig(process.env)
  const service = new KagiBrowserService(config.browser)

  try {
    await service.launch()
    await service.verifyStartupSession()
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'kagi-sidecar',
        event: 'boot_failed',
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
    await service.close().catch(() => undefined)
    process.exit(1)
  }

  const app = createKagiServer({ service })
  const server = app.listen(config.port)

  async function shutdown(signal: string): Promise<void> {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'kagi-sidecar',
        event: 'shutdown_started',
        timestamp: new Date().toISOString(),
        signal,
      }),
    )
    try {
      await (server as unknown as { stop?: () => Promise<void> | void }).stop?.()
    } catch {
      // best-effort; Elysia versions differ
    }
    await service.close().catch(() => undefined)
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'kagi-sidecar',
        event: 'shutdown_complete',
        timestamp: new Date().toISOString(),
      }),
    )
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'kagi-sidecar',
      event: 'kagi_sidecar_started',
      timestamp: new Date().toISOString(),
      port: config.port,
    }),
  )
}

if (import.meta.main) {
  void main()
}
```

- [ ] **Step 2: typecheck**

Run: `bun run --cwd packages/kagi-sidecar typecheck`
Expected: PASS.

- [ ] **Step 3: Manual boot smoke (happy path, optional)**

Only run this if you already have a valid cookie file at `./secrets/kagi.com_16-04-2026.json`. Otherwise skip — Task 16 handles the file clone.

```bash
cd packages/kagi-sidecar
KAGI_PORT=3099 bun run src/index.ts &
PID=$!
sleep 45  # give Chromium time to launch and verify
curl -s http://localhost:3099/health
kill $PID
```

Expected: `{"ok":true,"ready":true,"activeCount":0,"queuedCount":0}` and clean shutdown logs.

- [ ] **Step 4: Commit**

```bash
git add packages/kagi-sidecar/src/index.ts
git commit -m "feat(kagi): eager-launch browser + verify login before listen

index.ts now awaits launch() + verifyStartupSession() before Elysia
binds the port. Any boot failure logs a structured error and calls
process.exit(1) so the container orchestrator restarts the sidecar.
Adds SIGTERM/SIGINT handlers that stop the server, close the
browser, and exit 0."
```

---

## Task 13: Keep `server.ts` in sync with the new service API

**Goal:** Make `/health` surface `ready` from the service (which now means both connection-alive AND login-verified). Validate that `/translate` still matches `KagiClient.translate()` contract.

**Files:**

- Modify: `packages/kagi-sidecar/src/server.ts`
- Modify: `packages/kagi-sidecar/src/server.test.ts`

- [ ] **Step 1: Update `/health` body**

Open `packages/kagi-sidecar/src/server.ts`. The handler currently returns `{ ok: true, ...snapshot }`. The new snapshot's `ready` is already accurate — no semantic change needed. Ensure the block reads:

```typescript
.get('/health', () => {
  const snapshot = service.getHealthSnapshot()
  return { ok: snapshot.ready, ...snapshot }
})
```

- [ ] **Step 2: Update `/translate` to pass the new `KagiTranslateUiRequest`**

The current handler calls `service.translate({ text, style, context })` which matches the old method signature (`KagiTranslateRequest`). The new `KagiBrowserService.translate` takes `KagiTranslateUiRequest` with the same three fields — no caller change needed, but update the TypeScript type used in `KagiTranslationService`:

Change the `translate` signature on the exported `KagiTranslationService` interface to accept `KagiTranslateRequest` (the DTO kept in `browser-service.ts`) and still return `KagiTranslationResult`. Already aligned — re-read `server.ts` to confirm nothing needs to move.

- [ ] **Step 3: Add a health-flapping test**

Append to `server.test.ts`:

```typescript
it('/health returns ok=false until the service reports ready=true', async () => {
  const service: KagiTranslationService = {
    async translate() {
      throw new KagiSidecarError('UI_INTERACTION', 'unused in this test', { status: 502 })
    },
    getHealthSnapshot: () => ({ ready: false, activeCount: 0, queuedCount: 0 }),
  }
  const app = createKagiServer({ service, logger: silentLogger })
  const res = await app.handle(new Request('http://test/health'))
  const body = (await res.json()) as { ok: boolean; ready: boolean }
  expect(body.ok).toBe(false)
  expect(body.ready).toBe(false)
})
```

(Reuse `silentLogger` from the existing test file; if it doesn't exist, create a local `silentLogger` that no-ops all methods.)

- [ ] **Step 4: Run server tests**

Run: `bun test packages/kagi-sidecar/src/server.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/kagi-sidecar/src/server.ts packages/kagi-sidecar/src/server.test.ts
git commit -m "feat(kagi): /health ok mirrors ready from snapshot

Now /health returns ok=false when the singleton browser is not
ready (pre-verify or after a crash). Container orchestrators can
rely on this check instead of just TCP connect."
```

---

## Task 14: Update the kagi-sidecar Dockerfile for patchright

**Goal:** Install the system deps patchright Chromium needs (fonts, libs) and drop puppeteer-specific setup.

**Files:**

- Modify: `packages/kagi-sidecar/Dockerfile` (path may differ — verify actual location first)
- Reference: `nghien_cuu_cua_toi/Dockerfile`

- [ ] **Step 1: Find the existing Dockerfile**

Run: `ls packages/kagi-sidecar/Dockerfile 2>&1 || ls Dockerfile 2>&1`
Use the path that exists.

- [ ] **Step 2: Diff PoC Dockerfile against the sidecar's**

Run: `diff -u nghien_cuu_cua_toi/Dockerfile packages/kagi-sidecar/Dockerfile || true`
(If the sidecar's Dockerfile is at repo root, adjust the path.)

Read the diff carefully. The PoC's Dockerfile is the known-good recipe for patchright + Xvfb + fonts. The production sidecar's Dockerfile likely still installs puppeteer-specific apt packages.

- [ ] **Step 3: Bring PoC patchright setup into the sidecar Dockerfile**

Replace the apt install layer, any puppeteer cache / user setup, and the browser-install command with the patchright equivalents from PoC. Typical changes:

- Replace `RUN bunx puppeteer browsers install chrome` with `RUN bunx patchright install chromium`
- Keep `RUN apt-get install -y ... fonts-liberation libnss3 libatk-bridge2.0-0 libx11-xcb1 libxcomposite1 libxrandr2 libasound2 libpangocairo-1.0-0 libcups2 libatspi2.0-0 libgtk-3-0 libxshmfence1 xvfb ...` (mirror PoC's package list exactly)
- Keep the non-root user block and permissions
- Ensure `WORKDIR` and the COPY layers stay consistent with the monorepo layout (the sidecar Dockerfile copies from `packages/kagi-sidecar/` and `packages/provider-kagi/`)

Do not merge `nghien_cuu_cua_toi/Dockerfile` verbatim — the monorepo has its own workspace layout. Port the apt install + browser install only.

- [ ] **Step 4: Build locally**

Run: `docker compose build kagi-sidecar` (if the service is named differently, substitute).
Expected: build succeeds; no error about missing system libs.

- [ ] **Step 5: Commit**

```bash
git add packages/kagi-sidecar/Dockerfile # or the actual path
git commit -m "chore(kagi): Dockerfile installs patchright Chromium deps

Drops puppeteer-real-browser installation and switches to
bunx patchright install chromium with the same apt package list
the PoC Dockerfile uses (fonts-liberation, libnss3, xvfb, etc.)."
```

---

## Task 15: Update `docker-compose.yml` for persistent profile + secrets

**Goal:** Mount `./secrets` and `./user-data` into the kagi-sidecar container, expose the new env vars, align the restart/shutdown policy.

**Files:**

- Modify: repo-root `docker-compose.yml`

- [ ] **Step 1: Open `docker-compose.yml` and locate the kagi-sidecar service**

Find the service block. Today it probably has no volumes and no KAGI_SESSION_FILE env.

- [ ] **Step 2: Add volumes and env vars**

Under the `kagi-sidecar` service add (or merge with existing) these blocks:

```yaml
volumes:
  - ./secrets:/app/secrets:ro
  - ./user-data:/app/user-data
environment:
  KAGI_SESSION_FILE: /app/secrets/kagi.com_16-04-2026.json
  USER_DATA_DIR: /app/user-data
  KAGI_HEADLESS: 'false'
restart: on-failure:3
stop_grace_period: 125s
```

Keep existing env vars (port, queue knobs) intact. If `restart` and `stop_grace_period` are already set, overwrite the values to `on-failure:3` and `125s` respectively.

- [ ] **Step 3: Validate compose file**

Run: `docker compose config`
Expected: no syntax errors; all env / volume entries appear in the merged config.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(repo): kagi-sidecar persistent profile + secrets mount

Mounts ./secrets (read-only) and ./user-data on the sidecar
container so the session-cookie file and persistent Chrome profile
survive container restarts. Sets restart=on-failure:3 and
stop_grace_period=125s to align with KAGI_REQUEST_TIMEOUT_MS=120s."
```

---

## Task 16: Clone PoC secrets into repo-root `./secrets` and harden `.dockerignore`

**Goal:** Implement DEC-007 — isolated-but-initially-identical cookie copy between PoC and production.

**Files:**

- Create: `./secrets/kagi.com_16-04-2026.json`
- Modify: `.dockerignore`
- Verify: `.gitignore` already has `secrets/` (it does)

- [ ] **Step 1: Clone the cookie file**

```bash
mkdir -p secrets
cp nghien_cuu_cua_toi/secrets/kagi.com_16-04-2026.json secrets/kagi.com_16-04-2026.json
```

- [ ] **Step 2: Verify git ignores it**

Run: `git status --short`
Expected: `secrets/kagi.com_16-04-2026.json` is NOT listed (gitignore pattern `secrets/` filters it).

If it shows up, run `git check-ignore -v secrets/kagi.com_16-04-2026.json` to diagnose, and stop — do not commit secrets into git.

- [ ] **Step 3: Update repo-root `.dockerignore`**

Append `secrets/` to `.dockerignore`. The file becomes:

```
node_modules/
dist/
.git/
.husky/
.env
.env.local
*.log
.DS_Store
README.md
secrets/
```

- [ ] **Step 4: Verify `docker build` context excludes secrets**

Run: `docker compose build kagi-sidecar 2>&1 | grep -i 'secrets' || echo 'not referenced in build context'`
Expected: `not referenced in build context`. The mount in Task 15 is the only runtime path for the cookie file.

- [ ] **Step 5: Commit `.dockerignore` only (cookie file is gitignored)**

```bash
git add .dockerignore
git commit -m "chore(repo): exclude secrets/ from docker build context

Prevents kagi.com_*.json cookie files from being baked into
image layers. Runtime access is via the bind-mount declared in
docker-compose.yml."
```

---

## Task 17: Cleanup — grep verify removed deps, run full DoD

**Goal:** Prove the three old libraries are gone and the whole monorepo is green.

**Files:** none touched; verification only.

- [ ] **Step 1: Grep for banned imports**

Run:

```bash
grep -R "puppeteer-real-browser\|@forad/puppeteer-humanize\|ghost-cursor" \
  packages/ scripts/ 2>&1 | grep -v "^Binary" || echo 'clean'
```

Expected: `clean`. If anything matches, delete the import and the code that uses it; commit the removal as a follow-up step.

- [ ] **Step 2: Full DoD**

Run: `bun test && bun run typecheck && bun run lint`
Expected: all three commands exit 0. Fix any failure before moving on — that is a blocker.

- [ ] **Step 3: Commit (only if grep / lint uncovered untracked cleanups)**

If there was nothing to change, skip the commit. Otherwise:

```bash
git add -A
git commit -m "chore(kagi): remove last references to puppeteer-real-browser stack

Final sweep after the patchright migration."
```

---

## Task 18: Manual smoke tests (live Kagi)

**Goal:** Confirm the migrated sidecar works end-to-end against the real Kagi service.

**Files:** none; runtime tests only.

- [ ] **Step 1: Start the stack**

```bash
docker compose up --build kagi-sidecar
```

Expected: container logs `kagi_sidecar_started` and does NOT log `boot_failed`. If `boot_failed`, check cookie file path and validity.

- [ ] **Step 2: Health check**

In another terminal:

```bash
curl -s http://localhost:3002/health
```

Expected: `{"ok":true,"ready":true,"activeCount":0,"queuedCount":0}` (adjust port if yours differs).

- [ ] **Step 3: Single translate**

```bash
curl -s -X POST http://localhost:3002/translate \
  -H 'content-type: application/json' \
  -d '{"text":"Xin chào","style":"Clear"}'
```

Expected: `{"translated":"<Vietnamese translation>"}` within ~40 seconds for the first request, faster for subsequent calls.

- [ ] **Step 4: Five-in-a-row**

```bash
for i in 1 2 3 4 5; do
  echo "--- $i ---"
  curl -s -X POST http://localhost:3002/translate \
    -H 'content-type: application/json' \
    -d "{\"text\":\"message number $i\",\"style\":\"Clear\"}"
  echo
done
```

Expected: five JSON responses, each with a distinct translation. Watch the sidecar logs — you should see exactly ONE `launch` event, FOUR `openNewTab` events (messages 2–5), and no `relaunch`/`boot_failed` events.

- [ ] **Step 5: Translator integration**

If you have a staging translator pointed at this sidecar, post a Chatwork-style message through its usual channel and verify a Vietnamese reply lands in the target room. Record any anomalies in an issue — out-of-scope fixes land in separate PRs.

- [ ] **Step 6: Stop the stack**

```bash
docker compose down
```

Expected: clean shutdown; logs show `shutdown_complete` on the sidecar.

- [ ] **Step 7: Commit (runbook update, if any)**

If any manual step revealed an issue worth documenting in a README or runbook, commit those docs now. Otherwise, no commit — Task 18 is verification.

---

## Self-review checklist (already completed)

**Spec coverage:**

- DEC-001 covered across Tasks 1–13 (full port)
- DEC-002 covered by Tasks 8 (singleton) + 10 (openNewTab in translate)
- DEC-003 covered by Tasks 4 (constants), 9 (session inject + verify), 11 (env), 15 (volume mounts), 16 (cookie clone)
- DEC-004 covered by Task 7 (internal helper only) + Task 13 (server unchanged)
- DEC-005 covered by Task 12 (eager verify + exit 1)
- DEC-006 covered by preserving queueTail in Task 8 skeleton + `applyMinInterval` still wired in translate
- DEC-007 covered by Task 16 (cookie clone + .dockerignore)

**Placeholder scan:** no "TBD"/"TODO"/"similar to"/"appropriate error handling" phrases in task steps; every step has a concrete command or code block.

**Type consistency:** `KagiTranslateUiRequest` appears in Tasks 5, 7, 8, 10. `IBrowserService` appears in Tasks 5, 7, 8. `verifyStartupSession` appears in Tasks 9, 12. Flag names `isLoginVerified`, `hasServedFirstRequest` match the spec and appear in Tasks 8, 9, 10, 12.

**Scope:** 18 tasks, each self-contained; one commit per task; no task requires another to be half-done.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-kagi-sidecar-poc-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
