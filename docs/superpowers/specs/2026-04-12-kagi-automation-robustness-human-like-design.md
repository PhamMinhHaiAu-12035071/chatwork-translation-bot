# Design Spec — Kagi Translate Automation: Robustness & Human-like Behavior

**Version**: 1.0
**Date**: 2026-04-12
**Prepared by**: AI-assisted (Claude Sonnet 4.6)
**Status**: Approved

---

## 1. Objective

Nâng automation pipeline `nghien_cuu_cua_toi` lên mức production-grade bằng cách giải quyết 3 vấn đề cốt lõi:

1. **Input text không có max length** → clamp tại 20,000 chars, pipeline không crash/hang
2. **Delay hardcoded không scale** → dynamic delay theo text length, zero incomplete-scrape
3. **Tương tác 100% máy** → human-like mouse movement, typing, drag via ghost-cursor + puppeteer-humanize

---

## 2. Scope

**In-scope**:

- `nghien_cuu_cua_toi/` package
- 3 phases độc lập: clamp → delay → human-interaction
- Tất cả flows từ `fillSourceTextInput()` đến `scrapeTranslatedText()`

**Out-of-scope**:

- `IBrowserService` interface — không thay đổi signature
- `IUrlBuilder` interface — không ảnh hưởng
- `packages/kagi-sidecar/` — không trong scope
- Dashboard / webhook bot — không liên quan

---

## 3. Non-Goals

- Không thêm feature flag / env toggle cho human-like behavior
- Không thay đổi Cloudflare bypass logic
- Không thay đổi `launch()` config (risk break Cloudflare detection)
- Không resurrect `browser.service.test.ts` (đã xóa có chủ đích)

---

## 4. Constraints

- **Docker compatibility là hard constraint** — mọi ghost-cursor interaction phải có fallback mạnh khi bounding rect bất thường (width = 0, tọa độ âm)
- `IBrowserService.translate(url, options?, sourceText?)` signature giữ nguyên
- `as const` pattern cho tất cả config constants (nhất quán với `BROWSER_CONFIG`)
- `~/path` alias cho intra-package imports (no `../`)
- Definition of Done: `bun test && bun run typecheck && bun run lint`

---

## 5. Architecture

### 5.1 Implementation Phasing (DEC-005)

3 phases hoàn toàn độc lập — có thể ship riêng lẻ:

```
Phase 1: Input Clamping        — zero risk, no new deps
Phase 2: Dynamic Delay         — pure functions, no new deps
Phase 3: Human Interaction     — new deps (ghost-cursor, puppeteer-humanize), Docker risk
```

### 5.2 Component Map

```
index.ts / runReadingLevelSweep()
  └── clampInputText()              [Phase 1 — primary guard]

KagiBrowserService
  └── clampInputText()              [Phase 1 — defensive guard, silent]
  └── computeScaledDelay()          [Phase 2 — replaces hardcoded delays]
  └── IHumanInteraction (DI)        [Phase 3 — replaces direct page interactions]
       └── HumanInteractionService
            └── ghost-cursor        [mouse movements, click, drag]
            └── puppeteer-humanize  [textarea typing]
```

### 5.3 Dependency Graph

```
delay.config.ts          ← imported by KagiBrowserService
translation.config.ts    ← already exists, extended
human-interaction.interface.ts  ← new
human-interaction.service.ts    ← new, implements interface
KagiBrowserService       ← modified, consumes all above
index.ts                 ← modified, calls clampInputText()
```

---

## 6. Data Model / Types

### 6.1 Phase 1 — Input Clamping (translation.config.ts)

```typescript
export const MAX_INPUT_TEXT_LENGTH = 20_000

export function clampInputText(raw: string): string
// Returns raw if length ≤ 20,000
// Returns raw.slice(0, 20_000) + console.warn if truncated
// Primary call: index.ts (logs warning with original length + chars removed)
// Defensive call: fillSourceTextInput() (silent, no double-warn)
```

### 6.2 Phase 2 — Delay Config (delay.config.ts — new file)

