# Room Description Format Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix room description to display correctly in Chatwork by replacing Unicode Math Bold and heavy box drawing with supported decorative symbols.

**Architecture:** Single function simplification - remove `convertToUnicodeBold()` utility, update `composeRoomDescription()` template string to use plain text + decorative Unicode + light box drawing characters.

**Tech Stack:** TypeScript, Bun (test runner)

---

## File Structure

**Existing files to modify:**

- `packages/chatwork/src/services/compose-room-description.ts` (production code)
  - **Remove:** `convertToUnicodeBold()` function (lines 5-15)
  - **Update:** `composeRoomDescription()` function (lines 20-29) → simplify to 3 lines
- `packages/chatwork/src/services/compose-room-description.test.ts` (tests)
  - **Remove:** All `convertToUnicodeBold()` tests (~10 test cases)
  - **Update:** `composeRoomDescription()` tests to match new format

**No new files created.**

---

## Task 1: Update Tests for New Description Format

**Files:**

- Modify: `packages/chatwork/src/services/compose-room-description.test.ts`

This task implements TDD by writing failing tests first.

---

- [ ] **Step 1.1: Remove old `convertToUnicodeBold()` tests**

**Action:** Delete the entire `describe('convertToUnicodeBold', ...)` block

**Location:** Lines 4-52 (approximately)

**Rationale:** Function will be removed, so tests are no longer needed.

---

- [ ] **Step 1.2: Write new test - basic format**

**Action:** Replace existing `composeRoomDescription()` tests with new ones.

**Code:**

```typescript
import { describe, expect, it } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

describe('composeRoomDescription', () => {
  it('generates correct format with decorative symbols and no blank line', () => {
    const result = composeRoomDescription('JP Project Demo')

    const expected = '◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: JP Project Demo'

    expect(result).toBe(expected)
  })
})
```

**Notes:**

- Format: Line 1 (decorative title), newline, Line 2 (original room)
- **No blank line** between lines (user confirmed)
- Characters: `◦•●◉✿` (decorative), `╰┈☆╯` (light box drawing)

---

- [ ] **Step 1.3: Write test - long room names (no truncation)**

**Code:**

```typescript
it('handles long room names without truncation', () => {
  const longName =
    '🔴 [URGENT] Q4 2026 Product Roadmap Planning & Strategy Discussion - Engineering Team Alpha Beta Gamma Delta'
  const result = composeRoomDescription(longName)

  // Should contain full name, no "..." truncation
  expect(result).toContain(longName)
  expect(result).not.toContain('...')

  // Should still have decorative title
  expect(result).toContain('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦')
})
```

**Notes:**

- User confirmed: no truncation for long names
- Tests both that long name appears AND no ellipsis added

---

- [ ] **Step 1.4: Write test - special characters preserved**

**Code:**

```typescript
it('preserves special characters, Unicode, and emoji in room name', () => {
  const specialName = 'Café & Bar 日本語 🎉 <Test>'
  const result = composeRoomDescription(specialName)

  expect(result).toContain(specialName)
  expect(result).toContain('╰┈☆ Original ☆┈╯: Café & Bar 日本語 🎉 <Test>')
})
```

**Notes:**

- Tests: accented chars (`é`), Unicode (日本語), emoji (🎉), HTML-like chars (`<>`)
- All should be preserved as-is, no escaping

---

- [ ] **Step 1.5: Write test - empty string edge case**

**Code:**

```typescript
it('handles empty room name gracefully', () => {
  const result = composeRoomDescription('')

  const expected = '◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: '

  expect(result).toBe(expected)
})
```

**Notes:**

- Edge case: empty `originalRoomName`
- Should still produce valid format (label present, just no name after colon)

---

- [ ] **Step 1.6: Write test - single character name**

**Code:**

```typescript
it('handles single character room name', () => {
  const result = composeRoomDescription('A')

  expect(result).toBe('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: A')
})
```

**Notes:**

- Edge case: minimal room name
- Ensures template works correctly even with 1 char

---

- [ ] **Step 1.7: Write test - verify exact format structure**

**Code:**

