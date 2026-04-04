# Room Description Format Fix - Design Specification

**Version:** 2.0 (Bug Fix)  
**Date:** 2026-04-04  
**Prepared by:** AI-assisted (brainstorming session)  
**Status:** Approved

---

## 1. Overview

### 1.1 Objective

Fix room description format to display correctly in Chatwork by removing Unicode Math Bold and heavy box drawing characters that get stripped by the platform.

### 1.2 Problem Statement

The current room description uses:

- Unicode Math Bold characters (`𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌`)
- Heavy box drawing characters (`╔═══╗`)

**Issue:** Chatwork strips these characters, leaving only emoji and plain text. The description appears broken.

**Current Broken Display:**

```
🌐 TRANSLATION ROOM 🌐
```

(Box and bold text completely stripped)

### 1.3 Success Criteria

- ✅ Room descriptions display correctly in Chatwork
- ✅ Format remains instantly recognizable (<1 second)
- ✅ Maintains visual impact with available characters
- ✅ All tests pass
- ✅ No breaking changes to existing functionality

---

## 2. Scope

### 2.1 In Scope

- Update `composeRoomDescription()` function with new format
- Remove `convertToUnicodeBold()` utility (no longer needed)
- Update unit tests in `compose-room-description.test.ts`
- Apply to newly created rooms only

### 2.2 Out of Scope

- Backfilling descriptions for existing rooms (user will handle manually if needed)
- Localization/i18n support
- Dynamic or configurable text
- Truncation logic for long room names
- Migration script for existing rooms

### 2.3 Non-Goals

- Multi-language support
- Real-time description updates
- Custom templates per room

---

## 3. Solution Design

### 3.1 New Description Format

**Selected Format:**

```
◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: {originalRoomName}
```

**Example with Real Data:**

```
◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: JP Project Demo
```

**Character Breakdown:**

- `◦•●◉✿` - Decorative Unicode symbols (Basic Unicode, universally supported)
- `TRANSLATION ROOM` - Plain text in ALL CAPS (no Unicode bold)
- `╰┈☆┈╯` - Light box drawing + decorative symbols (tested, works in Chatwork)
- `Original` - Static English label
- `{originalRoomName}` - Dynamic room name (no truncation)

### 3.2 Design Rationale

**Why This Format:**

1. **Tested Compatibility:** User confirmed `╰┈☆╯` displays correctly in Chatwork
2. **Visual Impact:** Decorative symbols create instant recognition without bold text
3. **Simplicity:** Only 2 lines, compact, no wasted space
4. **Readability:** Clear hierarchy between title and room information
5. **Safety:** Uses universally supported Unicode characters

**Character Support Research:**

| Character Type     | Example  | Chatwork Support         |
| ------------------ | -------- | ------------------------ |
| Emoji              | 🌐📍     | ✅ Works                 |
| Light box drawing  | `╰┈╯`    | ✅ Works (tested)        |
| Heavy box drawing  | `╔═╗`    | ❌ Stripped              |
| Unicode Math Bold  | `𝐓𝐑𝐀`    | ❌ Stripped              |
| Decorative symbols | `◦•●◉✿☆` | ✅ Works (Unicode Basic) |

### 3.3 Technical Implementation

**File:** `packages/chatwork/src/services/compose-room-description.ts`

**Changes Required:**

1. **Remove** `convertToUnicodeBold()` function (lines 5-15)
   - No longer needed since we're using plain text

