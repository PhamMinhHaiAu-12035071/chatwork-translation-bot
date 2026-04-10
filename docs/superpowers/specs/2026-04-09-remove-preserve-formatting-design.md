# Remove `preserveFormatting=true` from Kagi URL Builder - Design Specification

> **Version:** 1.0  
> **Date:** 2026-04-09  
> **Prepared by:** AI-assisted (Claude Sonnet 4.5)  
> **Status:** Approved for Implementation

---

## Summary

Remove hardcoded `preserveFormatting=true` parameter from Kagi Translate URL construction to match web Kagi behavior and improve translation quality. User testing with production webhooks shows web Kagi (without this flag) produces superior translation quality compared to bot translations (with flag). This is a quality-focused change that prioritizes semantic accuracy over structural preservation assumptions.

---

## Objectives

### Primary Goal

Improve free room translation quality by aligning bot behavior with Kagi web behavior (no `preserveFormatting` parameter).

### Success Criteria

1. `buildKagiUrl()` no longer sets `preserveFormatting` in query parameters
2. All unit tests pass with updated assertions
3. Preview URLs generated without `preserveFormatting` parameter
4. Manual webhook testing confirms translation quality improvement
5. Multi-paragraph messages still translate correctly (segment alignment verified)

---

## Scope

### In-Scope

- **Code changes:**
  - Remove `params.set('preserveFormatting', 'true')` from `packages/provider-kagi/src/url-builder.ts`
  - Update test assertions in `packages/provider-kagi/src/url-builder.test.ts`
  - Keep `previewUrl` schema field as required (no schema changes)
- **Testing:**
  - Unit tests: Verify URL does not contain `preserveFormatting`
  - Manual webhook test: Single-paragraph message quality verification
  - Manual webhook test: Multi-paragraph message (`\n\n`) segment alignment verification

- **Documentation:**
  - Add deprecation notes to old design docs that referenced `preserveFormatting=true` as requirement
  - Create this design spec as source of truth for removal decision

### Out-of-Scope

- Making `preserveFormatting` configurable (env var, per-room, per-style)
- Dashboard UI changes (field not used in frontend)
- Additional logging or monitoring
- Automated E2E tests for quality metrics
- Data migration (file already empty)
- Segment alignment logic refactoring (handle separately if needed)

---

## Non-Goals

- **Not** adding configuration complexity
- **Not** preserving old behavior as fallback
- **Not** attempting to measure quality improvement programmatically
- **Not** updating frontend (no UI impact)

---

## Definition of Done

**Code:**

- [ ] Line `params.set('preserveFormatting', 'true')` removed from `url-builder.ts`
- [ ] Test assertions updated to verify absence of parameter
- [ ] All unit tests passing
- [ ] TypeScript compilation clean
- [ ] ESLint passing

**Testing:**

- [ ] Manual webhook test with single-paragraph message confirms quality improvement
- [ ] Manual webhook test with multi-paragraph message (containing `\n\n`) confirms segment alignment still works

**Documentation:**

- [ ] Deprecation notes added to:
  - `docs/superpowers/specs/2026-03-29-kagi-translate-poc-design.md`
  - `docs/superpowers/plans/2026-04-01-kagi-free-provider.md`
- [ ] This design spec committed to git

**Deployment:**

- [ ] Changes committed with conventional commit message
- [ ] Local/dev verification complete
- [ ] Ready for production deploy

---

## Constraints

### Technical Constraints

- Must maintain backward compatibility with API contracts
- Must not change `FreeRoomConfigSchema` structure
- Must keep `previewUrl` as required field
- Single atomic commit for clean rollback

### Operational Constraints

- Must test in dev/local before production
- Must have git revert as rollback plan
- No downtime required (code-only change)

### Quality Constraints

- Translation quality must improve (user-verified)
- Segment alignment must still work for multi-paragraph messages

---

## Problem Statement

### Current Behavior

`buildKagiUrl()` in `packages/provider-kagi/src/url-builder.ts` unconditionally sets:

```typescript
params.set('preserveFormatting', 'true')
```

This parameter was originally added based on assumption that it would help maintain segment alignment and structure preservation for Chatwork messages with line breaks and paragraph formatting.

### Observed Issue

User testing with production free room webhooks revealed:

- **Web Kagi** (translate.kagi.com without `preserveFormatting` parameter): Produces better translation quality (semantics, tone, vocabulary)
- **Bot with flag** (using `preserveFormatting=true`): Produces inferior quality that doesn't match user expectations

