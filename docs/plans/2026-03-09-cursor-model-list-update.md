# Cursor Model List Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace invalid model names in `cursor-plugin.ts` with the 45 valid model IDs from cursor-api-proxy, grouped by fast/slow/max-mode comments, and update tests.

**Architecture:** Single-file edit to `cursor-plugin.ts` replacing `CURSOR_MODEL_VALUES` array + updating `DEFAULT_CURSOR_MODEL`. Tests in `cursor-plugin.test.ts` are updated to reflect new model names. No runtime behavior changes — only the model ID strings change.

**Tech Stack:** TypeScript, Bun test, `as const` tuple types

---

### Task 1: Update `CURSOR_MODEL_VALUES` in cursor-plugin.ts

**Files:**

- Modify: `packages/provider-cursor/src/cursor-plugin.ts:4-27`

**Step 1: Open the file and verify current state**

Read `packages/provider-cursor/src/cursor-plugin.ts` and confirm `CURSOR_MODEL_VALUES` starts at line 4 and `DEFAULT_CURSOR_MODEL` is at line 29.

**Step 2: Replace CURSOR_MODEL_VALUES and DEFAULT_CURSOR_MODEL**

Replace the entire constant block (lines 4–29) with:

```ts
export const CURSOR_MODEL_VALUES = [
  // === SLOW REQUEST ===
  // Unlimited usage, queued at peak — does NOT consume fast quota
  'sonnet-4.5',
  'gemini-3-flash',
  'gemini-3-pro',
  'gemini-3.1-pro',
  'kimi-k2.5',
  'grok',
  'gpt-5.1-codex-mini',

  // === FAST REQUEST ===
  // Consumes from 500 fast requests/month quota
  'auto',
  'composer-1',
  'composer-1.5',
  'sonnet-4.6',
  'opus-4.5',
  'opus-4.6',
  'gpt-5.2',
  'gpt-5.2-high',
  'gpt-5.2-codex',
  'gpt-5.2-codex-low',
  'gpt-5.2-codex-low-fast',
  'gpt-5.2-codex-fast',
  'gpt-5.2-codex-high',
  'gpt-5.2-codex-high-fast',
  'gpt-5.3-codex',
  'gpt-5.3-codex-low',
  'gpt-5.3-codex-low-fast',
  'gpt-5.3-codex-fast',
  'gpt-5.3-codex-high',
  'gpt-5.3-codex-high-fast',
  'gpt-5.3-codex-spark-preview',
  'gpt-5.4-medium',
  'gpt-5.4-medium-fast',
  'gpt-5.4-high',
  'gpt-5.4-high-fast',
  'gpt-5.1-high',

  // === MAX MODE ===
  // Extended context window / reasoning — thinking variants + xhigh/max variants
  'sonnet-4.5-thinking',
  'sonnet-4.6-thinking',
  'opus-4.5-thinking',
  'opus-4.6-thinking',
  'gpt-5.2-codex-xhigh',
  'gpt-5.2-codex-xhigh-fast',
  'gpt-5.3-codex-xhigh',
  'gpt-5.3-codex-xhigh-fast',
  'gpt-5.4-xhigh',
  'gpt-5.4-xhigh-fast',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-max-high',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]
export const DEFAULT_CURSOR_MODEL: CursorModel = 'sonnet-4.6'
```

**Step 3: Run typecheck to verify no type errors**

```bash
bun run typecheck
```

Expected output: all packages pass typecheck with no errors.

**Step 4: Commit**

```bash
git add packages/provider-cursor/src/cursor-plugin.ts
git commit -m "feat(provider-cursor): update model list to match cursor-api-proxy with fast/slow/max grouping"
```

---

### Task 2: Update tests in cursor-plugin.test.ts

**Files:**

- Modify: `packages/provider-cursor/src/cursor-plugin.test.ts:21-47`

**Step 1: Read the current test file**

Read `packages/provider-cursor/src/cursor-plugin.test.ts` and note all `describe('cursor model values')` assertions (lines 21–47).

**Step 2: Replace the model-values describe block**

Replace the entire `describe('cursor model values', ...)` block with:

```ts
describe('cursor model values', () => {
  it('includes Slow Request models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.5')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3-flash')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3-pro')
    expect(CURSOR_MODEL_VALUES).toContain('gemini-3.1-pro')
    expect(CURSOR_MODEL_VALUES).toContain('kimi-k2.5')
    expect(CURSOR_MODEL_VALUES).toContain('grok')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.1-codex-mini')
  })

  it('includes Fast Request models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('auto')
    expect(CURSOR_MODEL_VALUES).toContain('composer-1')
    expect(CURSOR_MODEL_VALUES).toContain('composer-1.5')
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.6')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.5')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.6')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.2')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.3-codex')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.4-high')
  })

  it('includes Max Mode models', () => {
    expect(CURSOR_MODEL_VALUES).toContain('sonnet-4.6-thinking')
    expect(CURSOR_MODEL_VALUES).toContain('opus-4.6-thinking')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.3-codex-xhigh')
    expect(CURSOR_MODEL_VALUES).toContain('gpt-5.1-codex-max')
  })

  it('does NOT include invalid models removed from proxy', () => {
    expect(CURSOR_MODEL_VALUES).not.toContain('gpt-5-mini')
    expect(CURSOR_MODEL_VALUES).not.toContain('cursor-small')
    expect(CURSOR_MODEL_VALUES).not.toContain('claude-sonnet-4-5')
    expect(CURSOR_MODEL_VALUES).not.toContain('gemini-2.5-flash')
  })

  it('default model is in supported list', () => {
    expect(CURSOR_MODEL_VALUES).toContain(DEFAULT_CURSOR_MODEL)
    expect(DEFAULT_CURSOR_MODEL).toBe('sonnet-4.6')
  })

  it('contains exactly 45 models', () => {
    expect(CURSOR_MODEL_VALUES).toHaveLength(45)
  })
})
```

**Step 3: Run tests to verify pass**

```bash
cd packages/provider-cursor && bun test src/cursor-plugin.test.ts
```

Expected output:

```
✓ cursor model values > includes Slow Request models
✓ cursor model values > includes Fast Request models
✓ cursor model values > includes Max Mode models
✓ cursor model values > does NOT include invalid models removed from proxy
✓ cursor model values > default model is in supported list
✓ cursor model values > contains exactly 45 models
✓ cursorPlugin > manifest id is cursor
...
```

**Step 4: Run full test suite to catch any regressions**

```bash
bun test
```

Expected: all 129+ tests pass, 0 fail.

**Step 5: Commit**

```bash
git add packages/provider-cursor/src/cursor-plugin.test.ts
git commit -m "test(provider-cursor): update model assertions to match new cursor-api-proxy model list"
```

---

### Task 3: Final verification

**Step 1: Run definition of done**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass with no errors.

**Step 2: Verify model count**

After running tests, confirm the `contains exactly 45 models` test passes, confirming:

- Slow Request: 7 models
- Fast Request: 26 models
- Max Mode: 12 models
- Total: 45 models
