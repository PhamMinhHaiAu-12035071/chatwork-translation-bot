# Design Spec — Kagi Sidecar: Robustness & Human-like Interaction Port

**Version**: 1.0
**Date**: 2026-04-13
**Prepared by**: AI-assisted (Claude Sonnet 4.6)
**Status**: Approved

---

## 1. Objective

Port 3 cải thiện đã proven ở `nghien_cuu_cua_toi/` vào `packages/kagi-sidecar/` production HTTP sidecar. Giữ nguyên 100% API contract (server routes, request/response types, provider-kagi integration).

**3 vấn đề cần giải quyết:**

1. Không có bảo vệ input text length → clamp tại 20,000 chars
2. Delays hardcoded không scale → dynamic delay 4-tier scaling (1.0x–4.0x)
3. Tương tác 100% máy → human-like mouse/keyboard/typing qua ghost-cursor + @forad/puppeteer-humanize

---

## 2. Scope

**In-scope:**

- `packages/kagi-sidecar/` — tất cả thay đổi nằm trong package này
- 3 phases độc lập: input clamping → dynamic delay → human interaction
- Ship tuần tự qua 3 PRs (PR1 → PR2 → PR3)

**Out-of-scope:**

- `packages/provider-kagi/` — HTTP client layer, types, url-builder — không thay đổi
- `packages/dashboard/` — presentation layer — không thay đổi
- `src/server.ts` — Elysia routes giữ nguyên contract
- Feature flag / env toggle cho human-like behavior
- Xvfb configuration changes trong Docker

---

## 3. Non-Goals

- Thay đổi `IBrowserService` interface hay signature `translate()`
- Thay đổi `KagiTranslateRequest`, `KagiTranslationResult`, `KagiHealthSnapshot`
- Human-like behavior toggle via env var
- Keyboard arrow key alternative cho slider
- Any changes to provider-kagi url-builder

---

## 4. Constraints

- **Docker compatibility là hard constraint** — mọi ghost-cursor interaction phải có fallback khi bounding rect bất thường (width=0, tọa độ âm trong Xvfb)
- `PageLike` abstraction phải được maintained — HumanInteractionService dùng `PageLike` (không phải `puppeteer-core Page`) ở compile-time; runtime object là real puppeteer-real-browser Page
- `bun test && bun run typecheck && bun run lint` phải pass sau mỗi PR
- Puppeteer `Page` (từ puppeteer-real-browser) phải satisfy extended `PageLike` — đã verify tất cả methods tồn tại

---

## 5. Architecture

### 5.1 Implementation Phasing

3 phases hoàn toàn độc lập — có thể ship riêng lẻ, rollback riêng lẻ:

```
Phase 1 (PR #1): Input Clamping     — zero risk, no new deps
Phase 2 (PR #2): Dynamic Delay      — pure functions, no new deps
Phase 3 (PR #3): Human Interaction  — new deps (ghost-cursor, @forad/puppeteer-humanize)
```

### 5.2 Component Map

```
POST /translate (Elysia server)
  └── KagiBrowserService.translate()
       ├── clampInputText(text)                      [Phase 1 — primary guard]
       ├── page.goto(languagePairUrl)                 [Phase 3 — NO text in URL]
       ├── clearSourceTextInput(page)                 [Phase 3 — evaluate() selectAll+delete]
       ├── fillSourceTextInput(page, text, charCount) [Phase 3 — via HumanInteractionService]
       │    ├── charCount ≤ 500 → typeIntoContentEditable()
       │    └── charCount > 500 → chunkPaste()
       ├── clickTranslationSettingsButton()                     [PR3 — via HIS.click()]
       ├── [SETTINGS BASELINE RESET] (200ms fixed delays — không scale)
       │    ├── clearTranslationContext(page) via page.evaluate() [NOT via HIS]
       │    ├── HIS.clickByTextContent() [genders]
       │    ├── HIS.dragSlider()         [reading level → standard]
       │    ├── HIS.clickByTextContent() [style → Natural]
       │    └── HIS.clickByTextContent() [formality → Standard, matchIndex verify từ PoC]
       ├── [SETTINGS TARGET APPLICATION] (scaled delays)
       │    ├── HIS.typeIntoTextarea()              [context — NO URL verify]
       │    ├── computeScaledDelay(1500, charCount) [post-context settle]
       │    ├── computeScaledDelay(2000, charCount) [pre-reading-level gap]
       │    ├── HIS.dragSlider()                    [reading level]
       │    ├── HIS.clickByTextContent()             [style]
       │    ├── HIS.clickByTextContent()             [formality — "chim mồi"]
       │    └── computeScaledDelay(2000, charCount) [post-formality settle]
       └── waitForTranslationOutputStable(charCount)
            ├── stable window: computeScaledDelay(1500, charCount) — SCALED
            └── max wait: 90,000ms — FIXED (safety ceiling)
```

