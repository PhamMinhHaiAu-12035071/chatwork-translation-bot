# Keyword Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-room sensitive keyword masking that replaces keywords with typed placeholders before AI translation and restores originals in the output, ensuring zero leakage to third-party providers.

**Architecture:** `KeywordRedactor` static class sits outside the pipeline — `mask()` runs on `cleanText` + each `translationInput` before `TranslationPipeline`, `restore()` runs on translated output. Pipeline receives an optional `keywordSystemHint` so the AI understands placeholder semantics.

**Tech Stack:** Bun · TypeScript strict · Zod · React + React Hook Form (dashboard) · `String.prototype.normalize('NFC')` for Unicode

---

## File Map

| File                                                                       | Action                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/translator/src/types/keyword-entry.ts`                           | **NEW** — `KeywordEntry`, `KeywordCategory` types + Zod schema         |
| `packages/translator/src/types/room-config.ts`                             | **MODIFY** — add `protectedKeywords?` to all three schemas             |
| `packages/dashboard/src/lib/api-types.ts`                                  | **MODIFY** — add `protectedKeywords?` to API types                     |
| `packages/translator/src/services/keyword-redactor.test.ts`                | **NEW** — full TDD test suite (EN + VI + JP)                           |
| `packages/translator/src/services/keyword-redactor.ts`                     | **NEW** — `KeywordRedactor` implementation                             |
| `packages/translation-prompt/src/translation-prompt.ts`                    | **MODIFY** — add optional `keywordSystemHint` parameter                |
| `packages/translator/src/pipeline/pipeline.ts`                             | **MODIFY** — accept `keywordSystemHint?` in constructor opts           |
| `packages/translator/src/webhook/handler.ts`                               | **MODIFY** — mask before pipeline, restore after                       |
| `packages/translator/src/webhook/handler.test.ts`                          | **MODIFY** — add integration test for full mask→translate→restore flow |
| `packages/dashboard/src/lib/room-schema.ts`                                | **MODIFY** — add `keywordEntrySchema`, extend create/edit schemas      |
| `packages/dashboard/src/components/molecules/keyword-protection-field.tsx` | **NEW** — Variant F v5 UI component                                    |
| `packages/dashboard/src/pages/room-create.tsx`                             | **MODIFY** — add `KeywordProtectionField`                              |
| `packages/dashboard/src/pages/room-detail.tsx`                             | **MODIFY** — add `KeywordProtectionField`                              |

---

## Task 1: Type Definitions

**Files:**

- Create: `packages/translator/src/types/keyword-entry.ts`
- Modify: `packages/translator/src/types/room-config.ts`
- Modify: `packages/dashboard/src/lib/api-types.ts`

- [ ] **Step 1: Create `keyword-entry.ts`**

```typescript
// packages/translator/src/types/keyword-entry.ts
import { z } from 'zod'

export const KEYWORD_CATEGORIES = ['company', 'person', 'project', 'code', 'other'] as const
export type KeywordCategory = (typeof KEYWORD_CATEGORIES)[number]

export const KeywordEntrySchema = z.object({
  keyword: z.string().min(1).max(100),
  category: z.enum(KEYWORD_CATEGORIES),
  placeholder: z.string().max(50).optional(),
})

export type KeywordEntry = z.infer<typeof KeywordEntrySchema>
```

- [ ] **Step 2: Extend `room-config.ts` — add `protectedKeywords` to all three schemas**

Add import at the top:

```typescript
import { KeywordEntrySchema } from '~/types/keyword-entry'
```

Inside `RoomConfigSchema`, after the `context` field:

```typescript
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
```

Inside `CreateRoomRequestSchema`, after the `context` field:

```typescript
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
```

Inside `UpdateRoomRequestSchema`, after the `context` field:

```typescript
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
```

Also add the `KeywordEntry` type re-export at the bottom:

```typescript
export type { KeywordEntry, KeywordCategory } from '~/types/keyword-entry'
```

- [ ] **Step 3: Extend `packages/dashboard/src/lib/api-types.ts` — add `protectedKeywords` to dashboard types**

Add to `RoomConfigPublic`:

```typescript
  protectedKeywords?: Array<{ keyword: string; category: string; placeholder?: string }>
```

Add to `CreateRoomInput`:

```typescript
  protectedKeywords?: Array<{ keyword: string; category: string; placeholder?: string }>
```

Add to `UpdateRoomInput`:

```typescript
  protectedKeywords?: Array<{ keyword: string; category: string; placeholder?: string }> | null
```

- [ ] **Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS (new optional fields don't break existing usage)

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/types/keyword-entry.ts \
        packages/translator/src/types/room-config.ts \
        packages/dashboard/src/lib/api-types.ts
git commit -m "feat(translator): add KeywordEntry types and extend RoomConfig schema"
```

---

## Task 2: KeywordRedactor — Write Tests First (TDD)

**Files:**

- Create: `packages/translator/src/services/keyword-redactor.test.ts`

- [ ] **Step 1: Create test file with all test cases**