```typescript
it('maintains exact 2-line structure with no extra whitespace', () => {
  const result = composeRoomDescription('Test Room')
  const lines = result.split('\n')

  // Should be exactly 2 lines
  expect(lines).toHaveLength(2)

  // Line 1 should match title pattern
  expect(lines[0]).toBe('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦')

  // Line 2 should match original pattern
  expect(lines[1]).toBe('╰┈☆ Original ☆┈╯: Test Room')

  // No trailing or leading whitespace
  expect(result).not.toMatch(/^\s/)
  expect(result).not.toMatch(/\s$/)
})
```

**Notes:**

- Structural validation: exactly 2 lines, no blanks
- No accidental whitespace padding

---

- [ ] **Step 1.8: Run tests to verify they all fail**

**Command:**

```bash
cd packages/chatwork
bun test src/services/compose-room-description.test.ts
```

**Expected Output:**

```
FAIL  src/services/compose-room-description.test.ts
  ✗ composeRoomDescription > generates correct format with decorative symbols...
    - Expected: ◦•●◉✿ TRANSLATION ROOM ✿◉●•◦...
    + Received: ╔═══════════════════...
```

All 6 new tests should **FAIL** because the implementation still uses old format.

**Notes:**

- If tests pass, stop - implementation already updated (shouldn't happen in TDD)
- If tests fail with different error (e.g., function not found), check imports

---

- [ ] **Step 1.9: Commit test changes**

**Command:**

```bash
git add packages/chatwork/src/services/compose-room-description.test.ts
git commit -m "test(chatwork): update room description tests for new format

- Remove convertToUnicodeBold() tests (function will be removed)
- Add tests for new decorative symbol format
- Test edge cases: long names, special chars, empty string
- All tests currently FAIL (TDD - implementation next)"
```

**Notes:**

- Commit tests before implementation (TDD discipline)
- Commit message explains current state (tests fail)

---

## Task 2: Update `composeRoomDescription()` Implementation

**Files:**

- Modify: `packages/chatwork/src/services/compose-room-description.ts`

---

- [ ] **Step 2.1: Remove `convertToUnicodeBold()` function**

**Action:** Delete lines 5-15

**Before:**

```typescript
/**
 * Converts ASCII text to Unicode Math Bold characters (U+1D400-U+1D433).
 * Uses codepoint arithmetic for A-Z (U+1D400-U+1D419) and a-z (U+1D41A-U+1D433).
 */
export function convertToUnicodeBold(text: string): string {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 65 && code <= 90) return String.fromCodePoint(code - 65 + 0x1d400) // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(code - 97 + 0x1d41a) // a-z
      return char
    })
    .join('')
}
```

**After:**

```typescript
// (Lines 5-15 deleted - function removed)
```

**Notes:**

- Function no longer needed (Chatwork strips Unicode Math Bold)
- Tests for this function already removed in Task 1

---

- [ ] **Step 2.2: Update `composeRoomDescription()` to new format**

**Action:** Replace lines 20-29 with simplified implementation

**Before:**

```typescript
/**
 * Composes the Neubrutalism-styled room description for translation rooms.
 */
export function composeRoomDescription(originalRoomName: string): string {
  const title = convertToUnicodeBold('TRANSLATION ROOM')
  const label = convertToUnicodeBold('Original')

  return `╔═══════════════════════════════════════╗
║    🌐 ${title} 🌐    ║
╚═══════════════════════════════════════╝

📍 ${label}: ${originalRoomName}`
}
```

**After:**

```typescript
/**
 * Composes room description with decorative symbols (Chatwork-compatible format).
 * Uses plain text + light box drawing + emoji instead of Unicode Math Bold.
 */
export function composeRoomDescription(originalRoomName: string): string {
  return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: ${originalRoomName}`
}
```

**Notes:**

- Simplified from 10 lines to 3 lines
- No intermediate variables needed
- Template literal directly returns format
- Updated JSDoc to reflect new approach

---

- [ ] **Step 2.3: Verify file structure after changes**

**Action:** Read the updated file to confirm structure

**Expected result:**

File should contain only:

1. JSDoc comment (lines 1-3)
2. `composeRoomDescription()` function (lines 4-7)

Total: ~7 lines (down from ~29 lines)

**Command:**

```bash
cat packages/chatwork/src/services/compose-room-description.ts
```

**Expected Output:**

```typescript
/**
 * Composes room description with decorative symbols (Chatwork-compatible format).
 * Uses plain text + light box drawing + emoji instead of Unicode Math Bold.
 */
