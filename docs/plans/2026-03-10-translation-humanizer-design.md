# Design: Translation Humanizer — 3-Tier Formatting Doctrine

**Date**: 2026-03-10
**Package**: `@chatwork-bot/translation-prompt`
**Status**: Approved, pending implementation

---

## Problem

The current prompt enforces strict line-break preservation (`SECTION_STRUCTURAL`), which conflicts with the "Natural Vietnamese First" doctrine (`SECTION_CORE_DOCTRINE` Rule 1). The result: translated text mirrors Japanese typographic habits (mid-sentence line breaks common in chat) rather than flowing as natural Vietnamese prose.

### Root Conflict

```
SECTION_STRUCTURAL:              "Preserve ALL line breaks exactly"     ← hard override
SECTION_HUMANIZER self-check #4: "✓ Line breaks identical"              ← reinforces rigidity
SECTION_CORE_DOCTRINE Rule 1:    "Natural Vietnamese First"             ← gets suppressed
```

### Observed Symptom (from screenshots)

Japanese input:

```
実装してみてテストが荒くなるようでしたらあちらに引き継ぎしちゃうなど
そのあたりは柔軟に相談できると思います。
```

Bot output (current — unnatural):

```
Nếu lúc implement thử mà thấy phần test có vẻ cập rập quá thì mình cứ bàn giao lại cho bên đó luôn chẳng hạn,
mấy vấn đề đó tôi nghĩ mình có thể trao đổi linh hoạt được.
```

Expected (humanized — flowing prose):

```
Nếu lúc implement thử mà thấy phần test có vẻ phức tạp thì mình cứ bàn giao lại cho bên đó chẳng hạn, mấy vấn đề đó mình nghĩ có thể trao đổi linh hoạt được.
```

---

## Approach Selected

**Approach B — 3-Tier Formatting Doctrine**: rewrite `SECTION_STRUCTURAL` with explicit three-tier rules. Keeps existing code architecture (6 sections), minimal diff surface, maximum clarity for AI.

Rejected approaches:

- A (minimal): Considered but B's explicit tier rules make AI behavior more predictable.
- C (consolidate): Merging sections risks making `SECTION_HUMANIZER` too dense to maintain.

---

## Design

### Change 1 — SECTION_STRUCTURAL (full rewrite)

**Before:**

```
## Structural Rules

Line Breaks: Preserve ALL line breaks exactly as they appear in the source text.
Every single newline (\n) in source = the same newline in translation.
Do NOT add or remove blank lines. This is critical for Chatwork message formatting.
```

**After:**

```
## Formatting Doctrine

Apply the formatting conventions of the target language, not the source.

Tier 1 — Paragraph dividers (blank lines \n\n)
Preserve blank lines that separate distinct topics or paragraphs.

Tier 2 — Prose line breaks (single \n)
Merge when a break falls inside a grammatical unit (mid-sentence: clause ending
with など, が, は, を, commas, or similar unfinished constructs). Reflow prose so
it reads as a native Vietnamese professional would naturally write it.

Tier 3 — Structural elements and Chatwork markup
Use judgment: preserve lists, numbered items, and Chatwork tags ([info][/info],
[code][/code], [qt][/qt], [To:x]) if they carry structural meaning. Reflow if
the prose context makes them unnatural in the target language.
```

### Change 2 — SECTION_HUMANIZER self-check #4

**Before:**

```
4. ✓ Line breaks identical — every \n in source appears exactly in translation?
```

**After:**

```
4. ✓ Formatting natural — does the translation follow target-language (Vietnamese)
   line-break conventions, not the source language's typographic habits?
```

### Change 3 — SECTION_CONSTRAINTS (add 1 rule)

Add to the end of the constraints list:

```
- Do NOT strip or modify Chatwork markup tags ([info][/info], [code][/code],
  [qt][/qt], [To:xxx]) — translate only the text content inside them
```

### Change 4 — `buildUserPrompt` (add 1 few-shot example)

Add a third quality example demonstrating the mid-sentence Japanese line break being merged into flowing Vietnamese prose:

```
Input: "実装してみてテストが荒くなるようでしたらあちらに引き継ぎしちゃうなど\nそのあたりは柔軟に相談できると思います。"
Output: {"sourceLang":"Japanese","translated":"Nếu lúc implement thử mà thấy phần test có vẻ phức tạp thì mình cứ bàn giao lại cho bên đó chẳng hạn, mấy vấn đề đó mình nghĩ có thể trao đổi linh hoạt được."}
```

### Change 5 — Tests

- No existing tests will break (current tests check behavioral keywords, not line-break rule text).
- Add 1 new test: verify the new few-shot example appears in `buildUserPrompt`.
- Optionally add 1 test: verify `buildSystemPrompt` no longer contains "Preserve ALL line breaks".

---

## Files Affected

| File                                                         | Change                                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/translation-prompt/src/translation-prompt.ts`      | Rewrite `SECTION_STRUCTURAL`, update `SECTION_HUMANIZER` self-check #4, add rule to `SECTION_CONSTRAINTS`, add few-shot example to `buildUserPrompt` |
| `packages/translation-prompt/src/translation-prompt.test.ts` | Add 1-2 new test assertions                                                                                                                          |

---

## Verification (Definition of Done)

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass, no regressions.

---

## Trade-offs Accepted

| Decision                          | Trade-off                                                           |
| --------------------------------- | ------------------------------------------------------------------- |
| AI judges Tier 2 mid-prose merges | Less deterministic than strict rules, but necessary for naturalness |
| Flexible even for lists (Tier 3)  | May occasionally restructure intentional list formatting            |
| 3 few-shot examples instead of 2  | ~50 extra tokens per request; acceptable for quality improvement    |
