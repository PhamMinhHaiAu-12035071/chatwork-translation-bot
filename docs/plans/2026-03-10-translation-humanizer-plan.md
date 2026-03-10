# Translation Humanizer — 3-Tier Formatting Doctrine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the strict "Preserve ALL line breaks" rule in `@chatwork-bot/translation-prompt` with a 3-tier formatting doctrine that allows the AI to apply target-language (Vietnamese) formatting conventions instead of mirroring Japanese typographic habits.

**Architecture:** Four surgical text changes in `translation-prompt.ts` (two section rewrites, one section addition, one new few-shot example) plus two new test assertions in `translation-prompt.test.ts`. No structural/API changes — pure prompt content updates. The 6-section architecture and all public function signatures remain unchanged.

**Tech Stack:** Bun · TypeScript 5.4 strict · Zod · `bun:test`

---

### Task 1: Add failing tests for the new behavior

> Write the tests first so we know exactly what "done" looks like before touching implementation.

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Open the test file and locate the `buildSystemPrompt` describe block**

Read `packages/translation-prompt/src/translation-prompt.test.ts`. The `buildSystemPrompt` block starts around line 52. We will add two new `it()` calls at the end of that block.

**Step 2: Add two failing tests to the `buildSystemPrompt` describe block**

Add after the existing `it('is a pure function...')` test (around line 81):

```typescript
it('does not contain the old strict line-break rule', () => {
  expect(buildSystemPrompt()).not.toContain('Preserve ALL line breaks')
})

it('contains the 3-tier formatting doctrine', () => {
  expect(buildSystemPrompt()).toContain('Formatting Doctrine')
  expect(buildSystemPrompt()).toContain('Tier 1')
  expect(buildSystemPrompt()).toContain('Tier 2')
  expect(buildSystemPrompt()).toContain('Tier 3')
})
```

**Step 3: Add one failing test to the `buildUserPrompt` describe block**

In the `buildUserPrompt` describe block (around line 84), add after the existing `it('contains few-shot example showing IT terms...')` test:

```typescript
it('contains few-shot example demonstrating mid-sentence line break merge', () => {
  const prompt = buildUserPrompt('test')
  expect(prompt).toContain('引き継ぎ')
})
```

**Step 4: Run the new tests to verify they fail**

```bash
cd /path/to/chatwork-translation-bot
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected output — 3 new tests FAIL:

```
✗ does not contain the old strict line-break rule
✗ contains the 3-tier formatting doctrine
✗ contains few-shot example demonstrating mid-sentence line break merge
```

All other (existing) tests should still PASS.

**Step 5: Commit the failing tests**

```bash
git add packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "test(translation-prompt): add failing tests for 3-tier formatting doctrine"
```

---

### Task 2: Rewrite SECTION_STRUCTURAL

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts:117-124`

**Step 1: Locate SECTION_STRUCTURAL**

In `translation-prompt.ts`, find the `SECTION_STRUCTURAL` const (around line 117). The current content is:

```typescript
const SECTION_STRUCTURAL: PromptSection = {
  id: 'structural',
  content: `## Structural Rules

Line Breaks: Preserve ALL line breaks exactly as they appear in the source text.
Every single newline (\\n) in source = the same newline in translation.
Do NOT add or remove blank lines. This is critical for Chatwork message formatting.`,
}
```

**Step 2: Replace the content with the 3-tier doctrine**

Replace the `content` string with:

```typescript
const SECTION_STRUCTURAL: PromptSection = {
  id: 'structural',
  content: `## Formatting Doctrine

Apply the formatting conventions of the target language, not the source.

Tier 1 — Paragraph dividers (blank lines \\n\\n)
Preserve blank lines that separate distinct topics or paragraphs.

Tier 2 — Prose line breaks (single \\n)
Merge when a break falls inside a grammatical unit (mid-sentence: clause ending
with など, が, は, を, commas, or similar unfinished constructs). Reflow prose so
it reads as a native Vietnamese professional would naturally write it.

Tier 3 — Structural elements and Chatwork markup
Use judgment: preserve lists, numbered items, and Chatwork tags ([info][/info],
[code][/code], [qt][/qt], [To:x]) if they carry structural meaning. Reflow if
the prose context makes them unnatural in the target language.`,
}
```

**Step 3: Run the failing tests — expect 2 of 3 to now pass**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected:

```
✓ does not contain the old strict line-break rule
✓ contains the 3-tier formatting doctrine
✗ contains few-shot example demonstrating mid-sentence line break merge  ← still failing, Task 4
```

**Step 4: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts
git commit -m "feat(translation-prompt): rewrite SECTION_STRUCTURAL with 3-tier formatting doctrine"
```

---

### Task 3: Update SECTION_HUMANIZER self-check #4 + add Chatwork constraint

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`

**Step 1: Update self-check #4 in SECTION_HUMANIZER**

