# Keyword Protection Feature — Design Spec

**Version:** 1.0  
**Date:** 2026-04-01  
**Prepared by:** AI-assisted (Claude Sonnet 4.6)  
**Status:** Approved — ready for implementation planning

---

## Objective

Add a per-room "Sensitive Keywords Protection" feature that replaces sensitive terms with typed placeholders **before** sending content to OpenAI/Gemini, then restores originals after translation — ensuring zero sensitive data leakage to third-party AI providers while keeping translated output natural and readable.

---

## Scope

- Backend: `KeywordRedactor` service + pipeline integration
- Frontend: `KeywordProtectionField` component + room-create/edit pages
- Data model: extend `RoomConfig` with `protectedKeywords`
- Tests: unit + integration + performance (3 languages: EN, VI, JP)

## Non-Goals

- Encryption of keywords at rest (keywords are config data, not credentials)
- NLP/fuzzy matching (pure regex is sufficient and has no dependencies)
- Per-keyword enable/disable toggle (the whole feature is on/off at room level via `enabled`)
- Bulk import of keywords from file

---

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

All new tests pass. Existing rooms without `protectedKeywords` continue to work unchanged.

---

## Architecture & Data Flow

```
Chatwork webhook
      │
      ▼
 handler.ts
  roomConfig = store.getByOriginalRoomId(sourceRoomId)
      │
      ▼  [NEW]
 KeywordRedactor.mask(text, roomConfig.protectedKeywords ?? [])
  → { maskedText, restoreMap, systemHint }
      │
      ▼
 TranslationPipeline(maskedText, {
   translationStyle,
   roomContext,
   keywordSystemHint   ← NEW optional field
 })
  → buildPrompt() appends systemHint to system prompt
  → calls OpenAI / Gemini  (never sees original keywords)
      │
      ▼  [NEW]
 KeywordRedactor.restore(translatedText, restoreMap)
  → natural translation with originals restored
      │
      ▼
 post to destination Chatwork room
```

**Backward compatibility:** `protectedKeywords` is optional. When absent or empty, `KeywordRedactor` returns a no-op result and the pipeline is unchanged.

---

## Data Model

### New type: `KeywordEntry`

**File:** `packages/translator/src/types/keyword-entry.ts`

```typescript
export type KeywordCategory = 'company' | 'person' | 'project' | 'code' | 'other'

export interface KeywordEntry {
  keyword: string // e.g. "Asia Vion"
  category: KeywordCategory // e.g. "company"
  placeholder?: string // custom override, e.g. "PROJ_A"
  // auto-generated if absent: "[COMPANY_1]"
}
```

### Extended `RoomConfig`

**File:** `packages/translator/src/types/room-config.ts`

```typescript
export interface RoomConfig {
  // ... all existing fields unchanged ...
  protectedKeywords?: KeywordEntry[] // optional — backward compatible
}
```

### Zod schema (dashboard)

**File:** `packages/dashboard/src/lib/room-schema.ts`

```typescript
const keywordEntrySchema = z.object({
  keyword: z.string().min(1).max(100),
  category: z.enum(['company', 'person', 'project', 'code', 'other']),
  placeholder: z.string().max(50).optional(),
})

// Added to roomCreateSchema & roomEditSchema:
protectedKeywords: z.array(keywordEntrySchema).max(50).optional()
```

### Storage format (`room-configs.json`)

```json
{
  "version": 1,
  "rooms": [
    {
      "id": "a1b2c3d4-...",
      "originalRoomId": 123456789,
      "protectedKeywords": [
        { "keyword": "Asia Vion", "category": "company" },
        { "keyword": "CEO Tanaka", "category": "person" },
        { "keyword": "Project Phoenix", "category": "project", "placeholder": "PROJ_A" },
        { "keyword": "INV-2024-001", "category": "code" }
      ]
    },
    {
      "id": "b2c3d4e5-...",
      "originalRoomId": 111222333
      // no protectedKeywords → redactor is no-op
    }
  ]
}
```

---

## Backend: KeywordRedactor Engine

**File:** `packages/translator/src/services/keyword-redactor.ts`

### Auto-placeholder generation

| Category | Prefix  | Example (1st, 2nd)           |
| -------- | ------- | ---------------------------- |
| company  | COMPANY | `[COMPANY_1]`, `[COMPANY_2]` |
| person   | PERSON  | `[PERSON_1]`                 |
| project  | PROJECT | `[PROJECT_1]`                |
| code     | CODE    | `[CODE_1]`                   |
| other    | TERM    | `[TERM_1]`                   |

Custom `placeholder` field overrides auto-generation entirely.