```typescript
interface DelayTier {
  readonly maxChars: number
  readonly multiplier: number
}

const DELAY_TIERS: readonly DelayTier[] = [
  { maxChars: 2_000, multiplier: 1.0 },
  { maxChars: 8_000, multiplier: 1.5 },
  { maxChars: 15_000, multiplier: 2.5 },
  { maxChars: 20_000, multiplier: 4.0 },
] as const

export const HUMAN_INPUT_THRESHOLD = 500 // chars: ≤500 → type, >500 → chunkPaste

export function computeDelayMultiplier(charCount: number): number
// First-match scan through DELAY_TIERS
// charCount > 20,000 → returns 4.0 (capped at max tier)

export function computeScaledDelay(baseMs: number, charCount: number): number
// = baseMs × computeDelayMultiplier(charCount) × jitter
// jitter: random dalam range [0.9, 1.1] (±10%)
```

**Delays được scale** (phụ thuộc Kagi API response):

| Constant                         | Base value | Khi nào                    |
| -------------------------------- | ---------- | -------------------------- |
| `CONTEXT_URL_SETTLE_MS`          | 1,500ms    | Sau fill context           |
| Delay trước reading level        | 2,000ms    | Trước set reading level    |
| Delay sau formality              | 2,000ms    | Sau click formality        |
| `TRANSLATION_OUTPUT_STABLE_MS`   | 1,500ms    | Chờ streaming output ngừng |
| `TRANSLATION_OUTPUT_MAX_WAIT_MS` | 90,000ms   | Max timeout output         |

**Delays KHÔNG scale** (UI animation, cố định):

- `POST_DIALOG_SETTLE_MS` (400ms)
- `STYLE_OPTION_CLICK_GAP_MS` (200ms)
- `POST_DISMISS_SETTINGS_MS` (200ms)
- `CLOUDFLARE_VERIFICATION_TIMEOUT_MS` (45,000ms)
- Cloudflare initial wait (5,000ms)

### 6.3 Phase 3 — IHumanInteraction Interface

```typescript
// src/services/interfaces/human-interaction.interface.ts
import type { Page } from 'puppeteer-core'

export interface IHumanInteraction {
  /** Ghost-cursor Bezier move → click element by CSS selector */
  click(page: Page, selector: string): Promise<void>

  /** Find element by span text + matchIndex → ghost-cursor move to rect center ± jitter → click */
  clickByTextContent(
    page: Page,
    spanSelector: string,
    text: string,
    matchIndex: number,
  ): Promise<void>

  /** puppeteer-humanize typeInto() cho standard <textarea> */
  typeIntoTextarea(page: Page, selector: string, text: string): Promise<void>

  /** page.type() với variable delay 50–150ms/keystroke + pause sau punctuation. Cho CodeMirror */
  typeIntoContentEditable(page: Page, selector: string, text: string): Promise<void>

  /** Ghost-cursor mousedown → Bezier drag → mouseup. Fallback: evaluate() set value */
  dragSlider(page: Page, sliderSelector: string, fromStep: number, toStep: number): Promise<void>

  /** Clipboard API chunk paste + type 3–5 ký tự cuối bằng keystroke */
  chunkPaste(page: Page, selector: string, text: string): Promise<void>
}
```

---

## 7. Component Detail

### 7.1 HumanInteractionService

**Vị trí**: `src/services/human-interaction.service.ts`

**Lifecycle**: Tạo mới mỗi `translate()` call vì `createCursor(page)` cần page instance hiện tại. Không lưu state giữa các calls.

**ghost-cursor compatibility** (DEC-002):

- Tìm package/fork support `puppeteer-core` Page type trực tiếp
- Nếu không có → `page as any` với eslint-disable justification comment

**Fallback chain (Docker-safe)** (DEC-003):

```
1. Validate bounding rect: width > 0 AND height > 0 AND top ≥ 0 AND left ≥ 0
2. Nếu invalid → skip ghost-cursor, dùng Puppeteer standard API + console.warn("⚠️ Degraded to standard [action]")
3. Nếu valid → attempt ghost-cursor
4. Nếu ghost-cursor throws → retry 1x
5. Nếu retry fail → fallback standard Puppeteer API + console.warn
```

**chunkPaste implementation** (DEC-001):