Find this line inside `SECTION_HUMANIZER.content` (around line 113):

```
4. ✓ Line breaks identical — every \\n in source appears exactly in translation?
```

Replace with:

```
4. ✓ Formatting natural — does the translation follow target-language (Vietnamese) line-break conventions, not the source language's typographic habits?
```

**Step 2: Add Chatwork markup constraint to SECTION_CONSTRAINTS**

Find `SECTION_CONSTRAINTS` (around line 127). The current content ends with:

```
- Do NOT prefix the JSON response with any text — output JSON immediately`,
```

Add one new bullet before the closing backtick:

```
- Do NOT strip or modify Chatwork markup tags ([info][/info], [code][/code], [qt][/qt], [To:xxx]) — translate only the text content inside them
- Do NOT prefix the JSON response with any text — output JSON immediately`,
```

**Step 3: Run all tests — expect no regressions**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected: Same pass/fail state as after Task 2 (only the few-shot test still failing).

**Step 4: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts
git commit -m "feat(translation-prompt): update humanizer self-check #4 and add Chatwork markup constraint"
```

---

### Task 4: Add few-shot example for mid-sentence line break merge

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts:166-181`

**Step 1: Locate `buildUserPrompt` and the existing examples**

Find `buildUserPrompt` (around line 166). The current few-shot examples section looks like:

```typescript
Quality examples:
Input: 「お世話になっております。リリースの件でご確認をお願いしたくご連絡いたしました。」
Output: {"sourceLang":"Japanese","translated":"Kính gửi anh/chị,\\nTôi xin phép liên lạc để nhờ xác nhận về release trước đó."}

Input: "The deploy is scheduled for Monday. Please make sure staging is ready."
Output: {"sourceLang":"English","translated":"Deploy được lên kế hoạch vào thứ Hai. Nhờ anh/chị đảm bảo staging đã sẵn sàng nhé."}
```

**Step 2: Add a third example after the second one**

Append after the English example and before the `\n\nText:\n${text}` section:

```typescript
Input: "実装してみてテストが荒くなるようでしたらあちらに引き継ぎしちゃうなど\\nそのあたりは柔軟に相談できると思います。"
Output: {"sourceLang":"Japanese","translated":"Nếu lúc implement thử mà thấy phần test có vẻ phức tạp thì mình cứ bàn giao lại cho bên đó chẳng hạn, mấy vấn đề đó mình nghĩ có thể trao đổi linh hoạt được."}
```

The full updated template string at that section:

```typescript
Quality examples:
Input: 「お世話になっております。リリースの件でご確認をお願いしたくご連絡いたしました。」
Output: {"sourceLang":"Japanese","translated":"Kính gửi anh/chị,\\nTôi xin phép liên lạc để nhờ xác nhận về release trước đó."}

Input: "The deploy is scheduled for Monday. Please make sure staging is ready."
Output: {"sourceLang":"English","translated":"Deploy được lên kế hoạch vào thứ Hai. Nhờ anh/chị đảm bảo staging đã sẵn sàng nhé."}

Input: "実装してみてテストが荒くなるようでしたらあちらに引き継ぎしちゃうなど\\nそのあたりは柔軟に相談できると思います。"
Output: {"sourceLang":"Japanese","translated":"Nếu lúc implement thử mà thấy phần test có vẻ phức tạp thì mình cứ bàn giao lại cho bên đó chẳng hạn, mấy vấn đề đó mình nghĩ có thể trao đổi linh hoạt được."}
```

**Step 3: Run all tests — expect all 3 new tests now PASS**

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected:

```
✓ does not contain the old strict line-break rule
✓ contains the 3-tier formatting doctrine
✓ contains few-shot example demonstrating mid-sentence line break merge
```

All other existing tests must also PASS.

**Step 4: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts
git commit -m "feat(translation-prompt): add few-shot example for mid-sentence line break merge"
```

---

### Task 5: Full DoD verification

**Step 1: Run full test suite**

```bash
bun test
```

Expected: 153+ tests pass (150 existing + 3 new), 0 fail.

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 3: Run lint**

```bash
bun run lint
```

Expected: no errors or warnings on changed files.

**Step 4: Final commit if anything was auto-fixed by lint**

```bash
# Only if lint auto-fixed anything:
git add packages/translation-prompt/src/
git commit -m "style(translation-prompt): apply lint formatting"
```

---

## Summary of Changes

| File                                                         | What changes                                                                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/translation-prompt/src/translation-prompt.ts`      | SECTION_STRUCTURAL rewritten (3-tier doctrine), SECTION_HUMANIZER self-check #4 updated, SECTION_CONSTRAINTS +1 Chatwork markup rule, `buildUserPrompt` +1 few-shot example |
| `packages/translation-prompt/src/translation-prompt.test.ts` | +3 new `it()` assertions                                                                                                                                                    |

No API surface changes. No new dependencies. No other files touched.