### Root Cause Analysis

The `preserveFormatting=true` parameter appears to affect Kagi's translation algorithm in ways that reduce quality. While the original intent was structural preservation, the actual impact is negative on semantic quality.

---

## Architecture

### Current Architecture

```
buildKagiUrl(text, style, context)
  ↓
  URLSearchParams construction:
    - from=auto
    - to=vi
    - text={text}
    - preserveFormatting=true  ← ALWAYS SET
    - [conditional: formality, language_complexity, style, context]
  ↓
  Return: https://translate.kagi.com/?{params}
```

**Used by:**

- `KagiBrowserService.executeTranslation()` → navigates to URL → scrapes translation
- `buildPreviewUrl()` → calls `buildKagiUrl('hello', ...)` → stored in `FreeRoomConfig.previewUrl`

### Proposed Architecture

```
buildKagiUrl(text, style, context)
  ↓
  URLSearchParams construction:
    - from=auto
    - to=vi
    - text={text}
    - [conditional: formality, language_complexity, style, context]
    ↓ (preserveFormatting removed)
  ↓
  Return: https://translate.kagi.com/?{params}
```

**Changes:**

- Remove line 77 in `url-builder.ts`
- URL construction otherwise identical
- All consumers unchanged (transparent change)

---

## Technical Approach

### Code Changes

**File:** `packages/provider-kagi/src/url-builder.ts`

**Change:** Remove line 77

```typescript
// BEFORE (lines 69-77):
export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const params = new URLSearchParams()
  const styleParams = getStyleQuery(style)
  const trimmedContext = context?.trim()

  params.set('from', 'auto')
  params.set('to', 'vi')
  params.set('text', text)
  params.set('preserveFormatting', 'true')  // ← REMOVE THIS LINE

// AFTER:
export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const params = new URLSearchParams()
  const styleParams = getStyleQuery(style)
  const trimmedContext = context?.trim()

  params.set('from', 'auto')
  params.set('to', 'vi')
  params.set('text', text)
  // preserveFormatting removed - use Kagi default for better quality
```

**File:** `packages/provider-kagi/src/url-builder.test.ts`

**Change:** Update test assertion on line 12

```typescript
// BEFORE:
expect(url).toContain('preserveFormatting=true')

// AFTER:
expect(url).not.toContain('preserveFormatting')
```

### Impact Analysis

**Affected Components:**

