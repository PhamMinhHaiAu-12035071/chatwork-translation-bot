# Implementation Plan: Emoji Status Indicators

**Date:** 2026-04-03  
**Design Spec:** `docs/superpowers/specs/2026-04-03-emoji-status-indicators-design.md`  
**Estimated Complexity:** Small (1-2 hours)

---

## Overview

Replace plain `[Created]`/`[Updated]` status text with emoji-decorated Unicode bold indicators:
- Created: `🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿`
- Updated: `🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥`

**Approach:** Simple string replacement in message composition logic + test updates.

---

## Tasks

### Task 1: Update message composition logic

**File:** `packages/chatwork/src/services/compose-translated-message.ts`

**Changes:**

```typescript
// Before (lines 37-39):
const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
const header = `[piconname:${String(command.senderAccountId)}] [${eventType}]`

// After:
const eventDecoration = command.sourceEventType === 'message_created'
  ? '🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿'
  : '🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥'
const header = `[piconname:${String(command.senderAccountId)}] ${eventDecoration}`
```

**Validation:**
- TypeScript compiles without errors
- ESLint passes
- No logic changes beyond string format

**Commit message:**
```
feat(chatwork): add emoji decoration to Created/Updated status

Replace plain text status with emoji-decorated Unicode bold:
- Created: 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿
- Updated: 🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥

Provides instant visual recognition for internal team use.
Ref: docs/superpowers/specs/2026-04-03-emoji-status-indicators-design.md
```

---

### Task 2: Update unit tests

**File:** `packages/chatwork/src/services/compose-translated-message.test.ts`

**Changes:**

1. Update test: "returns single message with piconname header and translated body"
   ```typescript
   // Line 79 - Change:
   expect(lines[0]).toBe('[piconname:100] [Created]')
   // To:
   expect(lines[0]).toBe('[piconname:100] 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
   ```

2. Update test: "shows [Updated] indicator for message_updated events"
   ```typescript
   // Change assertion to expect:
   expect(result.message).toContain('🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥')
   ```

3. Update test: "uses piconname tag even when member not in cache"
   ```typescript
   // Update assertion to new format:
   expect(result.message).toContain('[piconname:999] 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
   ```

4. Add new test for emoji decoration distinction:
   ```typescript
   it('uses distinct emoji decorations for created vs updated messages', async () => {
     const createdCommand = makeCommand('Test message', {
       webhook_event_type: 'message_created',
       webhook_event: {
         account_id: 100,
         send_time: 1711271400,
       },
     })

     const updatedCommand = makeCommand('Test message', {
       webhook_event_type: 'message_updated',
       webhook_event: {
         account_id: 100,
         send_time: 1711271400,
         update_time: 1711271500,
       },
     })

     const createdResult = await composeTranslatedMessage(createdCommand, {
       translatedSegments: ['Test translation'],
       apiToken: 'test-token',
       roomCache: new Map([[777, 'Test Room']]),
     })

     const updatedResult = await composeTranslatedMessage(updatedCommand, {
       translatedSegments: ['Test translation'],
       apiToken: 'test-token',
       roomCache: new Map([[777, 'Test Room']]),
     })

     // Created uses nature theme
     expect(createdResult.message).toContain('🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿')
     expect(createdResult.message).not.toContain('🔥⚡🔥')

     // Updated uses energy theme
     expect(updatedResult.message).toContain('🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥')
     expect(updatedResult.message).not.toContain('🌿🌺🌿')
   })
   ```

**Validation:**
- Run: `bun test packages/chatwork/src/services/compose-translated-message.test.ts`
- All 11 tests pass (10 existing + 1 new)

**Commit message:**
```
test(chatwork): update tests for emoji status indicators

Update all test expectations to match new emoji decoration format:
- Created: 🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿
- Updated: 🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥

Add new test to verify distinct emoji themes per event type.
```

---

### Task 3: Run full validation suite

**Commands:**
```bash
bun test && bun run typecheck && bun run lint
```

**Expected results:**
- Tests: 983/983 pass (982 existing + 1 new, 1 PoC failure ignored)
- TypeCheck: ✅ No errors
- Lint: ✅ No errors

**If issues found:**
- Review error messages
- Fix any unexpected failures
- Re-run validation

**No commit** (validation only)

---

### Task 4: Manual cross-platform verification

**Deployment:**
1. Deploy to development environment
2. Trigger test translations (both created and updated events)

**Testing matrix:**

| Platform | Created Rendering | Updated Rendering | Notes |
|----------|-------------------|-------------------|-------|
| Chatwork Desktop (macOS) | ✅ / ❌ | ✅ / ❌ | Check emoji + Unicode bold |
| Chatwork Mobile (iOS) | ✅ / ❌ | ✅ / ❌ | Verify no boxes/tofu |
| Chatwork Mobile (Android) | ✅ / ❌ | ✅ / ❌ | Test Unicode bold support |
| Chatwork Web (Chrome) | ✅ / ❌ | ✅ / ❌ | Baseline reference |

**Visual checks:**
- [ ] Emoji render correctly (not as □ boxes)
- [ ] Unicode bold displays (or gracefully falls back to ASCII)
- [ ] Created/Updated instantly distinguishable
- [ ] No line breaking between emoji and text
- [ ] Format looks good in message list
- [ ] Format looks good in conversation view

**Acceptance criteria:**
- Created and Updated must be visually distinct
- If Unicode bold fails (shows as regular text), emoji decoration still provides clear distinction
- No rendering bugs that break message display

**Document in:** `docs/verification/2026-04-03-emoji-status-verification.md`

---

## Definition of Done

- [x] Task 1: Code updated with emoji decorations
- [x] Task 2: All tests pass with new format
- [x] Task 3: Full validation suite passes (tests + typecheck + lint)
- [ ] Task 4: Manual verification completed across platforms
- [ ] All changes committed with descriptive messages
- [ ] No regressions in existing functionality

---

## Rollback Plan

If critical rendering issues discovered in production:

```bash
# Revert the feature commit
git revert <commit-hash>

# Or restore previous format temporarily
const eventDecoration = command.sourceEventType === 'message_created'
  ? '[Created]'
  : '[Updated]'
```

**Indicators for rollback:**
- Emoji render as boxes on majority of devices
- Unicode bold causes text encoding issues
- User feedback indicates confusion rather than clarity

---

## Notes

**Why no feature flag:**
- Simple visual change, non-breaking
- Easy to revert if needed
- Internal team use only (low blast radius)

**Why no database changes:**
- Format change is purely presentational
- No data model affected
- No migration required

**Performance impact:**
- Negligible (string concatenation only)
- No additional API calls
- No computational overhead
