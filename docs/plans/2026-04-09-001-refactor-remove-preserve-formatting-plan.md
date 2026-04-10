---
title: Remove preserveFormatting parameter from Kagi URL builder
type: refactor
status: completed
date: 2026-04-09
completed: 2026-04-09
origin: docs/superpowers/specs/2026-04-09-remove-preserve-formatting-design.md
---

# Remove preserveFormatting parameter from Kagi URL builder

## Overview

Remove hardcoded `preserveFormatting=true` parameter from Kagi Translate URL construction to improve translation quality. User testing confirmed web Kagi (without this flag) produces superior semantic quality compared to bot translations (with flag).

## Problem Frame

Current bot translations use `preserveFormatting=true` in all Kagi Translate URLs, originally intended to maintain line break structure for segment alignment. However, production webhook testing revealed this parameter degrades translation quality (semantics, tone, vocabulary) compared to web Kagi behavior (default `preserveFormatting=false`). User explicitly prioritized quality improvement over structure preservation assumptions.

**Source:** docs/superpowers/specs/2026-04-09-remove-preserve-formatting-design.md

## Requirements Trace

- R1. `buildKagiUrl()` must not set `preserveFormatting` parameter in query string
- R2. All unit tests must pass with updated assertions
- R3. Preview URLs generated without `preserveFormatting` parameter
- R4. Translation quality improves (user-verified via manual webhook testing)
- R5. Multi-paragraph messages still translate correctly (segment alignment verified)

## Scope Boundaries

**Out-of-Scope:**

- Making `preserveFormatting` configurable (per-room or env)
- Schema changes (keep `previewUrl` as required field)
- Dashboard UI changes
- Additional logging/monitoring
- Automated E2E quality measurement
- Data migration (file already empty)
- Segment alignment logic refactoring (handle separately if needed)

## Context & Research

### Relevant Code and Patterns

**Files Modified:**

- `packages/provider-kagi/src/url-builder.ts` - Contains `buildKagiUrl()` and `buildPreviewUrl()` (line 77 removal)
- `packages/provider-kagi/src/url-builder.test.ts` - Contains 19 unit tests (line 12 assertion update)

**Test Patterns (from codebase research):**

- Bun test runner with `describe`/`it`/`expect` API
- Test co-location (`.test.ts` suffix, same directory as source)
- Assertion pattern for parameter removal: `expect(url).not.toContain('parameterName')`

**URLSearchParams Pattern:**

```typescript
const params = new URLSearchParams()
params.set('requiredParam', 'value') // Unconditional
if (optionalValue !== undefined) {
  params.set('optionalParam', optionalValue) // Conditional
}
return `${BASE_URL}?${params.toString()}`
```

**Commit Convention:**

- Format: `refactor(kagi): subject in lowercase`
- Enforced by commitlint + Husky pre-commit hooks
- Pre-commit runs: lint-staged, verify:standards, typecheck, tests (all must pass)

### Institutional Learnings

**From Original PoC Design (2026-03-29-kagi-translate-poc-design.md):**

- `preserveFormatting` parameter defined as: "Keep original formatting (line breaks, tabs). Default: false."
- Kagi UI shows this as unchecked by default

**From Original Kagi Free Provider Plan (2026-04-01-kagi-free-provider.md):**

- Requirement stated: "Always include `preserveFormatting=true` to maintain segment alignment and structure preservation"
- Assumption: Preserving line breaks would help maintain 1:1 segment alignment

**Why Removing Now:**

- User production testing showed web Kagi produces better quality
- Quality impact outweighs theoretical structure benefit
- If alignment breaks, fix segment logic separately (user-accepted risk)

## Key Technical Decisions

- **Quality over structure**: Remove parameter completely, not make it configurable (see origin: DEC-004, DEC-005)
- **Single atomic commit**: Code + tests in one commit for clean rollback (see origin: DEC-009)
- **Keep schema unchanged**: `previewUrl` remains required, computed without parameter (see origin: DEC-007)
- **Manual testing required**: Multi-paragraph messages with `\n\n` must be tested to verify segment alignment (see origin: DEC-014)

## Open Questions

### Resolved During Planning

All questions resolved in origin document (14 explicit decisions: DEC-001 through DEC-014).

### Deferred to Implementation

