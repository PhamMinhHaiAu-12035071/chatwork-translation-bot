# Enable Clear Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port verified Clear translation style from nghien_cuu_cua_toi to production dashboard

**Architecture:** Simple schema update - add Clear to active styles array and mappings in dashboard. No code changes needed, Clear preset already exists in provider-kagi types.

**Tech Stack:** TypeScript, Markdown, git

**Design Spec:** `docs/superpowers/specs/2026-04-11-enable-clear-style-design.md`

---

## Overview

This plan enables Clear style (natural+standard+standard preset) on dashboard after successful verification in nghien_cuu_cua_toi research environment.

**Scope:** Minimal - 2 file changes only, no tests added.

**Evidence:** Clear verified 2026-04-11 in nghien_cuu_cua_toi with console output showing stable UI interaction.

---

## Task 1: Document Clear Verification

**Files:**

- Modify: `docs/kagi-style-verification.md:160-161`

**Goal:** Add Clear verification entry to verification log table

---

### Step 1: Read current verification.md structure

```bash
cat docs/kagi-style-verification.md | grep -A 5 "Verification Log"
```

Expected: See table with Wild (VERIFIED) and Warm/Easy/etc (PENDING)

---

### Step 2: Add Clear verification entry

File: `docs/kagi-style-verification.md`

Locate line 160-161 (verification log table). Insert Clear entry **after Wild, before Warm**.

**Before:**

```markdown
| Wild | ✅ VERIFIED | 2026-04-09 | [Name] | All checks pass, "chim mồi" for vi_casual works |
| Warm | ⏳ PENDING | - | - | - |
```

**After:**

```markdown
| Wild | ✅ VERIFIED | 2026-04-09 | [Name] | All checks pass, "chim mồi" for vi_casual works |
| Clear | ✅ VERIFIED | 2026-04-11 | phamau | natural+standard+standard, no chim mồi needed |
| Warm | ⏳ PENDING | - | - | - |
```

**Key details:**

- Status: ✅ VERIFIED
- Date: 2026-04-11
- Tester: phamau
- Notes: `natural+standard+standard, no chim mồi needed` (emphasize difference from Wild)

---

### Step 3: Verify table formatting preserved

```bash
cat docs/kagi-style-verification.md | grep -A 15 "Verification Log"
```

Expected: Table columns aligned, Clear entry shows between Wild and Warm

---

### Step 4: Commit verification doc update

```bash
git add docs/kagi-style-verification.md
git commit -m "docs(repo): document Clear style verification

Add Clear to verification log table:
- Status: VERIFIED (2026-04-11)
- Preset: natural+standard+standard
- No 'chim mồi' needed (unlike Wild which uses vietnamese_casual)
- Verified by: phamau in nghien_cuu_cua_toi

Evidence: Console output shows stable UI interaction, correct URL params."
```

Expected: Commit succeeds, pre-commit hooks pass (prettier, typecheck, tests)

---

## Task 2: Enable Clear in Dashboard Schemas

**Files:**

- Modify: `packages/dashboard/src/lib/free-room-schemas.ts:15,21-28`

**Goal:** Add Clear to ACTIVE_KAGI_STYLES and label/description mappings

---

### Step 1: Read current schemas structure

```bash
cat packages/dashboard/src/lib/free-room-schemas.ts | head -35
```

Expected: See `ACTIVE_KAGI_STYLES = ['Raw']`, labels mapping with only Raw, descriptions mapping with only Raw

---

### Step 2: Add Clear to ACTIVE_KAGI_STYLES array

File: `packages/dashboard/src/lib/free-room-schemas.ts`

Locate line 15. Change:

**Before:**

```typescript
const ACTIVE_KAGI_STYLES = ['Raw'] as const satisfies readonly KagiStyle[]
```

**After:**

```typescript
const ACTIVE_KAGI_STYLES = ['Raw', 'Clear'] as const satisfies readonly KagiStyle[]
```

**Validation:** TypeScript will infer `FreeRoomKagiStyle = 'Raw' | 'Clear'`

---

### Step 3: Add Clear to labels mapping

File: `packages/dashboard/src/lib/free-room-schemas.ts`

Locate lines 21-23. Change:

**Before:**

```typescript
export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Raw',
}
```

**After:**

```typescript
export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Raw',
  Clear: 'Clear',
}
```

**Validation:** TypeScript will enforce Record completeness

---

### Step 4: Add Clear to descriptions mapping

File: `packages/dashboard/src/lib/free-room-schemas.ts`

Locate lines 25-28. Change:

**Before:**

```typescript
export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Casual Vietnamese, suitable for friends or peers',
}
```

**After:**

```typescript
export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Casual Vietnamese, suitable for friends or peers',
  Clear: 'Balanced, natural, and easy to read.',
}
```

**Note:** Description text matches `packages/provider-kagi/src/types.ts` Clear preset description (line 127)

---

### Step 5: Verify TypeScript compilation

```bash
cd packages/dashboard
bun run typecheck
```

Expected: No errors. Type inference should work:

- `FreeRoomKagiStyle` type = `'Raw' | 'Clear'`
- Zod schema automatically validates enum values
- Record mappings complete for both styles

---

### Step 6: Verify all tests pass (regression check)

```bash
cd packages/dashboard
bun test
```

Expected: All existing tests pass. No test modifications needed (out of scope).

---

### Step 7: Verify monorepo-wide tests pass

```bash
bun test
```

Expected: All packages tests pass, no regressions introduced.

---

### Step 8: Commit dashboard schema changes

