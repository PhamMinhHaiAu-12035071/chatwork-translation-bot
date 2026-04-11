# Enable Clear Style - Design Specification

**Version:** 1.0  
**Date:** 2026-04-11  
**Prepared by:** AI-assisted (phamau)  
**Status:** Approved for implementation

---

## 1. Objective

Port verified "Clear" translation style from nghien_cuu_cua_toi to packages/production, enabling user selection on dashboard.

**Success Criteria:**

- Clear style available in dashboard room creation/editing
- Translation quality matches nghien_cuu_cua_toi verification
- No regression to existing Raw style functionality

---

## 2. Scope

### In Scope

✅ Document Clear verification findings in `docs/kagi-style-verification.md`  
✅ Add "Clear" to `FREE_ROOM_KAGI_STYLES` in `packages/dashboard/src/lib/free-room-schemas.ts`  
✅ Update labels and descriptions for Clear  
✅ Commit changes with clear message

### Out of Scope

❌ Automated tests (nghien_cuu_cua_toi already verified manually)  
❌ README/CHANGELOG updates  
❌ Modifying Raw style logic  
❌ Enabling other pending styles (Warm, Easy, Smart, etc.)

---

## 3. Non-Goals

**Explicitly NOT doing:**

- Adding new automated tests
- Modifying Raw or other existing styles
- Verifying/enabling additional styles beyond Clear
- Updating project documentation (README, CHANGELOG)

**Rationale:** Minimal scope for speed. Clear verification already complete in research environment.

---

## 4. Definition of Done

Task complete when all criteria met:

✅ Clear entry added to verification.md with status VERIFIED  
✅ Clear added to FREE_ROOM_KAGI_STYLES array  
✅ Clear label and description added to dashboard schemas  
✅ All existing tests pass (no regressions)  
✅ Git commit created with descriptive message  
✅ Raw style functionality unaffected (backward compatible)

---

## 5. Constraints

### Technical Constraints

- **Backward Compatibility:** Clear MUST NOT break Raw or existing room configurations
- **Minimal Changes:** Only modify 2 files (schemas.ts + verification.md)
- **No New Dependencies:** Use existing packages only (provider-kagi, dashboard)

### Business Constraints

- **Risk Tolerance:** Low - additive feature only, fail-fast if issues arise
- **Quality Bar:** Match nghien_cuu_cua_toi verification results

---

## 6. Environment

### Research Environment (Verified)

- **Location:** `nghien_cuu_cua_toi/`
- **Status:** ✅ VERIFIED - Clear preset tested successfully
- **Evidence:** Console output shows successful UI interaction, stable translation output

### Production Environment (Target)

- **Location:** `packages/dashboard/`, `packages/provider-kagi/`
- **Tools:** Bun, TypeScript, git
- **Deployment:** Direct commit to main branch

---

## 7. Clear Style Configuration

### Preset Definition (VERIFIED)

```typescript
Clear: {
  label: 'Clear',
  translationType: 'natural',
  formality: 'standard',
  readingLevel: 'standard',
  description: 'Balanced, natural, and easy to read.'
}
```

**Source:** Already defined in `packages/provider-kagi/src/types.ts` line 52-57

### UI Interaction Sequence (VERIFIED)

1. Open Translation Settings dialog
2. Set speaker gender = unknown (click Unknown option)
3. Set addressee gender = unknown (click Unknown option)
4. Set reading level = standard (slider step 0)
5. Set translation style = natural (click Natural option)
6. **Skip formality** (default = standard, NO "chim mồi" flow needed)
7. Wait for output to stabilize

**Key Difference from Raw:**

- Raw requires "chim mồi" (2-phase) because `formality = vietnamese_casual`
- Clear does NOT need "chim mồi" because `formality = standard`

### Expected URL Parameters (VERIFIED)

**Final URL in address bar:**

```
https://translate.kagi.com/?from=auto&to=vi&text=...&context=...
```

**Key Observation:**

- Only `from`, `to`, `text`, `context` params present
- NO `speaker_gender`, `addressee_gender`, `style`, `language_complexity`, `formality_context`
- Kagi does NOT append default params to URL