### 5.3 Dependency Graph

```
constants/input-clamping.ts      ← imported by browser-service.ts
constants/delay-config.ts        ← imported by browser-service.ts
types/human-interaction.interface.ts ← imported by browser-service.ts + human-interaction.service.ts
services/human-interaction.service.ts ← instantiated in browser-service.ts constructor
types/page.interface.ts          ← extended, imported by browser-service.ts (removes inline def)
browser-service.ts               ← modified, consumes all above
```

---

## 6. Data Model / Types

### 6.1 Không có entity hay schema mới

Enhancement này không tạo entities hay schema mới. Tất cả thay đổi ở runtime behavior.

### 6.2 PageLike extension (`types/page.interface.ts`)

Remove inline `PageLike` từ `browser-service.ts` (dòng 18-46, không exported, không breaking change). Import từ `types/page.interface.ts`.

**Thêm vào PageLike:**

```typescript
mouse: {
  move(x: number, y: number): Promise<void>
  down(): Promise<void>
  up(): Promise<void>
}
keyboard: {
  down(key: string): Promise<void>
  press(key: string): Promise<void>
  up(key: string): Promise<void>
}
type(selector: string, text: string, options?: { delay?: number }): Promise<void>
$(selector: string): Promise<ElementHandleLike | null>
```

**Overloaded evaluate** (giữ type-safety cho existing call sites, enable multi-arg calls từ HIS):

```typescript
evaluate<TArg, TResult>(fn: (arg: TArg) => TResult, arg: TArg): Promise<TResult>
evaluate<T1, T2, TResult>(fn: (a1: T1, a2: T2) => TResult, a1: T1, a2: T2): Promise<TResult>
evaluate<T1, T2, T3, TResult>(fn: (a1: T1, a2: T2, a3: T3) => TResult, a1: T1, a2: T2, a3: T3): Promise<TResult>
evaluate<TResult>(...args: unknown[]): Promise<TResult>
```

### 6.3 IHumanInteraction interface (`types/human-interaction.interface.ts`)

Dùng `PageLike` thay vì `puppeteer-core Page` (khác PoC — là điểm khác biệt quan trọng nhất):

```typescript
import type { PageLike } from './page.interface'

export interface IHumanInteraction {
  click(page: PageLike, selector: string): Promise<void>
  clickByTextContent(
    page: PageLike,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>
  typeIntoTextarea(page: PageLike, selector: string, text: string): Promise<void>
  typeIntoContentEditable(page: PageLike, selector: string, text: string): Promise<void>
  dragSlider(
    page: PageLike,
    sliderSelector: string,
    fromStep: number,
    toStep: number,
  ): Promise<void>
  chunkPaste(page: PageLike, selector: string, text: string): Promise<void>
}
```

### 6.4 KagiBrowserServiceOptions extension

```typescript
// Thêm một field optional vào interface hiện có:
humanInteraction?: IHumanInteraction  // default: new HumanInteractionService()
```

### 6.5 Delay Config (`constants/delay-config.ts`)

