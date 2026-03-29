# Kagi Translate PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `experiments/kagi-poc/` — a standalone Bun + Playwright script that calls Kagi Translate anonymously via URL params, extracts the translated text from DOM, and logs it to terminal. Phase 2 hardcodes JP→VI; Phase 3 reads all settings from env vars.

**Architecture:** URL-params approach — build a Kagi Translate URL with all settings as query params, navigate with Playwright (headless Chromium), wait for `networkidle` + DOM render, extract translated text via multi-strategy selector. Phase 2 hardcodes options; Phase 3 reads from env vars and outputs JSON.

**Tech Stack:** Bun v1.1+ · TypeScript 5.4+ strict · Playwright `^1.52` (chromium) · Docker base `mcr.microsoft.com/playwright:v1.52-jammy`

**Spec:** `docs/superpowers/specs/2026-03-29-kagi-translate-poc-design.md`

---

## File Map

| File                                           | Responsibility                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `experiments/kagi-poc/package.json`            | Package config, `start` / `start:advanced` / `typecheck` scripts |
| `experiments/kagi-poc/tsconfig.json`           | Extends `../../tsconfig.base.json`                               |
| `experiments/kagi-poc/Dockerfile`              | Playwright base image + Bun install                              |
| `experiments/kagi-poc/.env.example`            | All env vars for Phase 3                                         |
| `experiments/kagi-poc/src/types.ts`            | `KagiTranslateOptions` interface                                 |
| `experiments/kagi-poc/src/url-builder.ts`      | `buildKagiUrl(options) → string` — pure function                 |
| `experiments/kagi-poc/src/url-builder.test.ts` | Unit tests for URL building                                      |
| `experiments/kagi-poc/src/extractor.ts`        | `extractTranslation(page) → string` — multi-strategy selector    |
| `experiments/kagi-poc/src/translator.ts`       | `translate(options) → string` — Playwright orchestration         |
| `experiments/kagi-poc/src/phase2-basic.ts`     | Entry: hardcode JP→VI, log to terminal                           |
| `experiments/kagi-poc/src/phase3-advanced.ts`  | Entry: all settings from env vars, JSON output                   |

---

## Task 1: Project Scaffold

**Files:**

- Create: `experiments/kagi-poc/package.json`
- Create: `experiments/kagi-poc/tsconfig.json`
- Create: `experiments/kagi-poc/Dockerfile`
- Create: `experiments/kagi-poc/.env.example`

- [ ] **Step 1: Create folder structure**

```bash
mkdir -p experiments/kagi-poc/src
```

- [ ] **Step 2: Create `experiments/kagi-poc/package.json`**

```json
{
  "name": "@chatwork-bot/kagi-poc",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun src/phase2-basic.ts",
    "start:advanced": "bun src/phase3-advanced.ts",
    "dev": "bun --hot src/phase3-advanced.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "playwright": "^1.52.0"
  }
}
```

- [ ] **Step 3: Create `experiments/kagi-poc/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `experiments/kagi-poc/Dockerfile`**

```dockerfile
# Playwright official image — Chromium + all system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.52-jammy

# Install Bun
RUN npm install -g bun

WORKDIR /app

# Copy package manifest first for layer caching
COPY package.json ./
RUN bun install

# Install Playwright's Chromium (system deps already in base image)
RUN bunx playwright install chromium

# Copy source
COPY . .