- Exact commit message wording (will follow convention: `refactor(kagi): remove preserveFormatting parameter from URL builder`)
- Deprecation note phrasing (will match design spec format)

## Implementation Units

- [x] **Unit 1: Remove preserveFormatting from URL builder** ✅ (Commit: af9b2e7)

**Goal:** Remove hardcoded `preserveFormatting=true` parameter from `buildKagiUrl()` and update test assertions.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**

- Modify: `packages/provider-kagi/src/url-builder.ts` (line 77 removal)
- Modify: `packages/provider-kagi/src/url-builder.test.ts` (line 12 assertion change)

**Approach:**

1. Delete line 77 in `url-builder.ts`: `params.set('preserveFormatting', 'true')`
2. Add explanatory comment: `// preserveFormatting removed - Kagi default behavior produces better quality`
3. Update line 12 in `url-builder.test.ts`: Change `expect(url).toContain('preserveFormatting=true')` to `expect(url).not.toContain('preserveFormatting')`
4. Atomic commit (code + tests together)

**Patterns to follow:**

- URLSearchParams pattern from `packages/provider-kagi/src/url-builder.ts` (lines 69-100)
- Test assertion pattern from PoC plan: use `.not.toContain()` for parameter removal
- Comment style: single-line `//` on previous line, explain intent not mechanics

**Test scenarios:**

- Happy path: All 12 `buildKagiUrl` tests pass with updated assertion (Wild, Warm, Easy, Clear, Smart, Deep, Fine, Polite, Elegant, True, Precise, Exact styles)
- Happy path: All 7 `buildPreviewUrl` tests pass (context variations, null/undefined/empty handling)
- Edge case: Verify URL still contains all other required parameters (`from=auto&to=vi&text=...`)
- Edge case: Verify conditional parameters (formality, language_complexity, style) still set correctly

**Verification:**

- `bun test packages/provider-kagi/src/url-builder.test.ts` passes (19/19 tests)
- `bun run typecheck` passes with zero errors
- `bun run lint` passes with zero warnings
- Generated URLs no longer contain `preserveFormatting` parameter
- Pre-commit hooks pass (lint-staged, verify:standards, typecheck, tests)

---

- [x] **Unit 2: Add deprecation notes to old design documents** ✅ (Commit: 28c4bd7)

**Goal:** Mark old design documents as superseded regarding `preserveFormatting` requirement.

**Requirements:** Documentation completeness (implicit from origin)

**Dependencies:** Unit 1 (ensures code reflects new reality)

**Files:**

- Modify: `docs/superpowers/specs/2026-03-29-kagi-translate-poc-design.md`
- Modify: `docs/superpowers/plans/2026-04-01-kagi-free-provider.md`

**Approach:**

1. Add deprecation note at top of "Kagi Translate URL Parameters" section in PoC design:
   ```markdown
   > **DEPRECATED (2026-04-09):** The `preserveFormatting=true` requirement has been removed.
   > See `2026-04-09-remove-preserve-formatting-design.md` for rationale.
   > Production code no longer sets this parameter.
   ```
2. Add deprecation note where Task 1 mentions "always `preserveFormatting=true`" in free provider plan:
   ```markdown
   > **DEPRECATED (2026-04-09):** This requirement was removed to improve translation quality.
   > See `../specs/2026-04-09-remove-preserve-formatting-design.md`.
   ```

**Patterns to follow:**

- Markdown blockquote syntax for deprecation notes
- Reference new design spec by filename
- Keep original content intact, only add warning at top/relevant section

**Test scenarios:**
Test expectation: none -- documentation-only change, no behavioral impact

**Verification:**

- Both files render correctly in Markdown preview
- Deprecation notes clearly visible in affected sections
- Links to new design spec resolve correctly

---

- [ ] **Unit 3: Manual webhook verification** ⏳ (Deferred - test when convenient)

**Goal:** Verify translation quality improvement and confirm multi-paragraph segment alignment still works.

**Requirements:** R4, R5

**Dependencies:** Unit 1 (code deployed to dev environment)

**Files:**

- Read: `data/free-room-configs.json` (configure test room)
- Read: Local dev logs from `bun run dev:translator` and `bun run dev:kagi-sidecar`

**Approach:**