**Evidence:** Console output from nghien_cuu_cua_toi test run (2026-04-11)

---

## 8. Technical Implementation

### Architecture Decision

**Approach:** Simple schema update (additive change only)

**Rationale:**

- Clear preset already exists in `provider-kagi/src/types.ts`
- UI interaction logic already supports all Clear settings
- No code changes needed, only configuration enable

### File Changes

#### File 1: `docs/kagi-style-verification.md`

**Location:** Line 160-161 (verification log table)

**Action:** Add Clear verification entry

**Before:**

```markdown
| Style | Status      | Date       | Tester | Notes                                           |
| ----- | ----------- | ---------- | ------ | ----------------------------------------------- |
| Wild  | ✅ VERIFIED | 2026-04-09 | [Name] | All checks pass, "chim mồi" for vi_casual works |
| Warm  | ⏳ PENDING  | -          | -      | -                                               |
```

**After:**

```markdown
| Style | Status      | Date       | Tester | Notes                                           |
| ----- | ----------- | ---------- | ------ | ----------------------------------------------- |
| Wild  | ✅ VERIFIED | 2026-04-09 | [Name] | All checks pass, "chim mồi" for vi_casual works |
| Clear | ✅ VERIFIED | 2026-04-11 | phamau | natural+standard+standard, no chim mồi needed   |
| Warm  | ⏳ PENDING  | -          | -      | -                                               |
```

**Validation:** Table formatting preserved, alphabetical order maintained (Wild → Clear → Warm)

#### File 2: `packages/dashboard/src/lib/free-room-schemas.ts`

**Location:** Lines 15, 21-27

**Action:** Add Clear to active styles array and mappings

**Change 1 - Line 15 (ACTIVE_KAGI_STYLES array):**

```typescript
// Before
const ACTIVE_KAGI_STYLES = ['Raw'] as const

// After
const ACTIVE_KAGI_STYLES = ['Raw', 'Clear'] as const
```

**Change 2 - Lines 21-23 (labels mapping):**

```typescript
// Before
export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Raw',
}

// After
export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Raw',
  Clear: 'Clear',
}
```

**Change 3 - Lines 25-28 (descriptions mapping):**

```typescript
// Before
export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Casual Vietnamese, suitable for friends or peers',
}

// After
export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS: Record<FreeRoomKagiStyle, string> = {
  Raw: 'Casual Vietnamese, suitable for friends or peers',
  Clear: 'Balanced, natural, and easy to read.',
}
```

**Type Safety:**

- TypeScript will infer `FreeRoomKagiStyle = 'Raw' | 'Clear'`
- Zod schema will enforce valid enum values
- React dropdown will show both options

---

## 9. User Experience Flow

### Room Creation Flow

1. User clicks "Create Free Room"
2. Fill basic fields (room ID, names)
3. **Translation Style dropdown** shows:
   - Raw (Casual Vietnamese, suitable for friends or peers)
   - Clear (Balanced, natural, and easy to read.) ← NEW
4. User selects "Clear"
5. Save room → Clear style stored in config
6. Webhook receives message → translates using Clear preset

### Room Editing Flow

1. User opens existing room (any style)
2. Click Edit
3. Change style from Raw → Clear (or vice versa)
4. Save → new style applied to future translations

### Translation Behavior

**With Clear style:**

- Natural translation (not literal)
- Standard formality (neutral, not casual/formal)
- Standard reading level (not simplified/advanced)
- Balanced tone: professional yet readable

**Comparison with Raw:**

- Raw: Casual tone, may use "bạn/mình" pronouns
- Clear: Neutral tone, avoids overly casual language

---

## 10. Acceptance Criteria

### Happy Path

✅ **Create Room with Clear:**

1. Open room create dialog
2. Select "Clear" from style dropdown
3. See description: "Balanced, natural, and easy to read."
4. Save room successfully
5. Room config stores `kagiStyle: 'Clear'`

✅ **Edit Room to Clear:**

1. Open existing Raw room
2. Click Edit
3. Change style to Clear
4. Save successfully
5. Future translations use Clear preset

✅ **Translation Quality:**

1. Send Japanese → Vietnamese translation
2. Output matches nghien_cuu_cua_toi verification
3. Natural, balanced, readable Vietnamese