### Smart regex matching (Option B)

For keyword `"Asia Vion"` generates alternatives:

```
Asia\s+Vion   (original, flexible whitespace)
AsiaVion      (no spaces — compound form)
Asia-Vion     (hyphen variant)
Asia_Vion     (underscore variant)
```

Combined into single case-insensitive regex: `/(?:Asia[\s\u3000]+Vion|AsiaVion|Asia-Vion|Asia_Vion)/gi`

`\u3000` (Japanese ideographic space) is included in whitespace class.

### Unicode normalization

Both input text and keyword are normalized to **NFC** before pattern matching to handle composed vs decomposed Unicode forms (critical for Vietnamese diacritics and Japanese):

```typescript
const normalizedText = text.normalize('NFC')
const normalizedKeyword = keyword.normalize('NFC')
```

`restoreMap` stores the original (pre-normalized) keyword to preserve the user's intended form.

### Ordering

Keywords are sorted **longest-first** before replacement to prevent partial-overlap bugs (e.g. `"Asia Vion Corp"` must be matched before `"Asia Vion"`).

### System hint injection

Added to AI system prompt so the AI understands placeholder semantics and translates naturally:

```
## Sensitive Term Placeholders
The following placeholders represent sensitive terms.
Preserve them UNCHANGED in your translation output.
- [COMPANY_1]: company or organization name (proper noun)
- [PERSON_1]: person name (proper noun)
- [PROJECT_1]: project or product name (proper noun)
- [CODE_1]: internal code, ID, or reference number
```

### Interface

```typescript
export interface RedactionResult {
  maskedText: string
  restoreMap: Map<string, string> // placeholder → original keyword
  systemHint: string // injected into AI system prompt
}

export class KeywordRedactor {
  static mask(text: string, keywords: KeywordEntry[]): RedactionResult
  static restore(text: string, restoreMap: Map<string, string>): string
}
```

---

## Frontend: KeywordProtectionField Component

**File:** `packages/dashboard/src/components/molecules/keyword-protection-field.tsx`

Follows `context-field.tsx` pattern: React Hook Form `Controller`, self-contained.

### UI Design (Variant F v5)

- **Header:** Yellow `#ffe19a` Neubrutalism banner with shield icon, keyword count badge, ENABLED toggle
- **Table rows:** Color-banded by category (company=blue, person=pink, project=green, code=yellow)
- **Row numbers:** Solid filled circles with `2px 2px 0 #1a1a2e` offset shadow
- **Type pills:** `border: 2px solid #1a1a2e` + `box-shadow: 2px 2px 0 #1a1a2e`
- **`[COMPANY_1]` badge:** Monospace, dark border + dark shadow
- **Add form:** 3 fields — keyword input + category dropdown (yellow bg) + custom placeholder (dashed, optional) + Add button
- **Info bar:** Purple hint about smart match behavior
- **Column headers:** `#` · `SENSITIVE TERM` · `CATEGORY` · `AI SEES` · delete

### Validation (client-side)

- Keyword: required, min 1, max 100 chars
- Duplicate check: case-insensitive, shows inline error
- Max 50 keywords per room
- Live placeholder preview in add form before submitting

### Integration

Added to both:

- `packages/dashboard/src/pages/room-create.tsx`
- `packages/dashboard/src/pages/room-detail.tsx`

Below the existing `ContextField`, separated by `ADVANCED SETTINGS` divider.

---

## Testing Plan

**File:** `packages/translator/src/services/keyword-redactor.test.ts`

### English test cases

```typescript
it('replaces keyword with auto-generated placeholder')
it('replaces keyword with custom placeholder')
it('EN: case-insensitive — "asia vion" matches "ASIA VION"')
it('EN: compound — "AsiaVion" matches keyword "Asia Vion"')
it('EN: hyphen — "asia-vion" matches keyword "Asia Vion"')
it('EN: underscore — "Asia_Vion" matches keyword "Asia Vion"')
it('EN: special regex chars — "C++ Team", "R&D Dept" do not break pattern')
```

### Vietnamese test cases

```typescript
it('VI: "Á Châu" matches "á châu", "Á CHÂU" via /i flag')
it('VI: NFC vs NFD — keyword stored NFC, message arrives NFD → still matches')
it('VI: full name "Nguyễn Văn An" → "[PERSON_1]" restored correctly')
it('VI: compound tones "ắc quy" not corrupted after round-trip')
it('VI: keyword mid-sentence — surrounding chars unaffected')
```

### Japanese test cases