```
1. Chia text thành chunks (500–2,000 chars/chunk, size ngẫu nhiên)
2. Cho mỗi chunk:
   a. page.evaluate(() => navigator.clipboard.writeText(chunk))
   b. page.keyboard.down('Control') / 'Meta' (Mac)
   c. page.keyboard.press('v')
   d. page.keyboard.up('Control') / 'Meta'
   e. delay ngẫu nhiên 200–800ms
3. Gõ 3–5 ký tự cuối bằng typeIntoContentEditable()
```

**dragSlider implementation** (DEC-004):

```
1. getBoundingClientRect() của slider track
2. Nếu rect.width === 0 → evaluate() set value + dispatch 'input' event (proven fallback)
3. Nếu rect valid → tính pixel position: left + (stepIndex / maxSteps) * width
4. ghost-cursor mousedown tại fromStep position → Bezier drag → mouseup tại toStep
```

### 7.2 KagiBrowserService — Changes

**Constructor**:

```typescript
constructor(private humanInteraction: IHumanInteraction = new HumanInteractionService()) {}
```

**Thay đổi trong `translate()`**:

- Nhận `inputText.length` → truyền vào `computeScaledDelay()` cho 5 scaled delays
- `fillSourceTextInput()` → `humanInteraction.chunkPaste()` (>500 chars) hoặc `humanInteraction.typeIntoContentEditable()` (≤500 chars)
- `clickTranslationSettingsButton()` → `humanInteraction.click()`
- `fillTranslationContext()` → `humanInteraction.typeIntoTextarea()`
- `clickSpeakerGenderOption()` → `humanInteraction.clickByTextContent()`
- `clickAddresseeGenderOption()` → `humanInteraction.clickByTextContent()`
- `clickTranslationStyleOption()` → `humanInteraction.clickByTextContent()`
- `setReadingLevel()` → `humanInteraction.dragSlider()`
- `clickFormalityOption()` → `humanInteraction.clickByTextContent()`

**Không thay đổi**: `launch()`, `close()`, `scrapeTranslatedText()`, URL verification methods, Cloudflare wait logic.

---

## 8. Testing Strategy

| Component                  | Test approach                                                                | File                                      |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| `clampInputText()`         | Unit: ≤20k pass-through, >20k truncate, empty, exact boundary                | `translation.config.test.ts` (extend)     |
| `computeDelayMultiplier()` | Unit: boundaries (0, 2000, 2001, 8000, 8001, 15000, 15001, 20000, 25000)     | `delay.config.test.ts` (new)              |
| `computeScaledDelay()`     | Unit: base × multiplier, jitter trong [0.9×base, 1.1×base×multiplier]        | `delay.config.test.ts` (new)              |
| `HumanInteractionService`  | Unit với mock Page: verify ghost-cursor called, fallback khi rect.width=0    | `human-interaction.service.test.ts` (new) |
| `KagiBrowserService`       | E2E mock: IHumanInteraction mock injected via DI, verify methods called đúng | `translation-mocked.e2e.test.ts` (extend) |

---

## 9. Decision Log

| ID      | Decision                                                                 | Status   | Provenance     | Risk   | Notes                                                 |
| ------- | ------------------------------------------------------------------------ | -------- | -------------- | ------ | ----------------------------------------------------- |
| DEC-001 | chunkPaste dùng Clipboard API + Ctrl/Cmd+V                               | accepted | user-confirmed | low    | Thay execCommand — CodeMirror 6 native paste pipeline |
| DEC-002 | ghost-cursor: tìm puppeteer-core compatible fork; fallback `page as any` | accepted | user-confirmed | medium | Runtime compatible vì same shape                      |
| DEC-003 | Docker: strong bounding rect guard — fallback nếu width=0 hoặc coords âm | accepted | user-confirmed | low    | Docker là môi trường production chính                 |
| DEC-004 | Slider drag: bounding rect calc; fallback evaluate() + input event       | accepted | user-confirmed | low    | evaluate() set value đã proven                        |
| DEC-005 | 3 phases độc lập: clamp → delay → human-like                             | accepted | user-confirmed | low    | Ship từng phase để isolate risk                       |

---

## 10. Acceptance Criteria

### Phase 1 — Input Clamping

- [ ] Input text > 20,000 chars → truncate + log warning với original length + chars removed
- [ ] Input text ≤ 20,000 chars → pass-through, không log
- [ ] Defensive clamp trong `fillSourceTextInput()` không double-warn
- [ ] `clampInputText('')` → trả về `''`
- [ ] `bun test && bun run typecheck && bun run lint` pass