### Edge Cases

✅ **Backward Compatibility:**

- Existing Raw rooms continue working unchanged
- Switching Raw ↔ Clear works in both directions
- No data migration needed

✅ **Validation:**

- Dropdown only shows Raw + Clear (no other styles)
- Cannot save room with invalid style value
- Schema validation passes

---

## 11. Testing Strategy

### Manual Testing (Required)

**Test Case 1: Create Room with Clear**

1. Dashboard → Create Free Room
2. Select Clear style
3. Complete form → Save
4. Verify room created successfully

**Test Case 2: Edit Room Style**

1. Open existing Raw room
2. Edit → Change to Clear
3. Save
4. Verify style updated

**Test Case 3: Translation Output**

1. Send test message to Clear-styled room
2. Verify translation quality
3. Compare with nghien_cuu_cua_toi output (should match)

### Regression Testing (Required)

**Test Case 4: Existing Raw Rooms**

1. Verify existing Raw rooms still work
2. Send test messages
3. Confirm Raw translation quality unchanged

**Test Case 5: Dashboard UI**

1. Navigate all room management pages
2. Verify no UI breakage
3. Check validation still works

### Automated Testing (Not Required)

- No new automated tests (out of scope)
- Existing tests must pass (regression check)

---

## 12. Deployment & Rollout

### Deployment Strategy

**Single Commit Deployment:**

```bash
git add docs/kagi-style-verification.md packages/dashboard/src/lib/free-room-schemas.ts
git commit -m "feat(dashboard): enable Clear style after verification

Add Clear translation style to dashboard after successful verification
in nghien_cuu_cua_toi research environment.

Clear preset: natural + standard formality + standard reading level.
No 'chim mồi' flow needed (unlike Raw which uses vietnamese_casual).

Changes:
- Add Clear to ACTIVE_KAGI_STYLES array
- Add Clear label and description
- Document verification in kagi-style-verification.md

Verified: 2026-04-11 by phamau
Evidence: nghien_cuu_cua_toi console output shows stable UI interaction"
```

**No Feature Flag:**

- Clear already verified → safe to enable immediately
- Additive change → low risk

**No Migration:**

- Existing rooms unaffected
- New field value, not schema change

### Rollback Strategy

**If Issues Arise:**

1. Revert commit: `git revert <commit-hash>`
2. Push revert to main
3. Clear disabled, Raw remains active

**Low Risk Justification:**

- Clear doesn't modify Raw logic
- Additive feature only
- Already verified in isolated environment

---

## 13. Risk Analysis

### Risk Matrix

| Risk                             | Likelihood | Impact | Mitigation                           | Contingency                   |
| -------------------------------- | ---------- | ------ | ------------------------------------ | ----------------------------- |
| Clear doesn't work in production | Low        | Medium | Verified in nghien_cuu_cua_toi first | Revert commit, re-verify      |
| Break Raw functionality          | Very Low   | High   | No code changes to Raw logic         | Revert commit immediately     |
| UI validation breaks             | Low        | Low    | Existing tests cover validation      | Fix validation, redeploy      |
| TypeScript compilation errors    | Very Low   | Medium | Type-checked before commit           | Fix types, redeploy           |
| User confusion (Raw vs Clear)    | Low        | Low    | Clear descriptions provided          | Update descriptions if needed |

### Open Risks

**None.** Clear has been successfully verified in nghien_cuu_cua_toi with evidence of:

- Successful UI interaction sequence
- Stable translation output
- Correct URL parameter handling

---

## 14. Decision Log

### Key Decisions