export function composeRoomDescription(originalRoomName: string): string {
  return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: ${originalRoomName}`
}
```

**If structure incorrect:** Re-apply Step 2.1 and 2.2

---

- [ ] **Step 2.4: Run tests to verify they all pass**

**Command:**

```bash
cd packages/chatwork
bun test src/services/compose-room-description.test.ts
```

**Expected Output:**

```
PASS  src/services/compose-room-description.test.ts
  ✓ composeRoomDescription > generates correct format... (1.2ms)
  ✓ composeRoomDescription > handles long room names... (0.8ms)
  ✓ composeRoomDescription > preserves special characters... (0.6ms)
  ✓ composeRoomDescription > handles empty room name... (0.5ms)
  ✓ composeRoomDescription > handles single character... (0.4ms)
  ✓ composeRoomDescription > maintains exact 2-line structure... (0.7ms)

Tests:  6 passed, 6 total
Time:   0.234s
```

All 6 tests should **PASS**.

**If any test fails:**

- Check format exactly matches test expectations
- Verify no extra whitespace in template literal
- Ensure no blank line between title and original room line

---

- [ ] **Step 2.5: Run all chatwork package tests**

**Command:**

```bash
cd packages/chatwork
bun test
```

**Expected:** All tests pass (not just `compose-room-description.test.ts`)

**Why:** Ensure no regressions in other services

**If other tests fail:** Check if they depend on `convertToUnicodeBold()` (shouldn't, but verify)

---

- [ ] **Step 2.6: Commit implementation changes**

**Command:**

```bash
git add packages/chatwork/src/services/compose-room-description.ts
git commit -m "feat(chatwork): simplify room description format for Chatwork compatibility

- Remove convertToUnicodeBold() function (Unicode Math Bold stripped by Chatwork)
- Update composeRoomDescription() to use decorative symbols + light box drawing
- New format: ◦•●◉✿ TRANSLATION ROOM ✿◉●•◦ / ╰┈☆ Original ☆┈╯: {name}
- Reduce function from 10 lines to 3 lines
- All tests pass"
```

**Notes:**

- Separate commit from tests (TDD: test commit → implementation commit)
- Commit message explains what changed and why

---

## Task 3: Verify Integration and Run Full Test Suite

**Files:**

- No file changes, verification only

---

- [ ] **Step 3.1: Run full monorepo test suite**

**Command:**

```bash
bun test
```

**Expected:** All tests pass across all packages

**Check specific counts:**

- `packages/chatwork`: All tests pass (including our 6 new tests)
- `packages/translator`: All tests pass (no changes, but uses `composeRoomDescription`)
- `packages/dashboard`: All tests pass (no changes)

**If any package fails:** Investigate which test and why. Should not happen since we only changed internal implementation of one function.

---

- [ ] **Step 3.2: Run type checking**

**Command:**

```bash
bun run typecheck
```

**Expected:** No type errors

**Why:** Ensure TypeScript is happy with the changes

**If errors occur:**

- Check if any file imports `convertToUnicodeBold` (shouldn't, it was only used internally)
- Verify function signature of `composeRoomDescription` unchanged: `(originalRoomName: string) => string`

---

- [ ] **Step 3.3: Run linter**

**Command:**

```bash
bun run lint
```

**Expected:** No lint errors

**Common issues to watch:**

- Unused imports (should be none now)
- Formatting (template literal might need adjustment)

**If lint fails:** Run `bun run lint:fix` to auto-fix formatting issues

---

- [ ] **Step 3.4: Manual smoke test (optional but recommended)**

**Action:** Test in development environment

**Steps:**

1. Start dev server: `bun run dev`
2. Open dashboard: http://localhost:5173
3. Create a new translation room:
   - Original Room ID: `123456789`
   - **Original Room Name:** `Test Description Format`
   - Fill other required fields
4. Submit form
5. Check Chatwork destination room description

**Expected description in Chatwork:**

```
◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: Test Description Format
```

**Notes:**

- This verifies end-to-end integration
- Confirms decorative symbols render correctly in actual Chatwork
- If time-constrained, skip this step (tests already cover logic)

---

- [ ] **Step 3.5: Final commit (if any fixes made in Task 3)**

**Command:** (only if Step 3.2 or 3.3 required changes)

```bash
git add .
git commit -m "chore(chatwork): fix linting/types after room description update"
```

**Notes:**

- Only commit if Step 3.2 or 3.3 revealed issues
- If no issues, skip this step (all commits already done)

---

## Task 4: Update Documentation (Optional)

**Files:**

- Modify: `docs/manual-e2e-test.md`

**Note:** This task is OPTIONAL - only required if manual E2E doc exists and needs updating.

---

- [ ] **Step 4.1: Check if manual E2E doc exists**

**Command:**

```bash
ls docs/manual-e2e-test.md
```

**If file exists:** Continue to Step 4.2

**If file does NOT exist:** Skip Task 4 entirely (no doc to update)

---

- [ ] **Step 4.2: Update room creation test case**

**Action:** Find "Room Creation" section and update description verification step

**Add/Update this test case:**

```markdown
### Test Case: Create Translation Room

1. Open dashboard → "Create Room" page
2. Fill form:
   - Original Room ID: `123456789`
   - **Original Room Name:** `E2E Test Room`
   - Destination Room Name: `E2E-Translation`
   - AI Provider: `gemini`
   - Translation Style: `NATURAL_CASUAL`
3. Submit form
4. **Verify** success toast: `"E2E-Translation" was created successfully`
5. Open destination room in Chatwork
6. **Verify** room description displays:
```

◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: E2E Test Room

```

**Expected:** All decorative symbols, light box drawing, and emoji render correctly
```

**Notes:**

- Focus on visual verification of new format
- Ensure symbols `◦•●◉✿╰┈☆╯` are explicitly mentioned

---

- [ ] **Step 4.3: Commit doc update**

**Command:**

```bash
git add docs/manual-e2e-test.md
git commit -m "docs(repo): update E2E test for new room description format"
```

**Notes:**

- Only run if Step 4.1 found the file
- Use `repo` scope for docs changes

---

## Self-Review Checklist

Before marking the plan complete, verify:

- [x] **Spec coverage:** All requirements from design spec implemented
  - ✅ Remove `convertToUnicodeBold()` - Task 2.1
  - ✅ Update `composeRoomDescription()` format - Task 2.2
  - ✅ Update tests - Task 1
  - ✅ No blank line between lines - Verified in tests Step 1.2
  - ✅ No truncation for long names - Test Step 1.3
  - ✅ Apply to new rooms only - No migration code added ✓

- [x] **No placeholders:** All code blocks complete, no TBD/TODO
  - ✅ All test code provided in full
  - ✅ All implementation code provided in full
  - ✅ All commands with expected outputs

- [x] **Type consistency:** Function signatures match across tasks
  - ✅ `composeRoomDescription(originalRoomName: string): string` - consistent
  - ✅ Test expectations match implementation output format

- [x] **File paths:** All paths are exact and absolute from repo root
  - ✅ `packages/chatwork/src/services/compose-room-description.ts`
  - ✅ `packages/chatwork/src/services/compose-room-description.test.ts`
  - ✅ `docs/manual-e2e-test.md`

- [x] **Commands:** All commands include expected output
  - ✅ Test commands show pass/fail output
  - ✅ Git commands show exact commit messages

---

## Summary

**Total Tasks:** 4 (3 required, 1 optional)

**Estimated Time:** 30-45 minutes

**Key Changes:**

- Remove 11 lines (delete `convertToUnicodeBold` function)
- Simplify 10 lines to 3 lines (update `composeRoomDescription`)
- Update ~30 lines in tests (remove old tests, add 6 new tests)

**Net Result:** -18 lines production code, +6 test cases

**Risk:** Low (backward compatible, only affects new rooms)

---

**Plan complete. Ready for execution.**