### Phase 2 — Dynamic Delay

- [ ] 4 tiers đúng: ≤2k→1x, 2001-8k→1.5x, 8001-15k→2.5x, 15001-20k→4x
- [ ] Jitter luôn nằm trong ±10% của base×multiplier
- [ ] 5 delays được scale đã thay thế hardcoded values trong `translate()`
- [ ] 5 delays cố định (UI animation) KHÔNG bị scale
- [ ] `bun test && bun run typecheck && bun run lint` pass

### Phase 3 — Human Interaction

- [ ] `HumanInteractionService` implement đầy đủ `IHumanInteraction`
- [ ] `KagiBrowserService` constructor nhận optional `IHumanInteraction` (DI)
- [ ] chunkPaste dùng Clipboard API + Ctrl/Cmd+V (không dùng execCommand)
- [ ] Fallback activate khi bounding rect width=0 (Docker scenario)
- [ ] Fallback log `console.warn("⚠️ Degraded to standard [action]")`
- [ ] Tất cả `page.click()` / `evaluate()` UI interactions đã được replace
- [ ] `bun test && bun run typecheck && bun run lint` pass

---

## 11. Happy Path

```
main() → clampInputText(rawText) → runReadingLevelSweep()
  → KagiBrowserService.translate(url, options, clampedText)
    → launch() + navigate + Cloudflare wait
    → text.length > 500: humanInteraction.chunkPaste() [Clipboard API chunks]
    → humanInteraction.click() [settings button, ghost-cursor]
    → humanInteraction.typeIntoTextarea() [context, puppeteer-humanize]
    → computeScaledDelay(1500, charCount) → wait
    → humanInteraction.clickByTextContent() [speaker, addressee, style]
    → humanInteraction.dragSlider() [reading level, ghost-cursor]
    → computeScaledDelay(2000, charCount) → wait
    → humanInteraction.clickByTextContent() [formality]
    → computeScaledDelay(2000, charCount) → wait
    → scrapeTranslatedText()
    → return { translated, finalUrl }
```

---

## 12. Edge Cases

- Input text = chính xác 20,000 chars → pass-through (không truncate)
- Input text = 20,001 chars → truncate tại 20,000
- Input text = `''` (empty) → pass-through
- charCount = 0 → multiplier = 1.0 (tier 1 match)
- charCount > 20,000 (sau clamp không xảy ra) → multiplier = 4.0 (max tier)
- ghost-cursor bounding rect width = 0 (Docker) → fallback standard click + warn
- ghost-cursor throws exception → retry 1x → fallback + warn
- sourceText = 3 chars (≤ HUMAN_INPUT_THRESHOLD=500) → KagiBrowserService route sang `typeIntoContentEditable()`, không gọi `chunkPaste()`
- OS detection cho Ctrl/Cmd+V: `process.platform === 'darwin'` → `Meta`, otherwise → `Control`

---

## 13. Failure Cases

- ghost-cursor package không có puppeteer-core compatible version → dùng `page as any` (DEC-002)
- Clipboard API không available trong browser context → fallback `page.type()` full text
- Slider bounding rect invalid sau retry → `evaluate()` set value (DEC-004), log degraded
- `puppeteer-humanize` không tương thích với puppeteer version → fallback `page.type()` với hardcoded delay

---

## 14. Open Risks

- **[MEDIUM]** ghost-cursor type compatibility: runtime OK nhưng cần verify không có behavior difference giữa puppeteer vs puppeteer-core Page shapes
- **[LOW]** puppeteer-humanize package maintenance: cần verify version compatibility với puppeteer ^24.40.0 trước khi install

---

## 15. Out-of-Scope (Confirmed)

- Human-like behavior toggle via env var
- Keyboard arrow key alternative cho slider
- Xvfb configuration changes trong Docker
- Any changes to `packages/kagi-sidecar/`

---

## 16. Future Scope / Deferred Features

_(Confirmed out of current scope, not estimated, not committed)_

- Random pre-interaction pause ("người đang đọc kết quả")
- Mouse idle movement giữa các settings steps
- Typing speed profile (slow typist vs fast typist mode)