```typescript
// packages/translator/src/services/keyword-redactor.test.ts
import { describe, it, expect } from 'bun:test'
import type { KeywordEntry } from '~/types/keyword-entry'
import { KeywordRedactor } from '~/services/keyword-redactor'

// --- helpers ---
function entry(
  keyword: string,
  category: KeywordEntry['category'],
  placeholder?: string,
): KeywordEntry {
  return placeholder ? { keyword, category, placeholder } : { keyword, category }
}

// ============================================================
// Basic masking
// ============================================================

describe('KeywordRedactor.mask — basic', () => {
  it('returns no-op result for empty keyword list', () => {
    const { maskedText, restoreMap, systemHint } = KeywordRedactor.mask('Hello Asia Vion', [])
    expect(maskedText).toBe('Hello Asia Vion')
    expect(restoreMap.size).toBe(0)
    expect(systemHint).toBe('')
  })

  it('replaces keyword with auto-generated placeholder', () => {
    const { maskedText } = KeywordRedactor.mask('Hello Asia Vion team', [
      entry('Asia Vion', 'company'),
    ])
    expect(maskedText).toBe('Hello [COMPANY_1] team')
  })

  it('replaces keyword with custom placeholder', () => {
    const { maskedText } = KeywordRedactor.mask('Project Phoenix is live', [
      entry('Project Phoenix', 'project', 'PROJ_A'),
    ])
    expect(maskedText).toBe('[PROJ_A] is live')
  })

  it('restoreMap maps placeholder back to original keyword', () => {
    const { restoreMap } = KeywordRedactor.mask('Asia Vion update', [entry('Asia Vion', 'company')])
    expect(restoreMap.get('[COMPANY_1]')).toBe('Asia Vion')
  })

  it('replaces all occurrences of a keyword in the text', () => {
    const { maskedText } = KeywordRedactor.mask('Asia Vion and Asia Vion again', [
      entry('Asia Vion', 'company'),
    ])
    expect(maskedText).toBe('[COMPANY_1] and [COMPANY_1] again')
  })

  it('multiple keywords get sequential placeholders per category', () => {
    const { maskedText } = KeywordRedactor.mask('Asia Vion and Beta Corp', [
      entry('Asia Vion', 'company'),
      entry('Beta Corp', 'company'),
    ])
    expect(maskedText).toContain('[COMPANY_1]')
    expect(maskedText).toContain('[COMPANY_2]')
  })

  it('placeholders across categories are independent counters', () => {
    const { maskedText } = KeywordRedactor.mask('Asia Vion CEO Tanaka', [
      entry('Asia Vion', 'company'),
      entry('CEO Tanaka', 'person'),
    ])
    expect(maskedText).toBe('[COMPANY_1] [PERSON_1]')
  })

  it('longest keyword matched first — no partial-overlap bugs', () => {
    const { maskedText } = KeywordRedactor.mask('Asia Vion Corp', [
      entry('Asia Vion', 'company'),
      entry('Asia Vion Corp', 'company'),
    ])
    // "Asia Vion Corp" must be fully replaced as [COMPANY_1], not partially as "[COMPANY_2] Corp"
    expect(maskedText).not.toContain('Corp')
    expect(maskedText).toContain('[COMPANY_1]')
  })

  it('placeholder assignment is deterministic — masking any segment gives same mapping', () => {
    const keywords = [entry('Asia Vion', 'company'), entry('Bob Smith', 'person')]
    const { restoreMap: mapFull } = KeywordRedactor.mask('Asia Vion met Bob Smith', keywords)
    const { restoreMap: mapSeg1 } = KeywordRedactor.mask('Asia Vion', keywords)
    const { restoreMap: mapSeg2 } = KeywordRedactor.mask('Bob Smith', keywords)
    // Same keywords → same placeholder assignments regardless of which text is masked
    expect(mapFull.get('[COMPANY_1]')).toBe(mapSeg1.get('[COMPANY_1]'))
    expect(mapFull.get('[PERSON_1]')).toBe(mapSeg2.get('[PERSON_1]'))
  })
})

// ============================================================
// Smart regex matching (EN)
// ============================================================

describe('KeywordRedactor.mask — EN smart matching', () => {
  it('case-insensitive — "asia vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = KeywordRedactor.mask('hello asia vion team', [
      entry('Asia Vion', 'company'),
    ])
    expect(maskedText).toBe('hello [COMPANY_1] team')
  })

  it('compound — "AsiaVion" matches keyword "Asia Vion"', () => {
    const { maskedText } = KeywordRedactor.mask('AsiaVion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('hyphen — "Asia-Vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = KeywordRedactor.mask('Asia-Vion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('underscore — "Asia_Vion" matches keyword "Asia Vion"', () => {
    const { maskedText } = KeywordRedactor.mask('Asia_Vion update', [entry('Asia Vion', 'company')])
    expect(maskedText).toBe('[COMPANY_1] update')
  })

  it('special regex chars — "C++ Team" does not break pattern', () => {
    const fn = () => KeywordRedactor.mask('C++ Team standup', [entry('C++ Team', 'project')])
    expect(fn).not.toThrow()
    const { maskedText } = fn()
    expect(maskedText).toBe('[PROJECT_1] standup')
  })

  it('special regex chars — "R&D Dept" does not break pattern', () => {
    const fn = () => KeywordRedactor.mask('R&D Dept update', [entry('R&D Dept', 'other')])
    expect(fn).not.toThrow()
    const { maskedText } = fn()
    expect(maskedText).toBe('[TERM_1] update')
  })
})

// ============================================================
// Vietnamese
// ============================================================

describe('KeywordRedactor.mask — Vietnamese', () => {
  it('"Á Châu" matches "á châu" via /i flag', () => {
    const { maskedText } = KeywordRedactor.mask('tin tức á châu hôm nay', [
      entry('Á Châu', 'company'),
    ])
    expect(maskedText).toBe('tin tức [COMPANY_1] hôm nay')
  })

  it('"Á Châu" matches "Á CHÂU" via /i flag', () => {
    const { maskedText } = KeywordRedactor.mask('Á CHÂU Corp', [entry('Á Châu', 'company')])
    expect(maskedText).toBe('[COMPANY_1] Corp')
  })

  it('NFC vs NFD — keyword stored NFC, message arrives NFD → still matches', () => {
    // NFD: character decomposed (e.g., Á = A + combining acute)
    const nfdText = 'Ông Nguyễn Văn An báo cáo'.normalize('NFD')
    const { maskedText } = KeywordRedactor.mask(nfdText, [entry('Nguyễn Văn An', 'person')])
    expect(maskedText).toContain('[PERSON_1]')
    expect(maskedText).not.toContain('Nguyễn Văn An')
  })

  it('full name "Nguyễn Văn An" → restored correctly after round-trip', () => {
    const original = 'Báo cáo từ Nguyễn Văn An hôm nay'
    const { maskedText, restoreMap } = KeywordRedactor.mask(original, [
      entry('Nguyễn Văn An', 'person'),
    ])
    const restored = KeywordRedactor.restore(maskedText, restoreMap)
    expect(restored).toBe(original)
  })

  it('compound tones "ắc quy" not corrupted after round-trip', () => {
    const original = 'Dự án ắc quy lithium đang tiến hành'
    const { maskedText, restoreMap } = KeywordRedactor.mask(original, [entry('ắc quy', 'project')])
    const restored = KeywordRedactor.restore(maskedText, restoreMap)
    expect(restored).toBe(original)
  })

  it('keyword mid-sentence — surrounding characters unaffected', () => {
    const { maskedText } = KeywordRedactor.mask('Xin chào Nguyễn Văn An, bạn khỏe không?', [
      entry('Nguyễn Văn An', 'person'),
    ])
    expect(maskedText).toBe('Xin chào [PERSON_1], bạn khỏe không?')
  })
})

// ============================================================
// Japanese
// ============================================================

describe('KeywordRedactor.mask — Japanese', () => {
  it('kanji "田中社長" matches exactly', () => {
    const { maskedText } = KeywordRedactor.mask('田中社長からのメッセージ', [
      entry('田中社長', 'person'),
    ])
    expect(maskedText).toBe('[PERSON_1]からのメッセージ')
  })

  it('full-width space U+3000 "田中\u3000太郎" matches "田中 太郎"', () => {
    const { maskedText } = KeywordRedactor.mask('田中\u3000太郎さんへ', [
      entry('田中 太郎', 'person'),
    ])
    expect(maskedText).toBe('[PERSON_1]さんへ')
  })

  it('mixed "Asia Vion株式会社" — keyword "Asia Vion" matched correctly', () => {
    const { maskedText } = KeywordRedactor.mask('Asia Vion株式会社の報告', [
      entry('Asia Vion', 'company'),
    ])
    expect(maskedText).toBe('[COMPANY_1]株式会社の報告')
  })
})

// ============================================================
// Multi-language
// ============================================================

describe('KeywordRedactor.mask — multi-language', () => {
  it('EN+VI+JP in one message — all keywords replaced correctly', () => {
    const text = 'Asia Vion: Nguyễn Văn An 様, 田中社長 approved.'
    const { maskedText } = KeywordRedactor.mask(text, [
      entry('Asia Vion', 'company'),
      entry('Nguyễn Văn An', 'person'),
      entry('田中社長', 'person'),
    ])
    expect(maskedText).toBe('[COMPANY_1]: [PERSON_1] 様, [PERSON_2] approved.')
  })

  it('round-trip: mask → simulated translate → restore — all 3 languages intact', () => {
    const original = 'Asia Vion: Nguyễn Văn An và 田中社長 đã xác nhận.'
    const keywords = [
      entry('Asia Vion', 'company'),
      entry('Nguyễn Văn An', 'person'),
      entry('田中社長', 'person'),
    ]
    const { maskedText, restoreMap } = KeywordRedactor.mask(original, keywords)

    // Simulate: "AI" translates but preserves placeholders
    const simulatedTranslation = maskedText.replace(
      '[COMPANY_1]: [PERSON_1] và [PERSON_2] đã xác nhận.',
      '[COMPANY_1]: [PERSON_1] và [PERSON_2] đã xác nhận.',
    )

    const restored = KeywordRedactor.restore(simulatedTranslation, restoreMap)
    expect(restored).toContain('Asia Vion')
    expect(restored).toContain('Nguyễn Văn An')
    expect(restored).toContain('田中社長')
  })
})

// ============================================================
// restore()
// ============================================================

describe('KeywordRedactor.restore', () => {
  it('placeholder appears multiple times in translation → all restored', () => {
    const map = new Map([['[COMPANY_1]', 'Asia Vion']])
    const result = KeywordRedactor.restore('[COMPANY_1] and [COMPANY_1] again', map)
    expect(result).toBe('Asia Vion and Asia Vion again')
  })

  it('empty restoreMap → text unchanged', () => {
    const result = KeywordRedactor.restore('hello world', new Map())
    expect(result).toBe('hello world')
  })
})

// ============================================================
// systemHint
// ============================================================

describe('KeywordRedactor.mask — systemHint', () => {
  it('generates systemHint with all placeholders and their category descriptions', () => {
    const { systemHint } = KeywordRedactor.mask('Asia Vion CEO Tanaka', [
      entry('Asia Vion', 'company'),
      entry('CEO Tanaka', 'person'),
    ])
    expect(systemHint).toContain('[COMPANY_1]')
    expect(systemHint).toContain('company or organization name')
    expect(systemHint).toContain('[PERSON_1]')
    expect(systemHint).toContain('person name')
  })

  it('empty systemHint for empty keyword list', () => {
    const { systemHint } = KeywordRedactor.mask('hello', [])
    expect(systemHint).toBe('')
  })
})

// ============================================================
// Performance
// ============================================================

describe('KeywordRedactor — performance', () => {
  it('50 keywords masked in < 100ms on 1000-char text', () => {
    const keywords: KeywordEntry[] = Array.from({ length: 50 }, (_, i) => ({
      keyword: `Keyword${i.toString().padStart(2, '0')}`,
      category: 'company' as const,
    }))
    const text = 'Lorem ipsum dolor sit amet '.repeat(40) // ~1000 chars
    const start = performance.now()
    KeywordRedactor.mask(text, keywords)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)
  })
})
```