CMD ["bun", "src/phase2-basic.ts"]
```

- [ ] **Step 5: Create `experiments/kagi-poc/.env.example`**

```
TEXT=こんにちは
SOURCE_LANG=ja
TARGET_LANG=vi
STYLE=natural
FORMALITY=default
QUALITY=standard
READING_LEVEL=standard
SPEAKER_GENDER=unknown
ADDRESSEE_GENDER=unknown
CONTEXT=
PRESERVE_FORMATTING=false
```

- [ ] **Step 6: Install dependencies**

```bash
cd experiments/kagi-poc
bun install
```

Expected: `playwright` installed in `node_modules/`, `bun.lock` or `bun.lockb` created.

- [ ] **Step 7: Verify TypeScript setup**

```bash
cd experiments/kagi-poc
bun run typecheck
```

Expected: No errors (no source files yet — tsc exits cleanly with no input files or warns but doesn't error).

- [ ] **Step 8: Commit scaffold**

```bash
git add experiments/kagi-poc/
git commit -m "feat(kagi-poc): scaffold project — Bun + Playwright + Dockerfile"
```

---

## Task 2: Types + URL Builder (TDD)

**Files:**

- Create: `experiments/kagi-poc/src/types.ts`
- Create: `experiments/kagi-poc/src/url-builder.test.ts`
- Create: `experiments/kagi-poc/src/url-builder.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface KagiTranslateOptions {
  text: string
  from: string // ISO 639-1 or 'auto'
  to: string // ISO 639-1
  style?: 'natural' | 'literal'
  formality?: 'default' | 'more' | 'less'
  quality?: 'standard' | 'best'
  languageComplexity?: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  speakerGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  addresseeGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  context?: string
  preserveFormatting?: boolean
}
```

- [ ] **Step 2: Write failing tests in `src/url-builder.test.ts`**

```typescript
import { describe, it, expect } from 'bun:test'
import { buildKagiUrl } from './url-builder'