```typescript
it('JP: kanji "田中社長" matches exactly')
it('JP: katakana "アジアビオン" matches "アジア ビオン" with \\s+')
it('JP: full-width space U+3000 "田中　太郎" matches "田中 太郎"')
it('JP+EN: mixed "Asia Vion株式会社" → "Asia Vion" matched correctly')
it('JP: nakaguro "プロジェクト・フェニックス" does not break regex')
```

### Multi-language

```typescript
it('mixed: EN+VI+JP in one message — all keywords replaced correctly')
it('round-trip: mask → mock translate → restore — all 3 languages intact')
```

### Edge cases

```typescript
it('empty keywords list → text unchanged, no-op')
it('longest keyword matched first — no partial-overlap bugs')
it('keyword appears multiple times in text → all replaced')
it('placeholder appears multiple times in translation → all restored')
it('room with no protectedKeywords field → no-op')
```

### Performance test

```typescript
it('50 keywords masked in < 100ms on long text (1000 chars)')
```

### Integration test

```typescript
// packages/translator/src/webhook/handler.test.ts
it(
  'full flow: message with sensitive keyword → AI call never contains original → Chatwork reply has original restored',
)
```

---

## Security Analysis

| Concern                              | Mitigation                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Sensitive keyword in AI request      | `KeywordRedactor.mask()` runs before any API call. Verified by integration test.       |
| Sensitive keyword in logs            | `restoreMap` is in-memory per-request, never serialized. Keywords not logged.          |
| Placeholder collision with real text | `[COMPANY_1]` format is unlikely in natural text; worst case is a benign false restore |
| Keywords in error messages           | Error handler receives `maskedText`, not original                                      |

---

## Files Changed

| File                                                                       | Change                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/translator/src/types/keyword-entry.ts`                           | **NEW** — `KeywordEntry`, `KeywordCategory` types |
| `packages/translator/src/types/room-config.ts`                             | Add `protectedKeywords?: KeywordEntry[]`          |
| `packages/translator/src/services/keyword-redactor.ts`                     | **NEW** — `KeywordRedactor` class                 |
| `packages/translator/src/services/keyword-redactor.test.ts`                | **NEW** — full test suite                         |
| `packages/translator/src/pipeline/pipeline.ts`                             | Accept optional `keywordSystemHint` in options    |
| `packages/translator/src/webhook/handler.ts`                               | Call mask/restore around pipeline                 |
| `packages/translation-prompt/src/translation-prompt.ts`                    | Append `keywordSystemHint` to system prompt       |
| `packages/dashboard/src/lib/room-schema.ts`                                | Add `keywordEntrySchema`, extend room schemas     |
| `packages/dashboard/src/components/molecules/keyword-protection-field.tsx` | **NEW** — UI component                            |
| `packages/dashboard/src/pages/room-create.tsx`                             | Add `KeywordProtectionField`                      |
| `packages/dashboard/src/pages/room-detail.tsx`                             | Add `KeywordProtectionField`                      |

---

## Risks & Open Items

- **Placeholder collision:** If user's actual message contains text like `[COMPANY_1]`, it would be incorrectly restored after translation. Mitigation: use a more unique format like `[[KW:COMPANY:1]]` — low risk, can be addressed in implementation.
- **Very long keywords (>50 chars):** Regex alternation could be slow — max 100 chars enforced by Zod.
- **50-keyword limit:** Arbitrary but reasonable. Can be raised without schema changes.

---

## Explicit Decisions Log

| Decision                   | Choice                                        | Source                   |
| -------------------------- | --------------------------------------------- | ------------------------ |
| Matching strategy          | B — Smart compound regex (no NLP)             | User confirmed           |
| Type/category system       | A — 5 predefined categories                   | User confirmed           |
| Placeholder context for AI | Type-aware `[COMPANY_1]` + system prompt hint | User-initiated insight   |
| Backend architecture       | A — Pipeline Middleware (KeywordRedactor)     | User confirmed           |
| Keyword storage            | Extend JSON file, no separate encryption      | AI-recommended, accepted |
| UI design                  | Variant F v5 — D rows + C numbers + E form    | User confirmed           |
| Unicode handling           | NFC normalize text + keyword before regex     | AI-recommended, accepted |
| Japanese whitespace        | Include `\u3000` in `\s` class                | AI-recommended, accepted |
| Test languages             | EN + Vietnamese + Japanese                    | User-initiated           |

---

## Future Scope (Deferred)

The following were confirmed out of scope for this implementation:

- Per-keyword enable/disable toggle
- Bulk import keywords from CSV
- Keyword usage analytics (how many times replaced per room)
- Encryption of keywords at rest
- Export/import keyword lists between rooms