- [ ] **Step 2: Run tests to confirm they all FAIL (service not yet implemented)**

```bash
cd packages/translator && bun test src/services/keyword-redactor.test.ts
```

Expected: FAIL with "Cannot find module '~/services/keyword-redactor'"

---

## Task 3: KeywordRedactor — Implementation

**Files:**

- Create: `packages/translator/src/services/keyword-redactor.ts`

- [ ] **Step 1: Create the implementation**

```typescript
// packages/translator/src/services/keyword-redactor.ts
import type { KeywordEntry, KeywordCategory } from '~/types/keyword-entry'

export interface RedactionResult {
  maskedText: string
  restoreMap: Map<string, string> // placeholder → original keyword
  systemHint: string
}

const CATEGORY_PREFIX: Record<KeywordCategory, string> = {
  company: 'COMPANY',
  person: 'PERSON',
  project: 'PROJECT',
  code: 'CODE',
  other: 'TERM',
}

const CATEGORY_DESCRIPTION: Record<KeywordCategory, string> = {
  company: 'company or organization name (proper noun)',
  person: 'person name (proper noun)',
  project: 'project or product name (proper noun)',
  code: 'internal code, ID, or reference number',
  other: 'sensitive term (proper noun or internal reference)',
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(normalizedKeyword: string): RegExp {
  const escaped = escapeRegex(normalizedKeyword)
  // Split on whitespace to detect multi-word keywords
  const parts = escaped.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return new RegExp(escaped, 'gi')
  }
  // Generate variants: flexible-space, compound (no space), hyphen, underscore
  const variants = [
    parts.join('[\\s\\u3000]+'), // flexible whitespace incl. Japanese U+3000
    parts.join(''), // compound "AsiaVion"
    parts.join('-'), // hyphen "Asia-Vion"
    parts.join('_'), // underscore "Asia_Vion"
  ]
  return new RegExp(`(?:${variants.join('|')})`, 'gi')
}

function buildSystemHint(
  entries: Array<{ placeholder: string; category: KeywordCategory }>,
): string {
  if (entries.length === 0) return ''
  const lines = entries.map(
    ({ placeholder, category }) => `- ${placeholder}: ${CATEGORY_DESCRIPTION[category]}`,
  )
  return [
    '## Sensitive Term Placeholders',
    'The following placeholders represent sensitive terms.',
    'Preserve them UNCHANGED in your translation output.',
    ...lines,
  ].join('\n')
}

export class KeywordRedactor {
  /**
   * Masks sensitive keywords in `text` with typed placeholders.
   *
   * Placeholder assignment is deterministic (based on position in sorted keyword
   * array, not order of first occurrence in text). This means calling mask() on
   * any text with the same keyword list produces identical restoreMap entries —
   * safe to use a single restoreMap for restoring multiple segments.
   */
  static mask(text: string, keywords: KeywordEntry[]): RedactionResult {
    if (keywords.length === 0) {
      return { maskedText: text, restoreMap: new Map(), systemHint: '' }
    }

    // Sort longest-first to prevent partial-overlap bugs
    const sorted = [...keywords].sort(
      (a, b) => b.keyword.normalize('NFC').length - a.keyword.normalize('NFC').length,
    )

    // Assign placeholders by position in sorted array (deterministic)
    const counters: Partial<Record<string, number>> = {}
    const entries = sorted.map((entry) => {
      const prefix = CATEGORY_PREFIX[entry.category]
      counters[prefix] = (counters[prefix] ?? 0) + 1
      const placeholder = entry.placeholder ?? `[${prefix}_${counters[prefix]}]`
      return {
        placeholder,
        original: entry.keyword, // preserve original (pre-normalization) for restore
        category: entry.category,
        pattern: buildPattern(entry.keyword.normalize('NFC')),
      }
    })

    // Apply masking on NFC-normalized text
    const normalizedText = text.normalize('NFC')
    let maskedText = normalizedText
    for (const { pattern, placeholder } of entries) {
      maskedText = maskedText.replace(pattern, placeholder)
    }

    // Build restoreMap: placeholder → original keyword
    const restoreMap = new Map<string, string>()
    for (const { placeholder, original } of entries) {
      restoreMap.set(placeholder, original)
    }

    return { maskedText, restoreMap, systemHint: buildSystemHint(entries) }
  }

  /**
   * Restores all placeholders in `text` back to their original keywords.
   */
  static restore(text: string, restoreMap: Map<string, string>): string {
    if (restoreMap.size === 0) return text
    let result = text
    for (const [placeholder, original] of restoreMap) {
      result = result.replaceAll(placeholder, original)
    }
    return result
  }
}
```

