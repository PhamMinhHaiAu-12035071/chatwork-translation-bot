# Kagi-Core Pivot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current persona-heavy prompt steering with a Kagi-like translation doctrine core that prioritizes natural Vietnamese, anti-literalism, and context-aware restructuring while keeping the existing one-step JSON interface.

**Architecture:** Move naturalness and anti-mirroring rules into the shared core so every style inherits the same translator doctrine. Reduce style packs to thin adapters that shape register only, instead of acting as the primary driver of sentence structure.

**Tech Stack:** Bun, TypeScript, `@chatwork-bot/translation-prompt`, Bun test

---

### Task 1: Lock the new doctrine with tests

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Steps:**

1. Add failing tests that require the shared core to mention natural target-language output, active avoidance of source-structure mirroring, significant restructuring when needed, and context guessing for natural rendering.
2. Add failing tests that remove `Zalo/Slack` teammate language from `NATURAL_CASUAL`.
3. Add failing tests that require thinner style adapters: short register guidance, no style pack dependence on large contrastive blocks, and no chatty persona anchors.
4. Run `bun test packages/translation-prompt/src/translation-prompt.test.ts` and confirm the new tests fail for the expected reason.

### Task 2: Implement the doctrine-first prompt pivot

**Files:**

- Modify: `packages/translation-prompt/src/sections/core.ts`
- Modify: `packages/translation-prompt/src/sections/language-layers.ts`
- Modify: `packages/translation-prompt/src/sections/translation-style-profiles.ts`

**Steps:**

1. Rewrite the shared core to match the verified Kagi prompt patterns: translator-first, naturalness-first, anti-word-for-word, anti-mirroring, restructure allowed, and punctuation preservation.
2. Keep XML/tag safety and the existing JSON output contract untouched.
3. Shrink each style section so it shapes register only:
   - `NATURAL_CASUAL`: natural informal workplace Vietnamese, not “close teammate on Zalo”
   - `PROFESSIONAL_BUSINESS`: clear internal business prose
   - `TECHNICAL`: terse engineering prose
4. Remove low-leverage contrastive bulk if it is no longer needed after the doctrine pivot.
5. Re-run the targeted test file until it passes.

### Task 3: Re-verify prompt size and acceptance scaffolding

**Files:**

- Modify: `nghiencuu/prompt-iteration-log.md`
- Keep: `nghiencuu/prompt-v4-mini-eval-pack.json` unless the new doctrine requires a wording update

**Steps:**

1. Measure current prompt sizes after the pivot.
2. Record a new iteration entry documenting the pivot from persona-heavy prompting to doctrine-first prompting.
3. Preserve the same acceptance rubric and demo target.

### Task 4: Full verification

**Steps:**

1. Run `bun test`
2. Run `bun run typecheck`
3. Run `bun run lint`
4. Summarize what changed, verification evidence, and what still requires manual Kagi comparison.
