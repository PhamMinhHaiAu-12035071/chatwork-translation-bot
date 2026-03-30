# Human-Sounding Workplace Translation Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Kagi-pivot prompt wording with a doctrine-first, human-sounding workplace translation prompt that treats Japanese and English as first-class inputs and keeps the three customer-facing styles clearly distinct.

**Architecture:** Keep the existing one-step JSON contract, but move most prompt intelligence into a rewritten shared doctrine core. Add thin Japanese and English source-language layers, thin but sharper style adapters, and a short verification checklist that checks naturalness, semantic fidelity, and style separation without reviving any multi-pass review loop.

**Tech Stack:** Bun, TypeScript, Zod, `@chatwork-bot/translation-prompt`, Bun test

**Spec:** `docs/plans/2026-03-30-human-sounding-workplace-translation-prompt-design.md`

---

### Task 1: Lock the doctrine-first core with failing tests

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Write the failing tests**

Add tests that require the shared system prompt to carry the approved architecture and safety floor.

Use assertions along these lines:

```ts
it('uses a short translator-first identity anchor without persona theater', () => {
  const result = buildSingleCallPrompts('Please check this by Friday.', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/translator/i)
  expect(result.system).not.toMatch(/20 years|elite|roleplay|persona/i)
})

it('keeps naturalness first but protects force, numbers, deadlines, conditions, and logic', () => {
  const result = buildSingleCallPrompts('金曜日までに確認してください。', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/natural/i)
  expect(result.system).toMatch(/force|deadline|condition|logic/i)
})

it('limits context awareness to the local message or segment only', () => {
  const result = buildSingleCallPrompts('Just checking on this.', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/local message|segment/i)
  expect(result.system).not.toMatch(/room history|thread history|memory/i)
})

it('distills human-sounding principles without explicit detector-gaming instructions', () => {
  const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
  expect(result.system).not.toMatch(/AI detector|detector evasion|bypass/i)
  expect(result.system).not.toMatch(/forbidden-word/i)
})
```

**Step 2: Run the targeted test file to confirm failure**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: FAIL because the current core still contains the older Kagi-pivot wording and does not mention the new safety-floor wording or local-context-only rule explicitly enough.

**Step 3: Commit the red test state**

```bash
git add packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "test(repo): lock doctrine-first workplace prompt core"
```

### Task 2: Lock the Japanese and English language layers with failing tests

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Add failing tests for source-language handling**

Add tests that require both Japanese and English workplace rules to be present and behaviorally distinct.

Use assertions like:

```ts
it('treats Japanese formulas functionally and minimally', () => {
  const result = buildSingleCallPrompts('お世話になっております。', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/function/i)
  expect(result.system).toMatch(/お世話になっております/i)
  expect(result.system).toMatch(/do not invent|unless the source explicitly carries that meaning/i)
  expect(result.system).toMatch(/Trân trọng|xem xét|cảm ơn/i)
})

it('keeps Japanese-script personal names instead of auto-romanizing them', () => {
  const result = buildSingleCallPrompts('山田太郎さんに連絡してください。', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/Japanese-script personal names/i)
})

it('includes a first-class English workplace layer instead of relying on Japanese fallback rules', () => {
  const result = buildSingleCallPrompts('Could you check this by Friday?', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/English source rules|English workplace/i)
  expect(result.system).toMatch(/Could you|Just checking|Hope you're well/i)
})

it('treats English hedging by communicative intent instead of literal syntax mirroring', () => {
  const result = buildSingleCallPrompts('I wanted to follow up on this.', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/communicative intent/i)
  expect(result.system).toMatch(/bookish|syntax-mirroring/i)
})
```

**Step 2: Run the targeted test file to confirm failure**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: FAIL because the current prompt only has Japanese-specific source rules and no explicit English workplace layer.

**Step 3: Commit the red test state**

```bash
git add packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "test(repo): lock japanese and english workplace prompt layers"
```

### Task 3: Lock style separation and verification behavior with failing tests

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Add failing tests for thin style adapters and the new verification checklist**

Add tests that require the three styles to remain thin, distinct, and subordinate to the shared doctrine.

Use assertions like:

```ts
it('natural casual has the highest paraphrase budget and avoids overfamiliar chat slang', () => {
  const result = buildSingleCallPrompts('進捗どうですか？', 'NATURAL_CASUAL')
  expect(result.system).toMatch(/highest paraphrase budget|native-feeling Vietnamese/i)
  expect(result.system).toMatch(/chat-app slang|overfamiliar/i)
  expect(result.system).toMatch(/only when local context supports them|prefer no pronoun/i)
})

it('professional business stays the stable default workplace style', () => {
  const result = buildSingleCallPrompts('Please review the attached file.', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/stable default/i)
  expect(result.system).toMatch(/modern|respectful|concise/i)
})

it('technical keeps the lowest paraphrase budget and preserves more industry English', () => {
  const result = buildSingleCallPrompts('Deploy to staging after approval.', 'TECHNICAL')
  expect(result.system).toMatch(/lowest paraphrase budget/i)
  expect(result.system).toMatch(/industry-standard English|technical force/i)
})

it('self-verification checks naturalness, semantic fidelity, and style separation only', () => {
  const result = buildSingleCallPrompts('テスト', 'PROFESSIONAL_BUSINESS')
  expect(result.system).toMatch(/naturalness/i)
  expect(result.system).toMatch(/semantic fidelity/i)
  expect(result.system).toMatch(/style separation/i)
  expect(result.system).not.toMatch(/warmth present|Particle Logic/i)
})
```

**Step 2: Run the targeted test file to confirm failure**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: FAIL because the current styles still lean on older wording and the current verification checklist still encodes specific casual-particle heuristics instead of the approved three-axis check.

**Step 3: Commit the red test state**

```bash
git add packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "test(repo): lock style separation and prompt verification rules"
```

### Task 4: Implement the new doctrine-first shared prompt assembly

**Files:**

- Modify: `packages/translation-prompt/src/sections/core.ts`
- Modify: `packages/translation-prompt/src/sections/language-layers.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Delete: `packages/translation-prompt/src/sections/contrastive-examples.ts`

**Step 1: Rewrite the shared core**

Replace the current core wording with a shorter translator-first anchor and a doctrine-heavy core.

Target shape:

```ts
export const BASE_TRANSLATOR_ROLE = `You are a translator. Translate Japanese or English workplace text into natural Vietnamese.`

export const CORE_DOCTRINE = `## Shared Translation Doctrine
- Render the target the way a Vietnamese person would naturally write it in the same workplace context.
- Rewrite strongly when needed for natural Vietnamese rhythm.
- Do not translate word-for-word or mirror source syntax.
- Do not change force, obligations, urgency, numbers, deadlines, conditions, negation, or logic.
- Use only the local message or segment as context.
- Preserve code, URLs, tags, timestamps, numbers, names, and important structure.
- Translate profanity and harsh tone faithfully.
`
```

**Step 2: Expand the language layers**

Refactor `language-layers.ts` so it exports both Japanese and English source-language rule blocks.

Before deleting anything, read `packages/translation-prompt/src/sections/contrastive-examples.ts`
and preserve any genuinely high-signal behavioral anchor by migrating it into:

- a prompt test assertion, or
- the rewritten doctrine/language-layer wording

Only delete the file after that information is preserved elsewhere.

Target shape:

```ts
export const JAPANESE_RULES = `## Japanese Source Rules
- Read keigo and standard workplace formulas by communicative function.
- Keep Japanese-script names as written.
- Do not invent gratitude, review requests, or formal closings that are not present.
`

export const ENGLISH_RULES = `## English Source Rules
- Resolve workplace hedging by communicative intent.
- Avoid bookish or syntax-mirroring Vietnamese.
- Keep short task-oriented English concise in Vietnamese.
`
```

**Step 3: Rebuild prompt assembly around doctrine + language layers**

Update `translation-prompt.ts` to:

- import `ENGLISH_RULES`
- remove `CONTRASTIVE_EXAMPLES`
- join the shared system in this order:
  1. `BASE_TRANSLATOR_ROLE`
  2. `CORE_DOCTRINE`
  3. `JAPANESE_RULES`
  4. `ENGLISH_RULES`
  5. `CONSTRAINTS`
  6. `SELF_VERIFICATION`
- bump `TRANSLATION_PROMPT_BUILD_ID`

**Step 4: Run the targeted tests until they pass**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: PASS for the doctrine and source-language tests added in Tasks 1-3.

**Step 5: Commit**

```bash
git add packages/translation-prompt/src/sections/core.ts \
  packages/translation-prompt/src/sections/language-layers.ts \
  packages/translation-prompt/src/translation-prompt.ts \
  packages/translation-prompt/src/translation-prompt.test.ts \
  packages/translation-prompt/src/sections/contrastive-examples.ts