```typescript
interface DelayTier {
  readonly maxChars: number
  readonly multiplier: number
}

export const DELAY_TIERS: readonly DelayTier[] = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const

export const HUMAN_INPUT_THRESHOLD = 500

export function computeDelayMultiplier(charCount: number): number
// First-match scan qua DELAY_TIERS; charCount > 20k → 4.0 (capped)

export function computeScaledDelay(baseMs: number, charCount: number): number
// = Math.round(baseMs × computeDelayMultiplier(charCount) × jitter[0.9, 1.1])
```

**Delays được scale** (phụ thuộc Kagi API response):

| Base    | Dùng ở đâu                                         |
| ------- | -------------------------------------------------- |
| 1,500ms | Sau fill context (Phase 2 step 1)                  |
| 2,000ms | Trước set reading level (Phase 2 step 2)           |
| 2,000ms | Sau click formality (Phase 2 step 4)               |
| 1,500ms | Stable window trong waitForTranslationOutputStable |

**Không scale** (cố định):

| Giá trị                                   | Lý do                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| 200ms (STYLE_OPTION_CLICK_GAP_MS)         | UI animation                                                  |
| 400ms (POST_DIALOG_SETTLE_MS)             | Dialog settle                                                 |
| 90,000ms (TRANSLATION_OUTPUT_MAX_WAIT_MS) | Safety ceiling — nếu scale xung đột với 120s requestTimeoutMs |

### 6.6 Input Clamping (`constants/input-clamping.ts`)

```typescript
export const MAX_INPUT_TEXT_LENGTH = 20_000

export function clampInputText(text: string): string
// ≤20k: pass-through
// >20k: text.slice(0, 20_000) + console.warn('[clampInputText] Input truncated: ${orig} → 20000 chars (${removed} removed)')
```

---

## 7. Component Detail

### 7.1 executeTranslation() — thay đổi chính

**Navigation (AD-3):**

```typescript
// Before:
const simpleUrl = buildSimpleKagiUrl(request.text)
await page.goto(simpleUrl, { waitUntil: 'networkidle2' })

// After:
await page.goto('https://translate.kagi.com/?from=auto&to=vi', { waitUntil: 'networkidle2' })
// buildSimpleKagiUrl import bị xóa; KAGI_STYLE_PRESETS import giữ nguyên
```

**Source text entry** (mới, trước Phase 1):

```typescript
const charCount = request.text.length // từ clamped text
await this.clearSourceTextInput(page) // evaluate() — preparation step, KHÔNG qua HIS
await this.fillSourceTextInput(page, request.text, charCount) // via HIS
// KHÔNG có URL verification sau bước này — confirmed DEC-008
```

**Phase 1 replacements:**

| Trước                                                         | Sau                                                                                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `handle.click()` (settings button)                            | `this.humanInteraction.click(page, KAGI_SELECTORS.TRANSLATION_SETTINGS_BUTTON)`                                               |
| `clearTranslationContext()` dùng `page.evaluate()`            | **Giữ nguyên** — evaluate-based, không qua HIS (preparation step)                                                             |
| `page.evaluate(() => btn.click())` (genders, style)           | `this.humanInteraction.clickByTextContent(page, selector, label, matchIndex)`                                                 |
| `page.evaluate(() => slider.value = 0)` (reading level reset) | `this.humanInteraction.dragSlider(page, selector, currentStep, 0)`                                                            |
| `page.evaluate(() => btn.click())` (formality Standard reset) | `this.humanInteraction.clickByTextContent(page, selector, 'Standard', matchIndex)` — **matchIndex cần verify từ PoC runtime** |

URL verifications trong Phase 1 (verifyUrlNotContains, verifyUrlMatchesReadingLevel) — **giữ nguyên**.

**Phase 2 replacements + scaled delays:**