| ID      | Decision                                        | Status      | Provenance             | Risk | Rationale                                                          |
| ------- | ----------------------------------------------- | ----------- | ---------------------- | ---- | ------------------------------------------------------------------ |
| DEC-001 | Style name: "Clear" not "Standard"              | ✅ ACCEPTED | user-confirmed         | Low  | User-friendly, fits existing naming pattern (Raw, Warm, Easy...)   |
| DEC-002 | Minimal scope: no new automated tests           | ✅ ACCEPTED | user-stated            | Low  | Speed prioritized, manual verification sufficient                  |
| DEC-003 | No "chim mồi" for Clear                         | ✅ ACCEPTED | system-inferred        | Low  | formality=standard doesn't need 2-phase flow                       |
| DEC-004 | Preset: natural+standard+standard               | ✅ ACCEPTED | user-confirmed         | Low  | Matches nghien_cuu_cua_toi verified setup                          |
| DEC-005 | Fail-fast error handling                        | ✅ ACCEPTED | user-stated            | Low  | Follow Raw pattern: block enable if verify fails                   |
| DEC-006 | Use existing description from types.ts          | ✅ ACCEPTED | user-confirmed         | Low  | "Balanced, natural, and easy to read." is professional and concise |
| DEC-007 | Verification flow: manual in nghien_cuu_cua_toi | ✅ ACCEPTED | user-stated (implicit) | Low  | Already completed successfully before this spec                    |

### Superseded Decisions

None. No decisions were revised during specification process.

---

## 15. Future Scope / Deferred Features

**Not in Current Task (explicitly deferred):**

❌ **Enable Additional Styles:**

- Warm, Easy, Smart, Deep, Fine, Polite, Elegant, True, Precise, Exact
- Each requires individual verification following same process

❌ **Automated Verification Tests:**

- Puppeteer-based test suite for style verification
- Would reduce manual effort for future styles

❌ **Documentation Updates:**

- README.md: Add Clear to supported styles list
- CHANGELOG.md: Document Clear style addition

❌ **E2E Tests:**

- Full user flow tests for Clear style
- Would increase confidence but adds scope

❌ **Performance Optimization:**

- UI interaction timing tuning
- Output stability detection improvements

**Rationale for Deferral:**

- Current minimal scope prioritizes speed
- Clear verification already complete
- Future styles will follow same pattern

---

## 16. References

### Related Documents

- **Verification Checklist:** `docs/kagi-style-verification.md`
- **UI Interaction Plan:** `docs/superpowers/plans/2026-04-10-kagi-ui-interaction-refactor.md`
- **UI Interaction Design:** `docs/superpowers/specs/2026-04-10-kagi-ui-interaction-refactor-design.md`

### Evidence

- **nghien_cuu_cua_toi Test Output:** 2026-04-11 console log (provided by user)
- **Preset Definition:** `packages/provider-kagi/src/types.ts` lines 52-57
- **Schema Location:** `packages/dashboard/src/lib/free-room-schemas.ts`

### Key Files

```
packages/
├── provider-kagi/
│   └── src/
│       └── types.ts              # Clear preset already defined (no changes)
├── dashboard/
│   └── src/
│       └── lib/
│           └── free-room-schemas.ts  # Add Clear to ACTIVE_KAGI_STYLES
docs/
└── kagi-style-verification.md     # Document Clear verification
```

---

## 17. Appendix: Verification Evidence

### nghien_cuu_cua_toi Test Output Summary

**Date:** 2026-04-11  
**Command:** `bun run src/index.ts`  
**Status:** ✅ SUCCESS

**Key Observations:**

1. **Preset Applied:**
   - Translation Style: Natural
   - Formality: Standard
   - Reading Level: Standard
   - Speaker: Unknown
   - Addressee: Unknown

2. **UI Interaction Sequence:**

   ```
   ⚙️  Clicking Translation Settings…
   ⚙️  Setting translation context (44 chars)…
   ⚙️  Clicking speaker gender "Unknown"…
   ⚙️  Clicking addressee gender "Unknown"…
   ⚙️  Setting reading level "standard" → step 0…
   ⚙️  Clicking translation style "Natural"…
   ```

3. **Final URL:**

   ```
   https://translate.kagi.com/?from=auto&to=vi&text=...&context=Technical+documentation+for+senior+engineers
   ```

   - Only `from`, `to`, `text`, `context` params
   - No `speaker_gender`, `style`, `formality_context` (all defaults)

4. **Translation Output:**
   - Japanese technical text → Vietnamese
   - Natural, readable, balanced tone
   - Matches expected Clear style characteristics

**Conclusion:** Clear preset works correctly. UI interaction stable. Translation quality satisfactory.

---

**End of Specification**