describe('buildKagiUrl', () => {
  it('builds base URL with required fields', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi' })
    expect(url).toStartWith('https://translate.kagi.com/?')
    expect(url).toContain('from=en')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=hello')
  })

  it('URL-encodes Japanese text', () => {
    const url = buildKagiUrl({ text: 'こんにちは', from: 'ja', to: 'vi' })
    expect(decodeURIComponent(url)).toContain('こんにちは')
  })

  it('includes style when provided', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', style: 'literal' })
    expect(url).toContain('style=literal')
  })

  it('does not include style when omitted', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi' })
    expect(url).not.toContain('style=')
  })

  it('includes formality when provided', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', formality: 'more' })
    expect(url).toContain('formality=more')
  })

  it('maps languageComplexity → language_complexity param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', languageComplexity: 'b2' })
    expect(url).toContain('language_complexity=b2')
  })

  it('maps speakerGender → speaker_gender param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', speakerGender: 'masculine' })
    expect(url).toContain('speaker_gender=masculine')
  })

  it('maps addresseeGender → addressee_gender param', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', addresseeGender: 'feminine' })
    expect(url).toContain('addressee_gender=feminine')
  })

  it('maps preserveFormatting → preserveFormatting param as string', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', preserveFormatting: true })
    expect(url).toContain('preserveFormatting=true')
  })

  it('does not include context when empty string', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', context: '' })
    expect(url).not.toContain('context=')
  })

  it('includes context when non-empty', () => {
    const url = buildKagiUrl({ text: 'hello', from: 'en', to: 'vi', context: 'business meeting' })
    expect(url).toContain('context=')
    expect(decodeURIComponent(url)).toContain('context=business meeting')
  })

  it('throws when text is empty string', () => {
    expect(() => buildKagiUrl({ text: '', from: 'ja', to: 'vi' })).toThrow('text must not be empty')
  })

  it('throws when text is whitespace only', () => {
    expect(() => buildKagiUrl({ text: '   ', from: 'ja', to: 'vi' })).toThrow(
      'text must not be empty',
    )
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd experiments/kagi-poc
bun test src/url-builder.test.ts
```

Expected: All tests fail with `Cannot find module './url-builder'`.

- [ ] **Step 4: Implement `src/url-builder.ts`**

```typescript
import type { KagiTranslateOptions } from './types'

const BASE_URL = 'https://translate.kagi.com/'

export function buildKagiUrl(options: KagiTranslateOptions): string {
  if (!options.text.trim()) {
    throw new Error('text must not be empty')
  }

  const params = new URLSearchParams()
  params.set('from', options.from)
  params.set('to', options.to)
  params.set('text', options.text)

  if (options.style !== undefined) params.set('style', options.style)
  if (options.formality !== undefined) params.set('formality', options.formality)
  if (options.quality !== undefined) params.set('quality', options.quality)
  if (options.languageComplexity !== undefined)
    params.set('language_complexity', options.languageComplexity)
  if (options.speakerGender !== undefined) params.set('speaker_gender', options.speakerGender)
  if (options.addresseeGender !== undefined) params.set('addressee_gender', options.addresseeGender)
  if (options.context !== undefined && options.context !== '')
    params.set('context', options.context)
  if (options.preserveFormatting !== undefined)
    params.set('preserveFormatting', String(options.preserveFormatting))

  return `${BASE_URL}?${params.toString()}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd experiments/kagi-poc
bun test src/url-builder.test.ts
```

Expected: 13 tests pass, 0 failures.

- [ ] **Step 6: Run typecheck**

```bash
cd experiments/kagi-poc
bun run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add experiments/kagi-poc/src/types.ts experiments/kagi-poc/src/url-builder.ts experiments/kagi-poc/src/url-builder.test.ts
git commit -m "feat(kagi-poc): KagiTranslateOptions type + buildKagiUrl with tests"
```

---

## Task 3: Extractor (Multi-Strategy DOM)

**Files:**

- Create: `experiments/kagi-poc/src/extractor.ts`

Kagi Translate is a SvelteKit app — its exact CSS selectors may change. This extractor tries multiple known patterns in priority order and falls back to a clear error with a debug screenshot if all fail.

- [ ] **Step 1: Create `src/extractor.ts`**

```typescript
import type { Page } from 'playwright'

// Selector strategies in priority order.
// Kagi Translate uses SvelteKit — these cover the most likely patterns.
// If all fail, we screenshot for debugging and throw a clear error.
const OUTPUT_SELECTORS = [
  '[data-testid="translation-output"]',
  '[data-testid="output"]',
  '[data-testid="translated-text"]',
  '[data-testid="translation-result"]',
  '.translation-output',
  '.output-text',
  '.translated-content',
  '[aria-label*="ranslation" i]',
  '[aria-label*="output" i]',
]

export async function extractTranslation(page: Page): Promise<string> {
  // Wait for the translation API call to complete
  await page.waitForLoadState('networkidle')
  // Buffer for JS rendering after network settles
  await page.waitForTimeout(2_000)

  for (const selector of OUTPUT_SELECTORS) {
    try {
      const locator = page.locator(selector).first()
      const isVisible = await locator.isVisible({ timeout: 1_000 })
      if (isVisible) {
        const text = (await locator.innerText()).trim()
        if (text.length > 0) return text
      }
    } catch {
      // Selector not found — try next
    }
  }

  // All strategies failed — save screenshot for diagnosis
  await page.screenshot({ path: 'debug-no-selector.png', fullPage: true }).catch(() => {})
  throw new Error(
    'Could not find translation output element. ' +
      'A screenshot was saved to debug-no-selector.png. ' +
      'Open it, inspect the output element, and add its selector to ' +
      'OUTPUT_SELECTORS in src/extractor.ts, then re-run.',
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd experiments/kagi-poc
bun run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add experiments/kagi-poc/src/extractor.ts
git commit -m "feat(kagi-poc): multi-strategy DOM extractor with fallback screenshot"
```

---

## Task 4: Translator Core

**Files:**

- Create: `experiments/kagi-poc/src/translator.ts`

- [ ] **Step 1: Create `src/translator.ts`**

```typescript
import { chromium } from 'playwright'
import type { KagiTranslateOptions } from './types'
import { buildKagiUrl } from './url-builder'
import { extractTranslation } from './extractor'

// Realistic User-Agent reduces chance of headless detection
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36'

export async function translate(options: KagiTranslateOptions): Promise<string> {
  const url = buildKagiUrl(options)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

  try {
    await page.setExtraHTTPHeaders({ 'User-Agent': USER_AGENT })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    return await extractTranslation(page)
  } catch (err) {
    await page.screenshot({ path: 'debug-error.png', fullPage: true }).catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd experiments/kagi-poc
bun run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add experiments/kagi-poc/src/translator.ts
git commit -m "feat(kagi-poc): Playwright translator core with headless Chromium"
```

---

## Task 5: Phase 2 Entry Point

**Files:**

- Create: `experiments/kagi-poc/src/phase2-basic.ts`

- [ ] **Step 1: Create `src/phase2-basic.ts`**

```typescript
import { translate } from './translator'

const TEXT = 'こんにちは、今日はいい天気ですね'

console.log(`Translating: ${TEXT}`)
console.log('From: Japanese → To: Vietnamese')
console.log('Please wait...\n')

const result = await translate({
  text: TEXT,
  from: 'ja',
  to: 'vi',
})

console.log(`Translation: ${TEXT}`)
console.log(`→ ${result}`)
```

- [ ] **Step 2: Run Phase 2 locally**

```bash
cd experiments/kagi-poc
bun start
```

Expected output:

```
Translating: こんにちは、今日はいい天気ですね
From: Japanese → To: Vietnamese
Please wait...

Translation: こんにちは、今日はいい天気ですね
→ Xin chào, hôm nay thời tiết đẹp nhỉ
```

> **If you see "Could not find translation output element":** Check `debug-no-selector.png`.
> Open the screenshot, find the element containing the Vietnamese text, copy its CSS class or `data-testid`.
> Add the selector to `OUTPUT_SELECTORS` at the top of `src/extractor.ts` and re-run.

- [ ] **Step 3: Commit**

```bash
git add experiments/kagi-poc/src/phase2-basic.ts
git commit -m "feat(kagi-poc): phase 2 — JP→VI basic translation, log to terminal"
```

---

## Task 6: Phase 3 Entry Point (All Settings via Env)

**Files:**

- Create: `experiments/kagi-poc/src/phase3-advanced.ts`

- [ ] **Step 1: Create `src/phase3-advanced.ts`**

```typescript
import { translate } from './translator'
import type { KagiTranslateOptions } from './types'

const text = process.env['TEXT']
if (!text) {
  console.error('ERROR: TEXT environment variable is required')
  process.exit(1)
}

const options: KagiTranslateOptions = {
  text,
  from: process.env['SOURCE_LANG'] ?? 'auto',
  to: process.env['TARGET_LANG'] ?? 'vi',
  ...(process.env['STYLE'] ? { style: process.env['STYLE'] as KagiTranslateOptions['style'] } : {}),
  ...(process.env['FORMALITY']
    ? { formality: process.env['FORMALITY'] as KagiTranslateOptions['formality'] }
    : {}),
  ...(process.env['QUALITY']
    ? { quality: process.env['QUALITY'] as KagiTranslateOptions['quality'] }
    : {}),
  ...(process.env['READING_LEVEL']
    ? {
        languageComplexity: process.env[
          'READING_LEVEL'
        ] as KagiTranslateOptions['languageComplexity'],
      }
    : {}),
  ...(process.env['SPEAKER_GENDER']
    ? { speakerGender: process.env['SPEAKER_GENDER'] as KagiTranslateOptions['speakerGender'] }
    : {}),
  ...(process.env['ADDRESSEE_GENDER']
    ? {
        addresseeGender: process.env['ADDRESSEE_GENDER'] as KagiTranslateOptions['addresseeGender'],
      }
    : {}),
  ...(process.env['CONTEXT'] ? { context: process.env['CONTEXT'] } : {}),
  ...(process.env['PRESERVE_FORMATTING']
    ? { preserveFormatting: process.env['PRESERVE_FORMATTING'] === 'true' }
    : {}),
}

// Log options to stderr so stdout stays clean JSON
console.error('Options:', JSON.stringify(options, null, 2))
console.error('Please wait...')

const output = await translate(options)

// Stdout: clean JSON for piping / parsing
console.log(JSON.stringify({ input: text, output, options }, null, 2))
```

- [ ] **Step 2: Verify typecheck**

```bash
cd experiments/kagi-poc
bun run typecheck
```

Expected: No errors.

- [ ] **Step 3: Test with default settings**

```bash
cd experiments/kagi-poc
TEXT="会議は明日の午後3時です" bun start:advanced
```

Expected stdout (JSON):

```json
{
  "input": "会議は明日の午後3時です",
  "output": "Cuộc họp là lúc 3 giờ chiều ngày mai",
  "options": { "text": "会議は明日の午後3時です", "from": "auto", "to": "vi" }
}
```

- [ ] **Step 4: Verify `style` affects output**

Run these two commands and compare outputs — they should produce different translations:

```bash
cd experiments/kagi-poc
TEXT="彼女は美しい" SOURCE_LANG=ja TARGET_LANG=vi STYLE=natural bun start:advanced
TEXT="彼女は美しい" SOURCE_LANG=ja TARGET_LANG=vi STYLE=literal bun start:advanced
```

Expected: `natural` gives idiomatic translation; `literal` stays closer to word-for-word.

- [ ] **Step 5: Verify `formality` affects output**

```bash
cd experiments/kagi-poc
TEXT="ありがとうございます" SOURCE_LANG=ja TARGET_LANG=vi FORMALITY=more bun start:advanced
TEXT="ありがとうございます" SOURCE_LANG=ja TARGET_LANG=vi FORMALITY=less bun start:advanced
```

Expected: `more` = formal/polite Vietnamese; `less` = casual Vietnamese.

- [ ] **Step 6: Verify `reading_level` affects output**

```bash
cd experiments/kagi-poc
TEXT="The quantum entanglement phenomenon demonstrates non-local correlations" SOURCE_LANG=en TARGET_LANG=vi READING_LEVEL=a1 bun start:advanced
TEXT="The quantum entanglement phenomenon demonstrates non-local correlations" SOURCE_LANG=en TARGET_LANG=vi READING_LEVEL=c2 bun start:advanced
```

Expected: `a1` = simple Vietnamese vocabulary; `c2` = preserves technical terms.

- [ ] **Step 7: Commit**

```bash
git add experiments/kagi-poc/src/phase3-advanced.ts
git commit -m "feat(kagi-poc): phase 3 — all translation settings configurable via env vars"
```

---

## Task 7: Docker Verification

**Files:** No new files — verify the Dockerfile from Task 1 works end-to-end.

- [ ] **Step 1: Build Docker image**

```bash
cd experiments/kagi-poc
docker build -t kagi-poc .
```

Expected: Build succeeds. Note: image will be ~1.5–2 GB (Playwright base image is large by design).

- [ ] **Step 2: Run Phase 2 in Docker**

```bash
docker run --rm kagi-poc
```

Expected: Same output as `bun start` locally — JP→VI translation logged to terminal.

- [ ] **Step 3: Run Phase 3 in Docker with env vars**

```bash
docker run --rm \
  -e TEXT="会議は明日の午後3時です" \
  -e SOURCE_LANG=ja \
  -e TARGET_LANG=vi \
  -e STYLE=natural \
  -e FORMALITY=more \
  -e READING_LEVEL=b2 \
  kagi-poc bun src/phase3-advanced.ts
```

Expected: JSON output on stdout with translated text. Compare with `FORMALITY=less` — outputs should differ.

- [ ] **Step 4: Final commit**

```bash
git add experiments/kagi-poc/
git commit -m "feat(kagi-poc): Docker verified — Phase 2 and Phase 3 run successfully in container"
```

---

## Acceptance Checklist

### Phase 2

- [ ] `bun start` logs JP→VI translation to terminal without errors
- [ ] `docker build -t kagi-poc . && docker run --rm kagi-poc` produces translation output

### Phase 3

- [ ] `TEXT=... bun start:advanced` outputs clean JSON with `input`, `output`, `options`
- [ ] `STYLE=natural` vs `STYLE=literal` produce different translations
- [ ] `FORMALITY=more` vs `FORMALITY=less` produce different politeness levels
- [ ] `READING_LEVEL=a1` vs `READING_LEVEL=c2` produce simple vs complex vocabulary
- [ ] `docker run --rm -e TEXT=... -e STYLE=... kagi-poc bun src/phase3-advanced.ts` works