- [ ] **Step 2: Run all keyword-redactor tests**

```bash
cd packages/translator && bun test src/services/keyword-redactor.test.ts
```

Expected: All tests PASS

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
bun test && bun run typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/services/keyword-redactor.ts \
        packages/translator/src/services/keyword-redactor.test.ts
git commit -m "feat(translator): implement KeywordRedactor with EN/VI/JP smart regex matching"
```

---

## Task 4: translation-prompt — Add `keywordSystemHint`

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`

The `systemHint` from `KeywordRedactor.mask()` needs to be appended to the AI system prompt so the model understands placeholder semantics and keeps them intact.

- [ ] **Step 1: Write failing test** (add to existing prompt test file or inline)

```bash
cd packages/translation-prompt && bun test
```

Check if a test file exists for the prompt. If it does, add a test. If not, create one:

```typescript
// packages/translation-prompt/src/translation-prompt.test.ts (if doesn't exist)
import { describe, it, expect } from 'bun:test'
import { buildSingleCallPrompts, buildStructuredTranslationPrompts } from '~/translation-prompt'

describe('buildSingleCallPrompts — keywordSystemHint', () => {
  it('appends keywordSystemHint to system prompt when provided', () => {
    const { system } = buildSingleCallPrompts(
      'hello',
      'PROFESSIONAL_BUSINESS',
      undefined,
      '## Sensitive Term Placeholders\n- [COMPANY_1]: company or organization name',
    )
    expect(system).toContain('## Sensitive Term Placeholders')
    expect(system).toContain('[COMPANY_1]')
  })

  it('system prompt unchanged when keywordSystemHint is absent', () => {
    const { system: withHint } = buildSingleCallPrompts(
      'hello',
      'PROFESSIONAL_BUSINESS',
      undefined,
      '## Hint',
    )
    const { system: withoutHint } = buildSingleCallPrompts('hello', 'PROFESSIONAL_BUSINESS')
    expect(withHint.length).toBeGreaterThan(withoutHint.length)
  })
})

describe('buildStructuredTranslationPrompts — keywordSystemHint', () => {
  it('appends keywordSystemHint to system prompt when provided', () => {
    const { system } = buildStructuredTranslationPrompts(
      ['hello'],
      'PROFESSIONAL_BUSINESS',
      undefined,
      undefined,
      '## Sensitive Term Placeholders\n- [PERSON_1]: person name',
    )
    expect(system).toContain('[PERSON_1]')
  })
})
```

- [ ] **Step 2: Run test to confirm FAIL**

```bash
cd packages/translation-prompt && bun test
```

Expected: FAIL (extra parameter not yet accepted)

- [ ] **Step 3: Modify `translation-prompt.ts`**

Change `buildStructuredTranslationPrompts` signature:

```typescript
export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  fullMessageContext?: string,
  roomContext?: string,
  keywordSystemHint?: string, // ← ADD
): PromptPair {
  const contextSection = buildContextSection(roomContext)
  const systemParts = [
    SHARED_SYSTEM,
    contextSection,
    buildTranslationStyleSection(style),
    keywordSystemHint ?? '', // ← ADD
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    system: systemParts,
    user: buildStructuredUserPrompt(segments, style, fullMessageContext),
  }
}
```

Change `buildSingleCallPrompts` signature:

```typescript
export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string,
  keywordSystemHint?: string, // ← ADD
): PromptPair {
  const contextSection = buildContextSection(roomContext)
  const systemParts = [
    SHARED_SYSTEM,
    contextSection,
    buildTranslationStyleSection(style),
    keywordSystemHint ?? '', // ← ADD
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    system: systemParts,
    user: buildSingleUserPrompt(text, style),
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/translation-prompt && bun test && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts \
        packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(translation-prompt): add optional keywordSystemHint to system prompt"
```

---

## Task 5: pipeline.ts — Thread `keywordSystemHint` to Prompt Builders

**Files:**

- Modify: `packages/translator/src/pipeline/pipeline.ts`

- [ ] **Step 1: Add `keywordSystemHint?` to constructor opts**

In `TranslationPipeline` constructor signature, change:

```typescript
  private readonly opts: {
    timeoutMs?: number
    translationStyle?: TranslationStyle
    roomContext?: string
    keywordSystemHint?: string   // ← ADD
  } = {},
```

- [ ] **Step 2: Thread hint to single-segment call (line ~73)**

Change:

```typescript
const prompts = buildSingleCallPrompts(sourceText, style, this.opts.roomContext)
```

To:

```typescript
const prompts = buildSingleCallPrompts(
  sourceText,
  style,
  this.opts.roomContext,
  this.opts.keywordSystemHint, // ← ADD
)
```

- [ ] **Step 3: Thread hint to multi-segment call (line ~91)**

Change:

```typescript
const prompts = buildStructuredTranslationPrompts(
  input.translationInputs,
  style,
  input.cleanText,
  this.opts.roomContext,
)
```

To:

```typescript
const prompts = buildStructuredTranslationPrompts(
  input.translationInputs,
  style,
  input.cleanText,
  this.opts.roomContext,
  this.opts.keywordSystemHint, // ← ADD
)
```

- [ ] **Step 4: Run typecheck + tests**

```bash
bun test && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/pipeline/pipeline.ts
git commit -m "feat(translator): thread keywordSystemHint through TranslationPipeline to prompts"
```

---

## Task 6: handler.ts — Mask Before Pipeline, Restore After

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`

- [ ] **Step 1: Add import for `KeywordRedactor` at top of handler.ts**

```typescript
import { KeywordRedactor } from '~/services/keyword-redactor'
import type { TranslationResult } from '@chatwork-bot/core'
```

(The `TranslationResult` import may already exist — check and only add if missing.)

- [ ] **Step 2: Replace the `pipelineOpts` block with mask + pipeline + restore**

Find this block (around line 214):

```typescript
    try {
      const pipelineOpts: {
        timeoutMs: number
        translationStyle: typeof translationStyle
        roomContext?: string
      } = {
        timeoutMs: effectiveTimeoutMs,
        translationStyle,
      }
      if (roomConfig.context) {
        pipelineOpts.roomContext = roomConfig.context
      }
      const pipeline = new TranslationPipeline(executor, pipelineOpts)
      const pipelineResult = await pipeline.runStructured(
        {
          cleanText,
          translationInputs: command.translationInputs,
        },
        { ... },
      )

      const result = pipelineResult.translation
```

Replace with:

```typescript
    try {
      // Mask sensitive keywords before any AI call
      const keywords = roomConfig.protectedKeywords ?? []
      const { maskedText, restoreMap, systemHint } = KeywordRedactor.mask(cleanText, keywords)
      const maskedTranslationInputs = command.translationInputs.map(
        (segment) => KeywordRedactor.mask(segment, keywords).maskedText,
      )

      const pipelineOpts: {
        timeoutMs: number
        translationStyle: typeof translationStyle
        roomContext?: string
        keywordSystemHint?: string
      } = {
        timeoutMs: effectiveTimeoutMs,
        translationStyle,
      }
      if (roomConfig.context) {
        pipelineOpts.roomContext = roomConfig.context
      }
      if (systemHint) {
        pipelineOpts.keywordSystemHint = systemHint
      }
      const pipeline = new TranslationPipeline(executor, pipelineOpts)
      const pipelineResult = await pipeline.runStructured(
        {
          cleanText: maskedText,
          translationInputs: maskedTranslationInputs,
        },
        { ... },  // keep the existing phaseObserver block unchanged
      )

      // Restore original keywords in translated output
      const result: TranslationResult = {
        ...pipelineResult.translation,
        cleanText,  // restore unmasked original
        translatedText: KeywordRedactor.restore(
          pipelineResult.translation.translatedText,
          restoreMap,
        ),
      }
      const restoredTranslatedSegments = pipelineResult.translatedSegments.map((seg) =>
        KeywordRedactor.restore(seg, restoreMap),
      )
```

- [ ] **Step 3: Update the `sendTranslatedMessage` call to use restored segments**

Find:

```typescript
const deliveryResult = await sendTranslatedMessage(command, result, {
  apiToken: deps.chatworkApiToken,
  destinationRoomId: roomConfig.destinationRoomId,
  translatedSegments: pipelineResult.translatedSegments,
})
```

Replace with:

```typescript
const deliveryResult = await sendTranslatedMessage(command, result, {
  apiToken: deps.chatworkApiToken,
  destinationRoomId: roomConfig.destinationRoomId,
  translatedSegments: restoredTranslatedSegments,
})
```

- [ ] **Step 4: Run typecheck + tests**

```bash
bun test && bun run typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/webhook/handler.ts
git commit -m "feat(translator): mask sensitive keywords before AI call, restore in translated output"
```

---

## Task 7: Integration Test — Full Mask→Translate→Restore Flow

**Files:**

- Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 1: Find the handler test file and understand its mocking pattern**

```bash
head -80 packages/translator/src/webhook/handler.test.ts
```

- [ ] **Step 2: Add integration test for the full keyword protection flow**

Add this test to `handler.test.ts` (in the appropriate `describe` block):

```typescript
it('full flow: message with sensitive keyword → AI call never contains original → Chatwork reply has original restored', async () => {
  // Arrange: room config with one protected keyword
  const mockStore = createMockStore({
    protectedKeywords: [{ keyword: 'Asia Vion', category: 'company' }],
  })

  // Capture what the AI executor receives
  let capturedPrompt: string | undefined
  const mockExecutor = createMockExecutor((prompt) => {
    capturedPrompt = prompt
    // AI returns translated text with placeholder preserved
    return Promise.resolve({
      translated: 'Báo cáo từ [COMPANY_1] đã sẵn sàng',
      sourceLang: 'English',
    })
  })

  // Capture what was sent to Chatwork
  let sentMessage: string | undefined
  const mockChatworkSend = (msg: string) => {
    sentMessage = msg
  }

  // Act
  await handleTranslateRequest({
    translatableText: 'Report from Asia Vion is ready',
    translationInputs: ['Report from Asia Vion is ready'],
    // ... other required command fields
  })

  // Assert: AI never sees the original keyword
  expect(capturedPrompt).toBeDefined()
  expect(capturedPrompt).not.toContain('Asia Vion')
  expect(capturedPrompt).toContain('[COMPANY_1]')

  // Assert: Chatwork message has original keyword restored
  expect(sentMessage).toBeDefined()
  expect(sentMessage).toContain('Asia Vion')
  expect(sentMessage).not.toContain('[COMPANY_1]')
})
```

> **Note:** Adapt the mock helper calls (`createMockStore`, `createMockExecutor`, etc.) to match the existing test patterns in `handler.test.ts`. Read the file first to understand what mocks are already in place.

- [ ] **Step 3: Run the integration test**

```bash
cd packages/translator && bun test src/webhook/handler.test.ts
```

Expected: PASS

- [ ] **Step 4: Run full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/webhook/handler.test.ts
git commit -m "test(translator): add integration test for keyword mask→translate→restore flow"
```

---

## Task 8: Dashboard Schema — Add `protectedKeywords`

**Files:**

- Modify: `packages/dashboard/src/lib/room-schema.ts`

- [ ] **Step 1: Add `keywordEntrySchema` and extend both create/edit schemas**

```typescript
// Add at top of room-schema.ts, after existing imports:
const keywordEntrySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Max 100 characters'),
  category: z.enum(['company', 'person', 'project', 'code', 'other'] as const),
  placeholder: z.string().max(50, 'Max 50 characters').optional(),
})

export type KeywordEntryFormInput = z.infer<typeof keywordEntrySchema>
```

In `roomCreateSchema`, add after the `context` field:

```typescript
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').optional().default([]),
```

In `roomEditSchema`, add after the `context` field:

```typescript
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').optional().default([]),
```

Update both type exports to include the new field (they are auto-derived via `z.infer`, so no change needed to the `export type` lines).

- [ ] **Step 2: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/lib/room-schema.ts
git commit -m "feat(dashboard): add protectedKeywords to room create/edit schemas"
```

---

## Task 9: KeywordProtectionField Component

**Files:**

- Create: `packages/dashboard/src/components/molecules/keyword-protection-field.tsx`

The component follows the `ContextField` pattern: takes `{ value, onChange }` directly (no Controller wrapper needed — the page handles the React Hook Form integration).

Design: Variant F v5 — yellow #ffe19a hero header, color-banded rows by category, filled-circle row numbers with dark shadow, type pills with dark border + shadow, `[PLACEHOLDER]` monospace badge, 3-field add form, purple info bar.

- [ ] **Step 1: Create the component**

```typescript
// packages/dashboard/src/components/molecules/keyword-protection-field.tsx
import { useState } from 'react'
import type { KeywordEntryFormInput } from '~/lib/room-schema'

type KeywordCategory = 'company' | 'person' | 'project' | 'code' | 'other'

interface KeywordProtectionFieldProps {
  value: KeywordEntryFormInput[]
  onChange: (value: KeywordEntryFormInput[]) => void
}

// ── Category config ────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  KeywordCategory,
  { label: string; bg: string; accent: string; number: string }
> = {
  company: { label: 'COMPANY',  bg: '#dbeafe', accent: '#61b7e8', number: '#1d6c9f' },
  person:  { label: 'PERSON',   bg: '#fce7f3', accent: '#d44470', number: '#9b2556' },
  project: { label: 'PROJECT',  bg: '#dcfce7', accent: '#a1cf8e', number: '#3d8a50' },
  code:    { label: 'CODE',     bg: '#fef9c3', accent: '#d4ac0d', number: '#7a6200' },
  other:   { label: 'OTHER',    bg: '#f3f4f6', accent: '#9ca3af', number: '#4b5563' },
}

const CATEGORY_PREFIX: Record<KeywordCategory, string> = {
  company: 'COMPANY',
  person:  'PERSON',
  project: 'PROJECT',
  code:    'CODE',
  other:   'TERM',
}

function getAutoPlaceholder(category: KeywordCategory, index: number): string {
  return `[${CATEGORY_PREFIX[category]}_${(index + 1).toString()}]`
}

function getEffectivePlaceholder(entry: KeywordEntryFormInput, indexInCategory: number): string {
  return entry.placeholder?.trim() || getAutoPlaceholder(entry.category as KeywordCategory, indexInCategory)
}

// ── Component ─────────────────────────────────────────────────────
export function KeywordProtectionField({ value, onChange }: KeywordProtectionFieldProps) {
  const [isOpen, setIsOpen] = useState(value.length > 0)
  const [internalKeywords, setInternalKeywords] = useState<KeywordEntryFormInput[]>(value)

  // Add-form state
  const [addKeyword, setAddKeyword] = useState('')
  const [addCategory, setAddCategory] = useState<KeywordCategory>('company')
  const [addPlaceholder, setAddPlaceholder] = useState('')
  const [addError, setAddError] = useState('')

  function handleToggle() {
    const next = !isOpen
    setIsOpen(next)
    if (next) {
      onChange(internalKeywords)
    } else {
      onChange([])
    }
  }

  function handleAdd() {
    const trimmed = addKeyword.trim()
    if (!trimmed) {
      setAddError('Keyword is required')
      return
    }
    if (trimmed.length > 100) {
      setAddError('Max 100 characters')
      return
    }
    const duplicate = internalKeywords.some(
      (k) => k.keyword.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) {
      setAddError('Keyword already exists (case-insensitive)')
      return
    }
    if (internalKeywords.length >= 50) {
      setAddError('Maximum 50 keywords reached')
      return
    }

    const entry: KeywordEntryFormInput = {
      keyword: trimmed,
      category: addCategory,
      ...(addPlaceholder.trim() ? { placeholder: addPlaceholder.trim() } : {}),
    }

    const next = [...internalKeywords, entry]
    setInternalKeywords(next)
    if (isOpen) onChange(next)

    setAddKeyword('')
    setAddPlaceholder('')
    setAddError('')
  }

  function handleRemove(index: number) {
    const next = internalKeywords.filter((_, i) => i !== index)
    setInternalKeywords(next)
    if (isOpen) onChange(next)
  }

  // Compute category-indexed placeholders for display
  const categoryCounts: Partial<Record<KeywordCategory, number>> = {}
  const keywordsWithPlaceholder = internalKeywords.map((entry) => {
    const cat = entry.category as KeywordCategory
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    return {
      ...entry,
      effectivePlaceholder: getEffectivePlaceholder(entry, (categoryCounts[cat] ?? 1) - 1),
    }
  })

  // Preview placeholder for add form
  const previewCounts = { ...categoryCounts }
  const previewIdx = previewCounts[addCategory] ?? 0
  const previewPlaceholder =
    addPlaceholder.trim() ||
    `[${CATEGORY_PREFIX[addCategory]}_${(previewIdx + 1).toString()}]`

  return (
    <div>
      {/* ── Header Banner ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: isOpen ? '#ffe19a' : '#fffbeb',
          border: '3px solid #1a1a2e',
          borderRadius: 12,
          boxShadow: isOpen ? '4px 4px 0 #1a1a2e' : '3px 3px 0 #1a1a2e',
          cursor: 'pointer',
          transform: isOpen ? 'translate(-1px,-1px)' : 'none',
          transition: 'all 0.12s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '2px solid #1a1a2e',
              background: '#ffe19a',
              boxShadow: '2px 2px 0 #1a1a2e',
              fontSize: '1rem',
            }}
            aria-hidden
          >
            🛡️
          </span>
          <span>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-heading, inherit)',
                fontSize: '0.875rem',
                fontWeight: 800,
                color: '#1a1a2e',
              }}
            >
              Keyword Protection
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-ui-body, inherit)',
                fontSize: '0.72rem',
                color: '#4b5563',
              }}
            >
              {isOpen
                ? `${internalKeywords.length.toString()} keyword${internalKeywords.length === 1 ? '' : 's'} protected`
                : 'Mask sensitive terms before sending to AI'}
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* keyword count badge */}
          {internalKeywords.length > 0 && (
            <span
              style={{
                padding: '2px 8px',
                border: '2px solid #1a1a2e',
                borderRadius: 999,
                background: '#ffe19a',
                boxShadow: '2px 2px 0 #1a1a2e',
                fontFamily: 'var(--font-heading, inherit)',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#1a1a2e',
              }}
            >
              {internalKeywords.length} / 50
            </span>
          )}
          {/* enabled/disabled pill */}
          <span
            style={{
              padding: '3px 10px',
              border: '2px solid #1a1a2e',
              borderRadius: 999,
              background: isOpen ? '#a1cf8e' : '#f3f4f6',
              boxShadow: '2px 2px 0 #1a1a2e',
              fontFamily: 'var(--font-heading, inherit)',
              fontSize: '0.65rem',
              fontWeight: 800,
              color: '#1a1a2e',
              letterSpacing: '0.08em',
            }}
          >
            {isOpen ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </button>

      {/* ── Expanded Panel ────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            marginTop: 10,
            border: '2px dashed rgba(26,26,46,0.35)',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.6)',
            padding: 14,
          }}
        >
          {/* Keywords table */}
          {internalKeywords.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {/* Column headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 120px 120px 32px',
                  gap: 8,
                  padding: '4px 8px 6px',
                  borderBottom: '2px solid #1a1a2e',
                  marginBottom: 4,
                }}
              >
                {['#', 'SENSITIVE TERM', 'CATEGORY', 'AI SEES', ''].map((col) => (
                  <span
                    key={col}
                    style={{
                      fontFamily: 'var(--font-heading, inherit)',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      color: '#6b7280',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {col}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {keywordsWithPlaceholder.map((entry, index) => {
                const cat = entry.category as KeywordCategory
                const cfg = CATEGORY_CONFIG[cat]
                return (
                  <div
                    key={`${entry.keyword}-${index.toString()}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr 120px 120px 32px',
                      gap: 8,
                      alignItems: 'center',
                      padding: '7px 8px',
                      background: cfg.bg,
                      borderRadius: 8,
                      border: '1.5px solid rgba(26,26,46,0.12)',
                      marginBottom: 4,
                    }}
                  >
                    {/* Row number */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: '2px solid #1a1a2e',
                        background: cfg.number,
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        boxShadow: '2px 2px 0 #1a1a2e',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Keyword */}
                    <span
                      style={{
                        fontFamily: 'var(--font-heading, inherit)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.keyword}
                    </span>

                    {/* Category pill */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        border: '2px solid #1a1a2e',
                        borderRadius: 999,
                        background: cfg.accent,
                        boxShadow: '2px 2px 0 #1a1a2e',
                        fontFamily: 'var(--font-heading, inherit)',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        color: '#1a1a2e',
                        letterSpacing: '0.08em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 110,
                      }}
                    >
                      {cfg.label}
                    </span>

                    {/* Placeholder badge */}
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        padding: '2px 6px',
                        border: '2px solid #1a1a2e',
                        borderRadius: 6,
                        background: '#fff',
                        boxShadow: '2px 2px 0 #1a1a2e',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 110,
                      }}
                      title={entry.effectivePlaceholder}
                    >
                      {entry.effectivePlaceholder}
                    </span>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => { handleRemove(index) }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: '2px solid #1a1a2e',
                        borderRadius: 6,
                        background: '#fff',
                        boxShadow: '2px 2px 0 #1a1a2e',
                        cursor: 'pointer',
                        color: '#d44470',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                      aria-label={`Remove keyword ${entry.keyword}`}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add form */}
          <div
            style={{
              border: '2px solid rgba(26,26,46,0.25)',
              borderRadius: 10,
              padding: 12,
              background: '#fffbeb',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-heading, inherit)',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#6b7280',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Add Keyword
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px auto', gap: 8 }}>
              {/* Keyword input */}
              <input
                type="text"
                value={addKeyword}
                onChange={(e) => { setAddKeyword(e.target.value); setAddError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                placeholder="e.g. Asia Vion"
                maxLength={100}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #1a1a2e',
                  borderRadius: 8,
                  background: '#fff',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'var(--font-ui-body, inherit)',
                  fontSize: '0.8rem',
                  color: '#1a1a2e',
                  outline: 'none',
                }}
              />

              {/* Category dropdown */}
              <select
                value={addCategory}
                onChange={(e) => { setAddCategory(e.target.value as KeywordCategory) }}
                style={{
                  padding: '8px 10px',
                  border: '2px solid #1a1a2e',
                  borderRadius: 8,
                  background: '#ffe19a',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'var(--font-heading, inherit)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#1a1a2e',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                }}
              >
                <option value="company">Company</option>
                <option value="person">Person</option>
                <option value="project">Project</option>
                <option value="code">Code</option>
                <option value="other">Other</option>
              </select>

              {/* Custom placeholder input (optional, dashed) */}
              <input
                type="text"
                value={addPlaceholder}
                onChange={(e) => { setAddPlaceholder(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                placeholder={previewPlaceholder}
                maxLength={50}
                style={{
                  padding: '8px 10px',
                  border: '2px dashed #1a1a2e',
                  borderRadius: 8,
                  background: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#1a1a2e',
                  outline: 'none',
                }}
              />

              {/* Add button */}
              <button
                type="button"
                onClick={handleAdd}
                style={{
                  padding: '8px 16px',
                  border: '2px solid #1a1a2e',
                  borderRadius: 8,
                  background: '#6e77e5',
                  boxShadow: '3px 3px 0 #1a1a2e',
                  fontFamily: 'var(--font-heading, inherit)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.transform = 'translate(-2px,-2px)'
                  el.style.boxShadow = '5px 5px 0 #1a1a2e'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.transform = 'none'
                  el.style.boxShadow = '3px 3px 0 #1a1a2e'
                }}
              >
                + Add
              </button>
            </div>

            {addError && (
              <p
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-ui-body, inherit)',
                  fontSize: '0.72rem',
                  color: '#d44470',
                  fontWeight: 600,
                }}
              >
                {addError}
              </p>
            )}
          </div>

          {/* Info bar */}
          <p
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              borderRadius: 10,
              border: '2px dashed rgba(110,119,229,0.4)',
              background: 'rgba(228,219,255,0.4)',
              padding: '8px 12px',
              fontFamily: 'var(--font-ui-body, inherit)',
              fontSize: '0.72rem',
              lineHeight: 1.5,
              color: '#4b5563',
            }}
          >
            <span aria-hidden>🔍</span>
            <span>
              Smart matching: each keyword also matches compound forms (AsiaVion), hyphens
              (Asia-Vion), underscores, and case variants. Vietnamese diacritics and Japanese
              full-width spaces are handled automatically.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck for dashboard**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/molecules/keyword-protection-field.tsx
git commit -m "feat(dashboard): add KeywordProtectionField component (Variant F v5 Neubrutalism)"
```

---

## Task 10: Wire `KeywordProtectionField` into Pages

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.tsx`

### room-create.tsx

- [ ] **Step 1: Add import at top of `room-create.tsx`**

After the existing `ContextField` import:

```typescript
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
```

- [ ] **Step 2: Add `protectedKeywords: []` to form `defaultValues`**

Inside the `useForm<RoomCreateInput>` call, add to `defaultValues`:

```typescript
      protectedKeywords: [],
```

- [ ] **Step 3: Add `KeywordProtectionField` below the `ContextField` block**

Find the block ending with `return <ContextField {...contextFieldProps} />` (inside the `xl:col-span-2` div). After the closing of that `{(() => { ... })()}`, add:

```typescript
            <div className="page-divider-brutal my-4" />
            <KeywordProtectionField
              value={watch('protectedKeywords') ?? []}
              onChange={(v) => {
                setValue('protectedKeywords', v, { shouldValidate: true })
              }}
            />
```

- [ ] **Step 4: Update `onSubmit` to pass `protectedKeywords`**

In `onSubmit`, the `createRoom({ ...data, context: ... })` spread already includes all form fields including `protectedKeywords`. No change needed because `data` already carries the field.

However, to match the API contract (empty array = no protection), normalize it:

```typescript
const result = await createRoomAction.execute(() =>
  createRoom({
    ...data,
    context: data.context.trim() || null,
    protectedKeywords: data.protectedKeywords?.length ? data.protectedKeywords : undefined,
  }),
)
```

### room-detail.tsx

- [ ] **Step 5: Add import at top of `room-detail.tsx`**

```typescript
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
```

- [ ] **Step 6: Add `protectedKeywords` to `editDefaults`**

In the `editDefaults` object, add:

```typescript
        protectedKeywords: room.protectedKeywords ?? [],
```

Also in the empty-room fallback:

```typescript
        protectedKeywords: [],
```

- [ ] **Step 7: Add `protectedKeywords` to the `editForm.reset()` call**

```typescript
editForm.reset({
  // ... existing fields ...
  protectedKeywords: room.protectedKeywords ?? [],
})
```

- [ ] **Step 8: Add `KeywordProtectionField` below ContextField**

After the existing ContextField block (inside the `xl:col-span-2` div):

```tsx
            <div className="page-divider-brutal my-4" />
            <KeywordProtectionField
              value={editForm.watch('protectedKeywords') ?? []}
              onChange={(v) => {
                editForm.setValue('protectedKeywords', v, { shouldValidate: true })
              }}
            />
```

- [ ] **Step 9: Update `onEditSubmit` to pass `protectedKeywords`**

In `onEditSubmit`, update the `updateRoom` call:

```typescript
      updateRoom(room.id, {
        destinationRoomName: data.destinationRoomName,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        translationStyle: data.translationStyle,
        ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
        context: data.context.trim() || null,
        protectedKeywords: data.protectedKeywords?.length ? data.protectedKeywords : null,
      }),
```

- [ ] **Step 10: Run typecheck + lint**

```bash
bun run typecheck && bun run lint
```

Expected: PASS

- [ ] **Step 11: Run full Definition of Done check**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All PASS

- [ ] **Step 12: Commit**

```bash
git add packages/dashboard/src/pages/room-create.tsx \
        packages/dashboard/src/pages/room-detail.tsx
git commit -m "feat(dashboard): wire KeywordProtectionField into room create and edit pages"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement                                                 | Task                           |
| ---------------------------------------------------------------- | ------------------------------ |
| `KeywordEntry` type with category + optional placeholder         | Task 1                         |
| Extend `RoomConfig` with `protectedKeywords?`                    | Task 1                         |
| `KeywordRedactor.mask()` — auto-placeholder generation           | Task 3                         |
| `KeywordRedactor.mask()` — smart compound regex matching         | Task 3                         |
| `KeywordRedactor.mask()` — NFC normalization                     | Task 3                         |
| `KeywordRedactor.mask()` — longest-first ordering                | Task 3                         |
| `KeywordRedactor.mask()` — `\u3000` Japanese space               | Task 3                         |
| `KeywordRedactor.mask()` — system hint injection                 | Task 3                         |
| `KeywordRedactor.restore()`                                      | Task 3                         |
| Append `keywordSystemHint` to AI system prompt                   | Task 4                         |
| Pipeline accepts `keywordSystemHint`                             | Task 5                         |
| Handler: mask before pipeline                                    | Task 6                         |
| Handler: restore after pipeline (translatedText + segments)      | Task 6                         |
| Integration test: AI never sees original, Chatwork sees restored | Task 7                         |
| Dashboard Zod schema: `keywordEntrySchema`                       | Task 8                         |
| `KeywordProtectionField` component — Variant F v5 UI             | Task 9                         |
| Wire into room-create.tsx                                        | Task 10                        |
| Wire into room-detail.tsx                                        | Task 10                        |
| Backward compat — rooms without `protectedKeywords` unchanged    | Guaranteed by `?? []` defaults |
| EN + VI + JP test coverage                                       | Task 2                         |

### Notes for Implementer

1. **`command.translationInputs`** in `handler.ts`: when masking segments, calling `KeywordRedactor.mask(segment, keywords).maskedText` for each is safe. Placeholder assignment is positional (sorted keyword order), not based on first-occurrence in text, so all calls with the same keyword list produce the same `restoreMap`.

2. **`TranslationResult.cleanText`** in handler: after masking, we pass `maskedText` as `cleanText` to the pipeline. After restore, we reset `cleanText` back to the original `cleanText` variable (the unmasked source message). This keeps audit logs meaningful.

3. **Integration test in Task 7**: read the existing `handler.test.ts` to understand mock setup. The integration test outline uses placeholder function names — adapt them to match the real test helpers in the file.

4. **`room-schema.ts` import**: `z` is already imported in the file. No new import needed for the schema extension.