- `fillTranslationContext()` → `this.humanInteraction.typeIntoTextarea()` + **xóa** `verifyUrlContains(page, 'context=', ...)` (Kagi không phản ánh context lên URL khi nhập qua typing)
- `setReadingLevel()` → `this.humanInteraction.dragSlider()`
- `clickTranslationStyleOption()` → `this.humanInteraction.clickByTextContent()`
- `clickFormalityOption()` → `this.humanInteraction.clickByTextContent()`
- Hardcoded delays → `computeScaledDelay(base, charCount)`

**waitForTranslationOutputStable(charCount):**

```typescript
// Before signature: waitForTranslationOutputStable(page: PageLike)
// After signature:  waitForTranslationOutputStable(page: PageLike, charCount: number)

// Stable window (SCALED):
const stableWindowMs = computeScaledDelay(KAGI_TIMING.TRANSLATION_OUTPUT_STABLE_MS, charCount)
if (Date.now() - lastChangeTime >= stableWindowMs) { ... }

// Max wait (FIXED):
while (Date.now() - startTime < KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS) { ... }
// KAGI_TIMING.TRANSLATION_OUTPUT_MAX_WAIT_MS = 90_000 — không thay đổi
```

### 7.2 HumanInteractionService (`services/human-interaction.service.ts`)

Port trực tiếp từ `nghien_cuu_cua_toi/src/services/human-interaction.service.ts`. Adapt duy nhất: method signatures dùng `PageLike` thay vì `puppeteer-core Page`.

**JSDoc @remarks**: `Implementation requires runtime Page from puppeteer-real-browser. PageLike is compile-time contract only. ghost-cursor createCursor(page as unknown) and puppeteer-humanize typeInto(handle, ...) rely on runtime object richer than compile-time PageLike.`

**Imports:**

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports -- ghost-cursor has incomplete types for puppeteer-core Page
const { createCursor } = require('ghost-cursor') as { createCursor: (page: unknown) => ... }

// eslint-disable-next-line @typescript-eslint/no-require-imports -- scoped package, runtime require matches plan
const { typeInto } = require('@forad/puppeteer-humanize') as { typeInto: (...) => ... }
```

**Fallback chain (Docker-safe) cho mọi method:**

1. `isValidRect(rect)`: `width > 0 && height > 0 && top ≥ 0 && left ≥ 0`
2. Nếu invalid → skip ghost-cursor, dùng standard Puppeteer API + `console.warn('⚠️ Degraded to standard [action]: selector')`
3. Nếu ghost-cursor throws → catch → fallback + warn

**chunkPaste:**

```
1. Chia text thành chunks (500–2000 chars/chunk, size ngẫu nhiên)
2. Mỗi chunk:
   a. page.evaluate(() => navigator.clipboard.writeText(chunk))
   b. page.keyboard.down(PASTE_MODIFIER)  // 'Meta' trên darwin, 'Control' otherwise
   c. page.keyboard.press('v')
   d. page.keyboard.up(PASTE_MODIFIER)
   e. sleep(randInt(200, 800))