git commit -m "refactor(repo): rebuild translation prompt around doctrine-first core"
```

### Task 5: Implement the thin style adapters and three-axis verification checklist

**Files:**

- Modify: `packages/translation-prompt/src/sections/translation-style-profiles.ts`
- Modify: `packages/translation-prompt/src/sections/verification.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Rewrite the style profiles as thin adapters**

Refactor each style so it shapes expression without acting as a second doctrine.

Target shape:

```ts
NATURAL_CASUAL: {
  userInstruction: 'Use the natural-casual workplace style.',
  systemInstructions: `## Active Style: NATURAL_CASUAL
- Highest paraphrase budget.
- Most native-feeling Vietnamese.
- Keep English only when it is truly everyday workplace or tech speech.
- Avoid chat-app slang, overfamiliar xưng hô, and performative filler.`
}
```

Apply the same pattern to:

- `PROFESSIONAL_BUSINESS`
- `TECHNICAL`

Make them shorter, clearer, and explicitly different on paraphrase budget, directness, and term retention.
Also encode the approved `context-gated minimal` rule concretely:

- prefer no pronoun over invented hierarchy
- allow light particles only when the local source already supports a conversational request or question
- avoid adding `anh/chị`, `em`, `ông`, or similar role signals on sparse context alone

**Step 2: Replace the verification checklist**

Rewrite `verification.ts` so the checklist is only:

```ts
export const SELF_VERIFICATION = `## Self-Verification Checklist (Internal - Do Not Output)
- [ ] Naturalness: sounds like Vietnamese workplace writing, not translationese
- [ ] Semantic fidelity: force, numbers, deadlines, conditions, negation, and logic are preserved
- [ ] Style separation: the selected style is clearly reflected in register and term choices
`
```

**Step 3: Run the targeted tests until they pass**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: PASS for style and verification assertions from Task 3, plus all earlier prompt tests updated to the new doctrine.

**Step 4: Commit**

```bash
git add packages/translation-prompt/src/sections/translation-style-profiles.ts \
  packages/translation-prompt/src/sections/verification.ts \
  packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "refactor(repo): sharpen translation styles and verification rules"
```

### Task 6: Full verification and final handoff

**Files:**

- Verify: `packages/translation-prompt/src/sections/core.ts`
- Verify: `packages/translation-prompt/src/sections/language-layers.ts`
- Verify: `packages/translation-prompt/src/sections/translation-style-profiles.ts`
- Verify: `packages/translation-prompt/src/sections/verification.ts`
- Verify: `packages/translation-prompt/src/translation-prompt.ts`
- Verify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Run package-level prompt tests**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: PASS

**Step 2: Run the full repo validation gate**

Run: `bun test && bun run typecheck && bun run lint`

Expected: PASS

**Step 3: Review the final prompt assembly**

Manually confirm:

- shared doctrine appears before language and style sections
- English rules are present beside Japanese rules
- no contrastive-example block remains in the shared system
- style sections are shorter than before and visibly different from each other
- the verification block checks only the approved three axes

Then run one manual smoke matrix across all three styles with at least:

- one neutral update
- one request / ask
- one technical instruction

Expected:

- `NATURAL_CASUAL` and `PROFESSIONAL_BUSINESS` remain distinguishable on the neutral case
- `TECHNICAL` is clearly the most constraint-preserving and terminology-heavy output

**Step 4: Commit the verified implementation**

```bash
git add packages/translation-prompt/src/sections/core.ts \
  packages/translation-prompt/src/sections/language-layers.ts \
  packages/translation-prompt/src/sections/translation-style-profiles.ts \
  packages/translation-prompt/src/sections/verification.ts \
  packages/translation-prompt/src/translation-prompt.ts \
  packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(repo): ship human-sounding workplace translation prompt"
```
