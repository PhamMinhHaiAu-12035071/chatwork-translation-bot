# Translation Context Honorific Policy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen prompt instructions so the LLM can use optional names, aliases, roles, gender, and seniority hints from `Translation Context`, together with existing `mentionHint`, to choose safer Vietnamese naming and honorific output without adding schema or parsing logic.

**Architecture:** Keep the current data flow unchanged. `packages/translator` continues forwarding `room.context` and `mentionHint`; `packages/translation-prompt` becomes the single implementation surface for the new policy by tightening the room-context instruction header and bumping the prompt build ID. This keeps the feature LLM-first, fail-open, and scoped to prompt quality.

**Tech Stack:** TypeScript, Bun test runner, existing prompt builder in `@chatwork-bot/translation-prompt`

---

### Task 1: Lock The New Prompt Policy In Tests

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`
- Reference: `docs/plans/2026-04-13-translation-context-honorific-policy-design.md`

**Step 1: Write the failing tests**

Open `packages/translation-prompt/src/translation-prompt.test.ts` and extend the `roomContext injection` coverage with assertions for the new policy. Add a new describe block like this:

```typescript
describe('roomContext policy guidance', () => {
  it('treats room context as optional structured or unstructured guidance', () => {
    const result = buildSingleCallPrompts(
      '確認お願いします',
      'PROFESSIONAL_BUSINESS',
      'Tanaka Taro / 田中太郎 (PM, male)',
    )

    expect(result.system).toContain('structured or unstructured notes')
    expect(result.system).toContain('only when clearly stated')
    expect(result.system).toContain('translate conservatively')
  })

  it('prefers a Latin alias over the original Japanese name when both are present', () => {
    const result = buildSingleCallPrompts(
      '田中太郎さん、確認お願いします',
      'PROFESSIONAL_BUSINESS',
      'Tanaka Taro / 田中太郎 (PM, male)',
    )

    expect(result.system).toContain('prefer the Latin alias')
    expect(result.system).toContain('Japanese name only as a matching anchor')
  })

  it('forbids forced romanization when no trusted alias is provided', () => {
    const result = buildSingleCallPrompts(
      '田中太郎さん、確認お願いします',
      'PROFESSIONAL_BUSINESS',
      '田中太郎 (PM, male)',
    )

    expect(result.system).toContain('do not invent a romanized form')
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected:

- FAIL because the current `CONTEXT_ENFORCEMENT_HEADER` does not yet contain the new wording

**Step 3: Commit the failing test checkpoint**

Run:

```bash
git add packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "test(prompt): lock translation context honorific guidance"
```

Expected:

- Commit succeeds with only the test file staged

### Task 2: Implement The Prompt Policy And Bump The Build ID

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Verify against: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Write the minimal implementation**

Open `packages/translation-prompt/src/translation-prompt.ts` and replace the current `CONTEXT_ENFORCEMENT_HEADER` with a more explicit policy block. Use wording close to:

```typescript
const CONTEXT_ENFORCEMENT_HEADER = `Apply this context to every translation in this room:
- The room context may contain structured or unstructured notes about people, aliases, roles, gender, seniority, and tone.
- If the message or mention target matches a person described in the room context, use that information when it is clearly stated.
- Prefer a trusted Latin alias in Vietnamese output when the context provides both a Latin alias and the original Japanese name.
- If the context only provides the original Japanese name, keep that name and do not invent a romanized form.
- Use gender, role, title, or seniority hints only when clearly stated; if uncertain, translate conservatively and naturally.
- If no reliable person metadata is available, ignore these person-specific rules and translate normally.`
```

Then bump the prompt build ID to reflect the policy change:

```typescript
export const TRANSLATION_PROMPT_BUILD_ID = '2026-04-13-context-honorific-policy-v1'
```

Do not add parser logic. Do not add schema changes. Keep `buildContextSection()` behavior unchanged apart from the new header text.

**Step 2: Run the focused test again**

Run:

```bash
bun test packages/translation-prompt/src/translation-prompt.test.ts
```

Expected:

- PASS
- Existing `mentionHint`, keyword, and room-context injection tests still pass

**Step 3: Run package checks**

Run:

```bash
bun run --cwd packages/translation-prompt typecheck
bun run --cwd packages/translation-prompt lint
```

Expected:

- PASS

**Step 4: Commit the implementation**

Run:

```bash
git add packages/translation-prompt/src/translation-prompt.ts \
        packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(prompt): strengthen translation context honorific guidance"
```

Expected:

- Commit succeeds with prompt implementation + tests

### Task 3: Run End-To-End Repository Verification For The Prompt Change

**Files:**

- Verify: `packages/translation-prompt/src/translation-prompt.ts`
- Verify: `packages/translation-prompt/src/translation-prompt.test.ts`
- Reference: `docs/plans/2026-04-13-translation-context-honorific-policy-design.md`

**Step 1: Run the repository quality gates**

Run:

```bash
bun run test && bun run typecheck && bun run lint
```

Expected:

- PASS across the monorepo

**Step 2: Review the prompt diff for scope control**

Run:

```bash
git diff -- packages/translation-prompt/src/translation-prompt.ts \
           packages/translation-prompt/src/translation-prompt.test.ts
```

Expected:

- only prompt wording, build ID, and test assertions changed
- no room schema, API, or parser files touched

**Step 3: Create the final documentation commit**

Run:

```bash
git add docs/plans/2026-04-13-translation-context-honorific-policy-design.md \
        docs/plans/2026-04-13-translation-context-honorific-policy.md
git commit -m "docs(plans): add translation context honorific policy spec"
```

Expected:

- Commit succeeds with the design doc and implementation plan

### Task 4: Manual Spot-Check After Merge

**Files:**

- Reference only: `docs/plans/2026-04-13-translation-context-honorific-policy-design.md`

**Step 1: Prepare a room context with alias + Japanese name**

Use a room context such as:

```text
Members:
- Tanaka Taro / 田中太郎 (PM, male)
- Yui Sato / 佐藤結衣 (Designer, female)
Tone: Professional and respectful.
```

**Step 2: Send a representative message**

Use a Chatwork message such as:

```text
[To:123]田中太郎
確認お願いします
```

**Step 3: Validate the output manually**

Expected:

- the output prefers `Tanaka Taro` instead of inventing a different romanization
- the output uses a business-safe Vietnamese honorific when confidence is high
- if context data is incomplete, the output remains natural and does not crash or produce prompt artifacts

**Step 4: Record follow-up findings**

If the output still shows weak behavior, capture examples for a second prompt-only iteration instead of introducing schema or parsing work immediately.