- ✅ `url-builder.ts` (implementation)
- ✅ `url-builder.test.ts` (test assertions)
- ✅ Preview URLs (will be recomputed without parameter)
- ❌ Schema (no changes)
- ❌ Store logic (no changes)
- ❌ API contracts (no changes)
- ❌ Dashboard (doesn't use previewUrl)

**Blast Radius:** **Minimal**

- 1 line removed
- 1 test assertion changed
- Zero breaking changes to consumers

---

## Data Model

### Schema (No Changes)

```typescript
// packages/translator/src/types/free-room-config.ts
export const FreeRoomConfigSchema = z.object({
  // ... existing fields
  previewUrl: z.url(), // ← REMAINS REQUIRED
  // ... remaining fields
})
```

**Rationale:** Keep schema unchanged. Store will compute new URLs automatically via `buildPreviewUrl()`.

### Data File State

**Current:** Empty (`data/free-room-configs.json`)

```json
{
  "version": 1,
  "rooms": []
}
```

**After change:** Still empty, but new rooms will have preview URLs without `preserveFormatting` parameter.

**Migration:** None needed (no existing data).

---

## Testing Strategy

### Unit Tests

**File:** `packages/provider-kagi/src/url-builder.test.ts`

**Changes:**

1. **Update assertion in `should build URL with Wild style and context`:**
   - Change `expect(url).toContain('preserveFormatting=true')`
   - To `expect(url).not.toContain('preserveFormatting')`

2. **Verify all 12 tests in buildKagiUrl suite still pass**

3. **Verify all 7 tests in buildPreviewUrl suite still pass**

**Expected outcome:** 19/19 tests pass.

**Commands:**

```bash
bun test packages/provider-kagi/src/url-builder.test.ts
bun run typecheck --filter provider-kagi
bun run lint --filter provider-kagi
```

### Manual Webhook Testing

**Test Case 1: Single-Paragraph Message**

**Setup:**

1. Configure free room in `data/free-room-configs.json`
2. Send Chatwork message with simple single-paragraph text

**Verification:**

- Translation quality better than before (user subjective assessment)
- Bot responds successfully
- No errors in logs

**Test Case 2: Multi-Paragraph Message (HIGH-RISK MITIGATION)**

**Setup:**

1. Use same free room config
2. Send Chatwork message with paragraph breaks: `Text A\n\nText B`

**Verification:**

- Translation returns both paragraphs
- Paragraph break preserved in output (`\n\n` between Vietnamese segments)
- No segment count mismatch errors
- No structure preservation failures

**Commands:**

```bash
# Start services
bun run dev:translator
bun run dev:kagi-sidecar

# Send webhook (via Chatwork or curl)
# Observe logs for errors
```

---

## Deployment

### Phase 1: Local/Dev Testing

1. Make code changes
2. Run unit tests
3. Start dev services (translator + kagi-sidecar)
4. Execute manual webhook tests (single + multi-paragraph)
5. Verify quality improvement

### Phase 2: Production Deploy

1. Commit changes
2. Deploy to production
3. Monitor existing logs for errors
4. User verify production quality

### Rollback Plan

If issues discovered:

```bash
git revert <commit-hash>
# Redeploy
```

**Rollback triggers:**

- Translation quality doesn't improve
- Segment alignment breaks
- Unexpected errors in production
- User requests rollback

---

## Edge Cases

### Case 1: Empty Text

**Scenario:** `buildKagiUrl('', 'Clear')`  
**Behavior:** URL still constructed, just `text=` empty  
**Impact:** None (existing behavior preserved)

### Case 2: Multi-Segment Messages

**Scenario:** Message with 3+ paragraphs separated by `\n\n`  
**Risk:** Segment count mismatch if Kagi merges paragraphs  
**Mitigation:** Manual test required (DEC-014)  
**Fallback:** Fix segment alignment logic separately if needed (DEC-004)

### Case 3: Special Characters in Text

**Scenario:** Text with URLs, code, emoji  
**Behavior:** URLSearchParams handles encoding  
**Impact:** None (existing encoding logic unchanged)

### Case 4: All 12 Kagi Styles

**Scenario:** Wild, Warm, Easy, Clear, Smart, Deep, Fine, Polite, Elegant, True, Precise, Exact  
**Assumption:** All affected equally (tested 1-2 styles, reasonable generalization)  
**Verification:** User can spot-check additional styles if needed

---

## Explicit Decisions Made

| ID      | Decision                                             | Provenance         | Risk Level |
| ------- | ---------------------------------------------------- | ------------------ | ---------- |
| DEC-001 | Testing with real webhook translation                | User-stated        | Low        |
| DEC-002 | Problem is translation quality (semantic/tone/vocab) | User-stated        | Medium     |
| DEC-003 | All 12 styles assumed affected                       | User-stated        | Low        |
| DEC-004 | **Quality > segment alignment priority**             | **User-stated**    | **HIGH**   |
| DEC-005 | Complete removal (no config)                         | User-stated        | Low        |
| DEC-006 | Data file empty (manual removal)                     | User-stated        | Medium     |
| DEC-007 | Keep previewUrl required                             | User-confirmed     | Low        |
| DEC-008 | Unit + manual webhook testing                        | User-stated        | Low        |
| DEC-009 | Git revert rollback                                  | User-stated        | Low        |
| DEC-010 | Dev first → production deployment                    | User-stated        | Low        |
| DEC-011 | No frontend impact                                   | User-stated        | Low        |
| DEC-012 | No additional logging                                | User-stated        | Low        |
| DEC-013 | Add deprecation notes to old docs                    | User-stated        | Low        |
| DEC-014 | **Multi-paragraph test required**                    | **User-confirmed** | **Low**    |

---

## Open Risks

### [UNCONFIRMED - HIGH RISK] Segment Alignment with Multi-Paragraph Messages

**Risk:** Removing `preserveFormatting` may cause Kagi to merge/reformat paragraph breaks (`\n\n`), leading to segment count mismatch errors in the translation pipeline.

**Original Intent:** The parameter was added specifically to maintain line break structure for segment alignment (per `2026-04-01-kagi-free-provider.md` requirements).

**Mitigation Strategy:**

1. **Required manual test** (DEC-014): Test multi-paragraph messages during dev verification
2. **Priority decision** (DEC-004): User confirmed willingness to fix segment alignment logic separately if it breaks
3. **Rollback ready** (DEC-009): Git revert available for immediate rollback

**Acceptance:** User accepted this risk explicitly, prioritizing quality improvement over alignment safety.

---

## Documentation Updates

### Files Requiring Deprecation Notes

**1. `docs/superpowers/specs/2026-03-29-kagi-translate-poc-design.md`**

Add note at top of "Kagi Translate URL Parameters" section:

```markdown
> **DEPRECATED (2026-04-09):** The `preserveFormatting=true` requirement has been removed.
> See `2026-04-09-remove-preserve-formatting-design.md` for rationale.
> Production code no longer sets this parameter.
```

**2. `docs/superpowers/plans/2026-04-01-kagi-free-provider.md`**

Add note where Task 1 mentions "always `preserveFormatting=true`":

```markdown
> **DEPRECATED (2026-04-09):** This requirement was removed to improve translation quality.
> See `../specs/2026-04-09-remove-preserve-formatting-design.md`.
```

---

## Technical Details

### URL Construction Before/After

**Before:**

```
https://translate.kagi.com/?from=auto&to=vi&text=hello&preserveFormatting=true&context=team
```

**After:**

```
https://translate.kagi.com/?from=auto&to=vi&text=hello&context=team
```

**Impact:** Kagi will use its default formatting behavior (preserveFormatting=false).

### Why This Improves Quality

Based on user production testing:

- Kagi's default behavior (no flag) produces better semantic translations
- Formality, tone, and vocabulary choices more accurate
- Better alignment with user expectations

**Trade-off accepted:** Potential impact on structural preservation in exchange for semantic quality.

---

## Rollout Plan

### Timeline

- **Phase 1 (Dev/Local):** Immediate - code change, unit tests, manual webhook verification
- **Phase 2 (Production):** After Phase 1 validation passes

### Verification Checklist

**Pre-Deploy (Local/Dev):**

- [ ] Unit tests pass (`bun test --filter provider-kagi`)
- [ ] TypeScript compilation clean (`bun run typecheck`)
- [ ] ESLint passes (`bun run lint`)
- [ ] Manual test: Single-paragraph message quality improved
- [ ] Manual test: Multi-paragraph message segment alignment works

**Post-Deploy (Production):**

- [ ] Monitor existing logs for errors
- [ ] User verify production translation quality
- [ ] No segment mismatch errors reported

### Rollback Procedure

If quality doesn't improve or alignment breaks:

```bash
# Identify commit hash
git log --oneline -5

# Revert the removal commit
git revert <commit-hash>

# Verify revert
git show HEAD

# Redeploy
# (deployment commands per environment)
```

**Rollback decision triggers:**

- Translation quality not improved as expected
- Segment count mismatch errors in production
- Multi-paragraph messages breaking
- User requests rollback for any reason

---

## Future Scope / Deferred Features

These items were confirmed as out-of-scope for this change:

- **Configurable `preserveFormatting`** - Making it per-room or env-based toggle
- **Segment alignment refactoring** - If breaks occur, handle in separate task
- **Automated quality measurement** - E2E tests that measure translation quality
- **Dashboard preview UI** - Display or enhance preview URL feature in dashboard
- **A/B testing framework** - Compare bot behavior with/without flag systematically

---

## Acceptance Criteria

### Functional Requirements

1. ✅ Kagi URLs constructed without `preserveFormatting` parameter
2. ✅ Preview URLs computed correctly for all styles
3. ✅ Translation quality improves (user-verified)
4. ✅ Multi-paragraph messages translate successfully

### Non-Functional Requirements

1. ✅ All automated tests pass
2. ✅ No breaking API changes
3. ✅ Zero downtime deployment
4. ✅ Rollback available within minutes

---

## Happy Path

1. Developer removes `params.set('preserveFormatting', 'true')` line
2. Updates test assertion
3. Runs `bun test` → all pass
4. Commits change
5. Starts dev services
6. Sends webhook with single-paragraph message → quality improved ✓
7. Sends webhook with multi-paragraph message → alignment works ✓
8. Deploys to production
9. Monitors logs → no errors
10. User confirms production quality improvement

---

## Failure Cases

### Failure Case 1: Segment Count Mismatch

**Trigger:** Multi-paragraph message translated with merged paragraphs  
**Error:** `Translation segment count mismatch: expected X, got Y`  
**Response:** Git revert, investigate segment alignment logic separately

### Failure Case 2: Quality Not Improved

**Trigger:** User testing shows no quality improvement  
**Response:** Git revert, re-investigate root cause of quality difference

### Failure Case 3: Structure Preservation Breaks

**Trigger:** Chatwork bracket tags or special structure corrupted  
**Response:** Git revert, analyze what structure preservation actually depends on

---

## Implementation Scope

### Files Modified

- `packages/provider-kagi/src/url-builder.ts` (1 line removed, 1 comment added)
- `packages/provider-kagi/src/url-builder.test.ts` (1 assertion changed)
- `docs/superpowers/specs/2026-03-29-kagi-translate-poc-design.md` (deprecation note)
- `docs/superpowers/plans/2026-04-01-kagi-free-provider.md` (deprecation note)

### Files NOT Modified

- ❌ `packages/translator/src/types/free-room-config.ts` (schema unchanged)
- ❌ `packages/translator/src/services/free-room-config-store.ts` (logic unchanged)
- ❌ `packages/kagi-sidecar/src/browser-service.ts` (consumer unchanged)
- ❌ `data/free-room-configs.json` (already empty)

### Estimated Complexity

**Nano** - Single line removal + test update. Implementation: 10 minutes. Testing: 30 minutes.

---

## Dependencies

### Internal

- `@chatwork-bot/provider-kagi` (package being modified)
- `packages/kagi-sidecar` (consumer of URL builder)
- `packages/translator` (uses preview URL feature)

### External

- Kagi Translate API behavior (external service)
- Chatwork webhook delivery (for manual testing)

---

## Trade-offs

### Chosen: Quality Over Structure Safety

**Gain:**

- ✅ Improved translation quality (semantics, tone, vocabulary)
- ✅ Alignment with web Kagi behavior
- ✅ User expectations met

**Cost:**

- ⚠️ Potential segment alignment risk (untested on complex multi-paragraph)
- ⚠️ May need to refactor alignment logic if breaks
- ⚠️ Invalidates original design assumption about structure preservation

**Decision Rationale:** User explicitly prioritized quality (DEC-004), willing to handle alignment issues separately if they arise. Web behavior demonstrably better in production testing.

### Chosen: Complete Removal Over Configuration

**Gain:**

- ✅ Simplest implementation (smallest blast radius)
- ✅ No configuration complexity
- ✅ No per-room schema changes
- ✅ Easy rollback (git revert)

**Cost:**

- ⚠️ No gradual rollout option
- ⚠️ All-or-nothing change

**Decision Rationale:** If web version is always better, no reason to maintain toggle. Configuration adds complexity without value (DEC-005).

---

## Monitoring & Observability

### Existing Logs (Sufficient)

- `kagi_translate_started` - Request ingress
- `kagi_translate_completed` - Success with latency
- `kagi_translate_failed` - Error with code/message
- `translation_ingress_received` - Webhook received

**No new logging needed** (DEC-012) - change is deterministic, no failure modes specific to this parameter.

### What to Watch Post-Deploy

- Error rate in `kagi_translate_failed` logs
- Segment mismatch errors in translator logs
- User reports of quality changes

---

## Historical Context

### Original Design Intent

From `2026-04-01-kagi-free-provider.md`:

> Always include `preserveFormatting=true` ... to maintain segment alignment and structure preservation for Chatwork messages with line breaks.

From `2026-03-29-kagi-translate-poc-design.md`:

> `preserveFormatting`: Keep original formatting (line breaks, tabs). Default: false.

### Why It Was Added

Assumption: Preserving line breaks/tabs would help maintain 1:1 segment alignment for multi-paragraph messages, preventing pipeline errors.

### Why We're Removing It

**Reality:** User testing shows the flag degrades translation quality. Quality impact outweighs theoretical structure benefit. If alignment breaks, we fix that logic separately.

---

## Appendix: Decision Log Summary

**Total Decisions:** 14  
**User-Stated:** 11 (DEC-001, 002, 003, 004, 005, 006, 008, 009, 010, 011, 012, 013)  
**User-Confirmed:** 2 (DEC-007, 014)  
**AI-Recommended (None):** 0

**High-Risk Decisions:** 1 (DEC-004)  
**Medium-Risk Decisions:** 2 (DEC-002, 006)  
**Low-Risk Decisions:** 11

All decisions explicitly confirmed by user through interview process.

---

**END OF SPECIFICATION**