1. Start dev services (`bun run dev:translator` + `bun run dev:kagi-sidecar`)
2. Configure free room in `data/free-room-configs.json` (use Clear style)
3. **Test Case 1 (Single-paragraph):** Send Chatwork message with simple text, verify quality improvement (user subjective assessment)
4. **Test Case 2 (Multi-paragraph - HIGH RISK):** Send Chatwork message with paragraph breaks (`Text A\n\nText B`), verify segment alignment works and paragraph break preserved in output
5. Monitor logs for errors (no segment count mismatch, no structure preservation failures)

**Patterns to follow:**

- Free room config pattern from existing `data/free-room-configs.json` structure
- Manual testing workflow from design spec (see origin: Testing Strategy section)

**Test scenarios:**

- Happy path: Single-paragraph message translates successfully with improved quality
- Integration: Multi-paragraph message with `\n\n` separator returns both paragraphs with preserved break
- Error path: No segment count mismatch errors in translator logs
- Error path: No structure preservation failures in kagi-sidecar logs

**Verification:**

- Translation quality better than before (user assessment - compare to previous bot behavior)
- Multi-paragraph messages return correct segment count (no mismatch errors)
- Paragraph breaks preserved in Vietnamese output (`\n\n` between segments)
- No errors in dev logs for both test cases

## System-Wide Impact

**Interaction graph:**

- `buildKagiUrl()` → Called by `KagiBrowserService.executeTranslation()` → Navigates to URL → Scrapes translation
- `buildPreviewUrl()` → Calls `buildKagiUrl()` → Stored in `FreeRoomConfig.previewUrl` → Returned in API responses

**Error propagation:**

- No new error paths introduced (parameter removal only)
- Existing error handling unchanged (browser navigation, scraping, timeouts)

**Unchanged invariants:**

- All Kagi styles still supported (12 styles: Wild, Warm, Easy, Clear, Smart, Deep, Fine, Polite, Elegant, True, Precise, Exact)
- Context parameter handling unchanged
- Preview URL schema field remains required (URL value changes, field does not)
- API contracts unchanged (transparent change to consumers)
- Dashboard behavior unchanged (doesn't use `previewUrl`)

**Potential segment alignment risk (HIGH):**

- Original intent of `preserveFormatting=true` was to maintain line break structure for segment count alignment
- Removing it may cause Kagi to merge/reformat paragraph breaks, leading to segment count mismatch
- Mitigation: Unit 3 includes required multi-paragraph test (DEC-014)
- Fallback: If breaks, refactor segment alignment logic separately (user-accepted trade-off in DEC-004)

## Risks & Dependencies

| Risk                                      | Mitigation                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Multi-paragraph segment alignment breaks  | Manual test required (Unit 3). Git revert ready. User explicitly accepted this risk, prioritizing quality. |
| Quality doesn't improve as expected       | Git revert rollback. User production testing already confirmed improvement.                                |
| Preview URLs outdated in existing configs | Not applicable - data file empty (user manually cleared). New rooms compute fresh.                         |

**Dependencies:**

- Dev environment running (translator + kagi-sidecar services)
- Chatwork webhook access for manual testing
- Empty `data/free-room-configs.json` confirmed (user manually cleared)

## Documentation / Operational Notes

**Rollback Plan:**

```bash
# If issues discovered post-deploy:
git log --oneline -5          # Identify commit hash
git revert <commit-hash>      # Revert the removal
# Redeploy services
```

**Rollback Triggers:**

- Translation quality doesn't improve
- Segment count mismatch errors in production
- Multi-paragraph messages breaking
- User requests rollback

**Monitoring:**

- Use existing logs: `kagi_translate_completed`, `kagi_translate_failed`, `translation_ingress_received`
- Watch for segment mismatch errors in translator logs
- No additional logging needed (DEC-012)

**Deployment:**

1. Local/dev verification first (all units complete)
2. Production deploy after validation
3. Monitor logs for errors
4. User verify production quality

## Sources & References

- **Origin document:** [docs/superpowers/specs/2026-04-09-remove-preserve-formatting-design.md](../specs/2026-04-09-remove-preserve-formatting-design.md)
- Related specs: `2026-03-29-kagi-translate-poc-design.md`, `2026-04-01-kagi-free-provider.md`
- Related plan: `2026-04-09-preview-url-free-room-config.md` (previous `previewUrl` implementation)
- Code: `packages/provider-kagi/src/url-builder.ts`, `packages/provider-kagi/src/url-builder.test.ts`