3. 3–5 ký tự cuối: typeIntoContentEditable() cho natural finish
Fallback: full page.evaluate(() => execCommand('insertText', false, text))
```

**dragSlider:**

```
1. getBoundingClientRect() của slider track
2. Nếu rect.width === 0 → page.evaluate(() => { slider.value = toStep; slider.dispatchEvent(...) }) (proven fallback)
3. Nếu rect valid → tính pixel position: left + (stepIndex / maxSteps) * width
4. ghost-cursor: page.mouse.move(fromX, y) → page.mouse.down() → Bezier to (toX, y) → page.mouse.up()
```

### 7.3 New files + Updated files summary

| File                                             | Loại   | Phase |
| ------------------------------------------------ | ------ | ----- |
| `src/constants/input-clamping.ts`                | New    | 1     |
| `src/constants/input-clamping.test.ts`           | New    | 1     |
| `src/constants/delay-config.ts`                  | New    | 2     |
| `src/constants/delay-config.test.ts`             | New    | 2     |
| `src/types/human-interaction.interface.ts`       | New    | 3     |
| `src/services/human-interaction.service.ts`      | New    | 3     |
| `src/services/human-interaction.service.test.ts` | New    | 3     |
| `src/types/page.interface.ts`                    | Modify | 3     |
| `src/browser-service.ts`                         | Modify | 1+2+3 |
| `src/constants/kagi-ui.ts`                       | Modify | 3     |
| `src/runtime-config.ts`                          | Modify | 3     |
| `src/browser-service.test.ts`                    | Modify | 1+2+3 |
| `src/runtime-config.test.ts`                     | Modify | 3     |
| `package.json`                                   | Modify | 3     |

---

## 8. Testing Strategy

### Unit tests — new files

| Component                  | Test file                           | Key cases                                                                                           |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `clampInputText()`         | `input-clamping.test.ts`            | ≤20k pass-through; >20k truncate + warn; empty; exact 20_000; 20_001                                |
| `computeDelayMultiplier()` | `delay-config.test.ts`              | Boundaries: 0, 2000, 2001, 8000, 8001, 15000, 15001, 20000, 25000                                   |
| `computeScaledDelay()`     | `delay-config.test.ts`              | base × multiplier; jitter trong [0.9×base×mult, 1.1×base×mult]                                      |
| `HumanInteractionService`  | `human-interaction.service.test.ts` | click fallback khi rect.width=0; fallback warn message; chunkPaste chunk count; dragSlider fallback |

### browser-service.test.ts — extend mockPage + mock HIS

**mockPage additions:**

```typescript
click: mock((_selector: string) => Promise.resolve()),
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
type: mock((_sel: string, _text: string) => Promise.resolve()),
$: mock((_sel: string) => Promise.resolve(mockElementHandle)),
```

**mockHumanInteraction** — inject qua `createService({ humanInteraction: mockHI })`:

```typescript
const mockHumanInteraction = {
  click: mock(() => Promise.resolve()),
  clickByTextContent: mock(() => Promise.resolve()),
  typeIntoTextarea: mock(() => Promise.resolve()),
  typeIntoContentEditable: mock(() => Promise.resolve()),
  dragSlider: mock(() => Promise.resolve()),
  chunkPaste: mock(() => Promise.resolve()),
}
```

**New test cases:**

- `clampInputText` được gọi trước khi fill text > 20k → truncate
- `humanInteraction.chunkPaste` được gọi cho text > 500 chars
- `humanInteraction.typeIntoContentEditable` được gọi cho text ≤ 500 chars
- `humanInteraction.typeIntoTextarea` được gọi khi context có value
- `humanInteraction.click` được gọi cho settings button
- `waitForTranslationOutputStable` nhận charCount parameter
- URL navigation không chứa text param (goes to language-pair-only URL)

**runtime-config.test.ts:** Update assertion `requestTimeoutMs` 30_000 → 120_000

---

## 9. Decision Log

| ID      | Decision                                              | Status   | Provenance  | Risk   | Notes                                                               |
| ------- | ----------------------------------------------------- | -------- | ----------- | ------ | ------------------------------------------------------------------- |
| AD-1    | PageLike consolidation + overloaded evaluate          | accepted | tech-plan   | low    | Remove inline def từ browser-service.ts; import từ types/           |
| AD-2    | DI via KagiBrowserServiceOptions.humanInteraction?    | accepted | tech-plan   | low    | Consistent với existing options DI pattern                          |
| AD-3    | Navigate không text trong URL                         | accepted | tech-plan   | medium | buildSimpleKagiUrl không dùng nữa trong executeTranslation          |
| AD-4    | Tách constants/delay-config.ts + input-clamping.ts    | accepted | tech-plan   | low    | SRP — delay logic tách khỏi kagi-ui.ts                              |
| AD-5    | requestTimeoutMs 30s → 120s                           | accepted | tech-plan   | low    | Accommodate 4x scaling cho text 20k chars                           |
| AD-6    | ghost-cursor + @forad/puppeteer-humanize dependencies | accepted | tech-plan   | medium | require() + type assertion; runtime-compatible                      |
| AD-7    | Ship 3 PRs tuần tự                                    | accepted | tech-plan   | low    | Rollback granularity per phase                                      |
| DEC-007 | E2E gate bắt buộc trong plan                          | accepted | user-stated | —      | Pattern giống Task 10 PoC; production service cần verify thật       |
| DEC-008 | Không verify URL sau source text fill                 | accepted | user-stated | —      | Follow PoC pattern; Core Flows step 8 là aspirational, không proven |

---

## 10. Acceptance Criteria

### Phase 1 — Input Clamping

- [ ] Input > 20,000 chars → truncate + log warning (original length + chars removed)
- [ ] Input ≤ 20,000 chars → pass-through, không log
- [ ] `clampInputText('')` → `''`
- [ ] Exact boundary: 20,000 chars pass-through; 20,001 → truncate
- [ ] `bun test && bun run typecheck && bun run lint` pass

### Phase 2 — Dynamic Delay

- [ ] 4 tiers đúng: ≤2k→1.0x, 2001-8k→1.5x, 8001-15k→2.5x, 15001-20k→4.0x
- [ ] charCount > 20k → multiplier = 4.0 (capped)
- [ ] Jitter luôn trong ±10% của base×multiplier
- [ ] 3 scaled delays (context, pre-reading-level, post-formality) đã replace hardcoded values
- [ ] Output stable window scaled; output max wait (90s) KHÔNG scale
- [ ] `bun test && bun run typecheck && bun run lint` pass

### Phase 3 — Human Interaction

- [ ] `HumanInteractionService` implement đầy đủ `IHumanInteraction`
- [ ] `KagiBrowserServiceOptions.humanInteraction?` wired vào constructor
- [ ] Navigate URL không chứa text param
- [ ] clearSourceTextInput() dùng `page.evaluate()` (không qua HIS)
- [ ] fillSourceTextInput() route đúng: ≤500 chars → typeIntoContentEditable, >500 → chunkPaste
- [ ] Context URL verify bị xóa (typeIntoTextarea không phản ánh lên URL)
- [ ] Fallback activate + warn khi bounding rect width=0
- [ ] requestTimeoutMs default = 120,000ms
- [ ] `bun test && bun run typecheck && bun run lint` pass

### E2E Acceptance Gate (plan completed khi và chỉ khi):

- [ ] **Local**: `bun packages/kagi-sidecar/src/index.ts` start thành công; POST /translate trả về `translated` field với Vietnamese text; log hiển thị human-like interaction steps
- [ ] **Docker**: `docker compose up kagi-translator`; POST /translate trả về kết quả; không có `UI_INTERACTION` error trong logs (`⚠️ Degraded to standard` là acceptable)

---

## 11. Happy Path

```
POST /translate {text: "Hello", style: "Clear"}
  → clampInputText("Hello")  → pass-through (5 chars)
  → charCount = 5

  → KagiBrowserService.executeTranslation()
    → page.goto('https://translate.kagi.com/?from=auto&to=vi')
    → clearSourceTextInput(page)  [evaluate selectAll+delete]
    → HIS.typeIntoContentEditable(page, SOURCE_TEXT_INPUT, "Hello")  [≤500 chars]

    → HIS.click(page, TRANSLATION_SETTINGS_BUTTON)
    → sleep(400ms)  [POST_DIALOG_SETTLE_MS — fixed]

    [SETTINGS BASELINE RESET]
    → clearTranslationContext(page)  [page.evaluate() — NOT via HIS]
    → sleep(200ms) → verifyUrlNotContains('context=')
    → HIS.clickByTextContent(page, GENDER_LABEL, 'Unknown', 0)
    → sleep(200ms) → verifyUrlNotContains('speaker_gender=')
    → HIS.clickByTextContent(page, GENDER_LABEL, 'Unknown', 1)
    → sleep(200ms) → verifyUrlNotContains('addressee_gender=')
    → HIS.dragSlider(page, READING_LEVEL_SLIDER, current, 0)
    → sleep(200ms) → verifyUrlMatchesReadingLevel('standard')
    → HIS.clickByTextContent(page, STYLE_LABEL, 'Natural', 0)
    → sleep(200ms) → verifyUrlNotContains('style=')
    → verifyUrlNotContains('formality_context=')

    [SETTINGS TARGET APPLICATION for style "Clear"]
    → (no context, reading_level=standard, style=natural, formality=standard)
    → waitForTranslationOutputStable(page, charCount=5)
       └── stable window = computeScaledDelay(1500, 5) = ~1500ms (1.0x tier)
       └── max wait = 90,000ms (fixed)

    → scrapeTranslatedText(page) → "Xin chào"

  → HTTP response { translated: "Xin chào", attempts: 1, ... }