```bash
git add packages/dashboard/src/lib/free-room-schemas.ts
git commit -m "feat(dashboard): enable Clear style after verification

Add Clear translation style to dashboard schemas:
- Add 'Clear' to ACTIVE_KAGI_STYLES array
- Add label: 'Clear'
- Add description: 'Balanced, natural, and easy to read.'

Clear preset: natural + standard formality + standard reading level.
No 'chim mồi' flow needed (unlike Raw with vietnamese_casual).

Verified: 2026-04-11 in nghien_cuu_cua_toi by phamau.
Evidence: UI interaction stable, translation output matches spec.

Backward compatible: No changes to Raw logic or existing rooms."
```

Expected: Commit succeeds with pre-commit hooks passing.

---

## Task 3: Manual Verification Testing

**Goal:** Verify Clear style works correctly in dashboard UI

**Note:** This is manual testing only (no automated tests per minimal scope).

---

### Step 1: Start dashboard dev server

```bash
cd packages/dashboard
bun run dev
```

Expected: Vite dev server starts on http://localhost:5173

---

### Step 2: Test Create Room with Clear

**Manual steps:**

1. Open http://localhost:5173
2. Click "Create Free Room"
3. Fill required fields:
   - Original Room ID: 12345
   - Original Room Name: Test Room
   - Destination Room Name: Test Dest
   - Context: (leave empty or add test text)
4. **Translation Style dropdown** - verify shows:
   - Raw (Casual Vietnamese, suitable for friends or peers)
   - Clear (Balanced, natural, and easy to read.) ← NEW
5. Select "Clear"
6. Click "Create Room"
7. Verify room created successfully

**Expected:** Clear style selectable, room creation works

---

### Step 3: Test Edit Room to Clear

**Manual steps:**

1. Open existing Raw room (if any)
2. Click "Edit"
3. Change style dropdown to "Clear"
4. Click "Save"
5. Verify room updated successfully

**Expected:** Style switching works, no validation errors

---

### Step 4: Verify dropdown validation

**Manual steps:**

1. Open Create Room form
2. Inspect Translation Style dropdown
3. Verify ONLY Raw and Clear options visible (no Warm, Easy, etc)

**Expected:** Dropdown constrained to verified styles only

---

### Step 5: Test backward compatibility (Raw still works)

**Manual steps:**

1. Create/open room with Raw style
2. Verify Raw translation still works
3. No UI errors or console warnings

**Expected:** Raw unaffected by Clear addition

---

### Step 6: Stop dev server

```bash
# Press Ctrl+C in terminal running `bun run dev`
```

**Verification complete.** Clear style enabled and working.

---

## Task 4: Final Verification

**Goal:** Confirm all changes complete and committed

---

### Step 1: Verify git status clean

```bash
git status
```

Expected: No unstaged changes, 2 commits ahead of origin:

1. `docs(repo): document Clear style verification`
2. `feat(dashboard): enable Clear style after verification`

---

### Step 2: Review commit history

```bash
git log --oneline -3
```

Expected: See both Clear commits at top

---

### Step 3: Verify files modified

```bash
git diff HEAD~2 --stat
```

Expected:

```
docs/kagi-style-verification.md             | 1 +
packages/dashboard/src/lib/free-room-schemas.ts | 6 ++++--
2 files changed, 5 insertions(+), 2 deletions(-)
```

---

### Step 4: Final check - Clear preset exists in types

```bash
grep -A 5 "Clear:" packages/provider-kagi/src/types.ts
```

Expected: See Clear preset definition (already exists, no changes needed):

```typescript
Clear: {
  label: 'Clear',
  translationType: 'natural',
  formality: 'standard',
  readingLevel: 'standard',
},
```

---

## Completion Checklist

**Before marking complete, verify:**

- [ ] `docs/kagi-style-verification.md` updated with Clear entry
- [ ] Clear added to `ACTIVE_KAGI_STYLES` array
- [ ] Clear label added to mapping
- [ ] Clear description added to mapping
- [ ] TypeScript compilation passes
- [ ] All tests pass (no regressions)
- [ ] Manual testing: Create room with Clear works
- [ ] Manual testing: Edit room to Clear works
- [ ] Manual testing: Raw style still works (backward compatible)
- [ ] Manual testing: Dropdown shows only Raw + Clear
- [ ] 2 git commits created with clear messages
- [ ] Git status clean (no uncommitted changes)

**Definition of Done:** All checklist items checked.

---

## Rollback Procedure (if needed)

If Clear causes issues in production:

### Step 1: Revert dashboard commit

```bash
git log --oneline -5  # Find commit hash for "feat(dashboard): enable Clear"
git revert <commit-hash>
git push origin main
```

### Step 2: Revert verification doc commit

```bash
git log --oneline -5  # Find commit hash for "docs(repo): document Clear"
git revert <commit-hash>
git push origin main
```

**Result:** Clear disabled, Raw remains active. Safe rollback with no data loss.

---

## Notes

**Why No Tests Added:**

- Minimal scope prioritizes speed
- Clear already verified in nghien_cuu_cua_toi
- Existing tests cover schema validation
- Manual testing sufficient for additive feature

**Why No README/CHANGELOG:**

- Out of scope (documented in spec non-goals)
- Can be added in future PR if needed

**Clear vs Raw Differences:**

- Raw: `vietnamese_casual` formality → needs "chim mồi" 2-phase flow
- Clear: `standard` formality → single-phase flow, simpler
- Both use `natural` translation type (not literal)
- Clear uses `standard` reading level (Raw uses `c2`)

**Future Work (Deferred):**

- Enable additional styles (Warm, Easy, Smart, etc)
- Automated verification tests
- Documentation updates
- E2E tests for Clear style

---

**End of Implementation Plan**