2. **Update** `composeRoomDescription()` function (lines 20-29):
   ```typescript
   export function composeRoomDescription(originalRoomName: string): string {
     return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
   ╰┈☆ Original ☆┈╯: ${originalRoomName}`
   }
   ```

**Before:**

```typescript
export function convertToUnicodeBold(text: string): string {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 65 && code <= 90) return String.fromCodePoint(code - 65 + 0x1d400)
      if (code >= 97 && code <= 122) return String.fromCodePoint(code - 97 + 0x1d41a)
      return char
    })
    .join('')
}

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
export function composeRoomDescription(originalRoomName: string): string {
  return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: ${originalRoomName}`
}
```

**Diff Summary:**

- **Deleted:** 11 lines (`convertToUnicodeBold` function)
- **Simplified:** `composeRoomDescription` from 10 lines to 3 lines
- **Total reduction:** ~18 lines removed

---

## 4. Testing Strategy

### 4.1 Unit Tests

**File:** `packages/chatwork/src/services/compose-room-description.test.ts`

**Changes Required:**

1. **Remove** all tests for `convertToUnicodeBold()` (no longer exists)
2. **Update** tests for `composeRoomDescription()`:
   - Test basic case: `'JP Project Demo'` → expected new format
   - Test long names: `'🔴 [URGENT] Q4 2026...'` → no truncation
   - Test special characters: `'Café & Bar 日本語'` → preserved as-is
   - Test edge cases: empty string, single char, 100+ chars

**Example Test:**

```typescript
describe('composeRoomDescription', () => {
  it('generates correct format with decorative symbols', () => {
    const result = composeRoomDescription('JP Project Demo')

    expect(result).toBe('◦•●◉✿ TRANSLATION ROOM ✿◉●•◦\n' + '╰┈☆ Original ☆┈╯: JP Project Demo')
  })

  it('handles long room names without truncation', () => {
    const longName =
      '🔴 [URGENT] Q4 2026 Product Roadmap Planning & Strategy Discussion - Engineering Team Alpha'
    const result = composeRoomDescription(longName)

    expect(result).toContain(longName)
    expect(result).not.toContain('...')
  })

  it('preserves special characters and emoji', () => {
    const result = composeRoomDescription('Café & Bar 日本語 🎉')
    expect(result).toContain('Café & Bar 日本語 🎉')
  })
})
```

### 4.2 Manual E2E Test

**Test Case:** Create New Room → Verify Description

1. Open dashboard → "Create Room" page
2. Fill form:
   - Original Room ID: `123456789`
   - **Original Room Name:** `Test Translation Room`
   - Destination Room Name: `Test-Translation`
   - AI Provider: `gemini`
3. Submit form
4. Open destination room in Chatwork
5. **Verify** description displays:
   ```
   ◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
   ╰┈☆ Original ☆┈╯: Test Translation Room
   ```

**Update Manual E2E Doc:**

- File: `docs/manual-e2e-test.md`
- Section: "Room Creation"
- Add: "Verify new description format"

---

## 5. Deployment & Rollout

### 5.1 Deployment Steps

1. Run tests: `bun test packages/chatwork`
2. Run type check: `bun run typecheck`
3. Run lint: `bun run lint`
4. Commit changes
5. Deploy to production

### 5.2 Rollout Strategy

**Scope:** Only affects **newly created rooms** after deployment

- ✅ New rooms → Get new description format automatically
- ⚠️ Existing rooms → Keep old (broken) format
  - **Rationale:** No backfill to avoid accidental overwrites of manually edited descriptions
  - **User Action:** If needed, user can manually update existing room descriptions via Chatwork UI

**No Downtime:** Pure code change, no data migration, no API contract changes

### 5.3 Verification

**Post-Deployment Check:**

1. Create 1 test room in production
2. Verify description in Chatwork shows new format correctly
3. Delete test room

---

## 6. Risks & Mitigations

### 6.1 Identified Risks

| Risk                                                          | Severity     | Mitigation                                                                                          |
| ------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Light box drawing `╰┈╯` might not render on old devices       | **Low**      | User already tested in their Chatwork environment. Characters are Unicode Basic (widely supported). |
| Decorative symbols render as question marks on legacy systems | **Very Low** | Symbols are from Unicode Basic Multilingual Plane. Modern Chatwork clients support them.            |
| Users prefer old format (subjective)                          | **N/A**      | Old format is broken (characters stripped). New format is only viable option.                       |

### 6.2 Backward Compatibility

✅ **Fully backward compatible:**

- Same function signature: `composeRoomDescription(originalRoomName: string): string`
- Called in same places: `rooms.ts` and `free-rooms.ts`
- No API contract changes
- No schema changes

---

## 7. Constraints

### 7.1 Platform Constraints

- **Chatwork Description Field:**
  - Character limit: ~500 characters
  - No HTML/Markdown support
  - Strips heavy box drawing and Unicode Math Bold
  - Supports light box drawing, emoji, and plain text

### 7.2 Design Constraints

- Static English text only (no localization)
- No dynamic text configuration
- No truncation for long room names
- Must remain instantly recognizable (<1 second)

---

## 8. Acceptance Criteria

### 8.1 Functional Requirements

- [ ] `composeRoomDescription()` returns new format
- [ ] New format displays correctly in Chatwork (verified via screenshot/manual test)
- [ ] All unit tests pass
- [ ] `convertToUnicodeBold()` function removed
- [ ] No regression in existing room creation flow

### 8.2 Non-Functional Requirements

- [ ] Code is cleaner (fewer lines, simpler logic)
- [ ] Tests are updated and comprehensive
- [ ] No performance degradation
- [ ] Documentation updated (`docs/manual-e2e-test.md`)

---

## 9. Open Risks

**None.** All material ambiguities resolved during brainstorming session.

---

## 10. Future Scope (Deferred)

These items were discussed but explicitly marked **out-of-scope** for this bug fix:

- Localization support (multiple languages)
- Configurable text templates
- Auto-migration script for existing rooms
- Dynamic description updates when original room name changes
- Truncation logic for extremely long names

---

## 11. Decision Log

| ID      | Decision                                                | Status   | Provenance              | Risk | Notes                                               |
| ------- | ------------------------------------------------------- | -------- | ----------------------- | ---- | --------------------------------------------------- |
| DEC-001 | Line spacing: No blank line between title and room info | Accepted | user-confirmed          | low  | User revised from AI recommendation of 1 blank line |
| DEC-002 | Text: Static English only                               | Accepted | user-confirmed          | low  | No localization needed                              |
| DEC-003 | Long names: No truncation                               | Accepted | user-confirmed          | low  | Display full room name regardless of length         |
| DEC-004 | Character set: Decorative Unicode + light box drawing   | Accepted | user-confirmed + tested | low  | User tested `╰┈╯` in Chatwork, works correctly      |
| DEC-005 | Tests: Update unit tests                                | Accepted | user-confirmed          | low  | Maintain test coverage                              |
| DEC-006 | Existing rooms: No backfill/migration                   | Accepted | user-confirmed          | low  | Only apply to new rooms                             |

---

## 12. References

- **Original Feature Spec:** `docs/superpowers/specs/2026-04-03-room-description-feature.md`
- **Bug Report:** Screenshot showing stripped characters in Chatwork description
- **User Example:** `◦•●◉✿ Translation Demo ✿◉●•◦\n📍 Original: JP Project Demo`

---

## Revision History

### 2026-04-04 - Post-Implementation Simplification

**Changes:**

- Reduced test count from 6 to 3 tests (removed redundant validations)
- Eliminated duplicate mock implementations (now import real function)
- Removed YAGNI test for non-existent truncation feature

**Impact:**

- Net reduction: -41 lines (63% of test/mock code)
- Coverage maintained: 3 focused tests still validate all meaningful behavior
- DRY improved: Zero duplication in test mocks

**Test Results:** All 1006 tests passing after simplification

**Commit:** bb49e3d - refactor(repo): simplify room description tests and remove duplication

---

**End of Specification**