```

---

## 12. Edge Cases

- Input text = chính xác 20,000 chars → pass-through
- Input text = 20,001 chars → truncate tại 20,000
- Input text = `''` → pass-through, `charCount = 0`, multiplier = 1.0
- charCount = 0 → multiplier = 1.0 (tier 1 match)
- charCount > 20,000 (post-clamp không xảy ra) → multiplier = 4.0 (max tier)
- ghost-cursor bounding rect width = 0 (Docker/Xvfb) → fallback standard click + warn
- ghost-cursor throws exception → catch → fallback + warn
- sourceText = 3 chars (≤ HUMAN_INPUT_THRESHOLD=500) → route sang typeIntoContentEditable(), không gọi chunkPaste()
- Clipboard API không available → fallback `page.evaluate(() => execCommand('insertText', false, text))`
- OS detection cho paste shortcut: `process.platform === 'darwin'` → `Meta`, otherwise → `Control`
- Page reuse across requests → clearSourceTextInput() removes previous text before fill
- Browser chưa launch → ensurePage() tạo new session (existing behavior)

---

## 13. Failure Cases

- ghost-cursor package không compatible → `page as unknown` cast (runtime OK, compile-time type relaxed)
- `@forad/puppeteer-humanize` incompatible → fallback `page.type()` với fixed delay
- Slider bounding rect invalid sau retry → `evaluate()` set value (DEC-004 pattern), log degraded
- Clipboard API unavailable → `execCommand('insertText')` fallback
- Kagi anti-abuse detection trong E2E → `KagiSidecarError('ANTI_ABUSE')` thrown, pipeline terminates (existing behavior, không thay đổi)
- `UI_INTERACTION` error trong baseline/target phases → throw `KagiSidecarError('UI_INTERACTION')` (existing behavior, không thay đổi)

---

## 14. Open Risks

- **[MEDIUM]** ghost-cursor type compatibility: runtime OK nhưng `page as unknown` cast mất type-check. Verify không có behavior difference giữa puppeteer vs puppeteer-core Page shapes khi E2E test.
- **[LOW]** `@forad/puppeteer-humanize` maintenance: verify version compatibility với puppeteer-real-browser trước khi install.
- **[LOW]** Clipboard API availability trong Docker Chrome context: fallback path được implement, nhưng chưa observed trong Xvfb environment cụ thể.

---

## 15. Out-of-Scope (Confirmed)

- Human-like behavior toggle via env var
- Keyboard arrow key alternative cho slider
- Xvfb configuration changes trong Docker
- Any changes to `packages/provider-kagi/`
- Any changes to `packages/dashboard/`
- Source text URL verification (DEC-008: follow PoC pattern, no verify)

---

## 16. Future Scope / Deferred Features

_(Confirmed out of current scope, not estimated, not committed)_

- Random pre-interaction pause ("người đang đọc kết quả")
- Mouse idle movement giữa các settings steps
- Typing speed profile (slow typist vs fast typist mode)
- Retry logic cho individual HIS method failures (hiện tại: catch → fallback, không retry)
