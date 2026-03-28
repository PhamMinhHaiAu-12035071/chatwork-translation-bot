---
date: 2026-03-28
topic: ai-model-upgrade
status: awaiting-approval
---

# AI Model Upgrade: GPT-5.x & Gemini 3.x

## Executive Summary

Upgrade dashboard and backend to support latest AI models (GPT-5.4-pro, Gemini 3.1-pro-preview), remove deprecated models (GPT-4o, Gemini 1.5), and enforce required model selection across the system.

## Problem Statement

**Current State:**

- Dashboard displays outdated models (gpt-4o, gpt-4-turbo, gemini-1.5-\*)
- Backend has modern defaults (gpt-5.4, gemini-2.5-pro) but dashboard is out of sync
- "Default model" option allows users to skip model selection
- Inconsistent model lists between frontend and backend

**Impact:**

- Users may select deprecated/suboptimal models
- Confusion about which model is actually being used
- Backend and frontend model lists are not aligned

## Solution Overview

**Approach:** Full model catalog refresh with required selection enforcement

### Why This Approach?

1. **User Clarity:** Explicit model choice eliminates ambiguity
2. **Quality Control:** Users consciously select best-in-class models
3. **Consistency:** Single source of truth from research.md
4. **Maintainability:** Remove legacy fallback logic

## Key Decisions

### 1. Model Catalog Strategy

**Decision:** Replace all models with research.md specifications only
**Rationale:**

- Backend has extra models (gpt-5-nano, gemini-3-flash) not in research
- Keep only user-facing, production-ready models
- Reduce choice paralysis

**Models to Add:**

- OpenAI: `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.2`, `gpt-5.1`, `gpt-5-mini`, `gpt-4.1`
- Gemini: `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

**Models to Remove:**

- OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
- Gemini: `gemini-1.5-pro`, `gemini-1.5-flash`

### 2. Default Model Strategy

**Decision:** Enforce required model selection with intelligent defaults
**Rationale:**

- "Default model" option creates ambiguity
- Users should understand which model they're using
- Form defaults guide users to best-in-class models

**Default Values:**

- OpenAI: `gpt-5.4-pro` (most powerful reasoning model)
- Gemini: `gemini-3.1-pro-preview` (latest preview with advanced capabilities)

**Alternative Considered:** Keep "Default model" option
**Why Rejected:** Creates confusion about actual model used; backend would need fallback logic

### 3. Backend Constants Cleanup

**Decision:** Remove `DEFAULT_OPENAI_MODEL` and `DEFAULT_GEMINI_MODEL` constants
**Rationale:**

- With required selection, backend no longer needs defaults
- Simplifies provider plugin logic
- Single source of truth: database room config

**Migration Path:**

- Existing rooms with `aiModel: null` must be backfilled before deployment
- Migration script will set existing null values to corresponding defaults

### 4. Schema Enforcement

**Decision:** Make `aiModel` field required (non-nullable)
**Rationale:**

- Database integrity: every room must have a model
- Prevents runtime errors from missing model config
- Matches new UX requirement

## Technical Implementation

### Files to Modify

#### Dashboard (`packages/dashboard/`)

1. **`src/lib/provider-models.ts`**
   - Replace `PROVIDER_MODELS` with research.md specifications
   - Add emoji indicators: ⚡ for latest, appropriate labels for each tier
   - Remove old model references

2. **`src/lib/room-schema.ts`**
   - Change `aiModel` from `.nullable().optional()` to `.string().min(1)`
   - Update validation messages

3. **`src/pages/room-create.tsx`**
   - Remove "Default model" option from `modelOptions`
   - Set `defaultValues.aiModel` to:
     - `gpt-5.4-pro` when `aiProvider === 'openai'`
     - `gemini-3.1-pro-preview` when `aiProvider === 'gemini'`
   - Update hint text to reflect required selection

4. **`src/pages/room-detail.tsx`**
   - Remove "Default model" option from `modelOptions`
   - Ensure existing room model is displayed correctly
   - Handle provider switch: reset to new provider's best model

#### Backend Providers

5. **`packages/provider-openai/src/openai-plugin.ts`**
   - Remove `export const DEFAULT_OPENAI_MODEL` line
   - Remove default parameter from `OpenAIExecutor` constructor
   - Update `manifest.defaultModel` to `null` or remove field
   - Expect `modelId` to always be provided

6. **`packages/provider-gemini/src/gemini-plugin.ts`**
   - Remove `export const DEFAULT_GEMINI_MODEL` line
   - Remove default parameter from `GeminiExecutor` constructor
   - Update `manifest.defaultModel` to `null` or remove field
   - Expect `modelId` to always be provided

### Data Migration

**Pre-Deployment Migration Required:**

```sql
-- Backfill existing rooms with null aiModel
UPDATE rooms
SET aiModel = CASE
  WHEN aiProvider = 'openai' THEN 'gpt-5.4-pro'
  WHEN aiProvider = 'gemini' THEN 'gemini-3.1-pro-preview'
END
WHERE aiModel IS NULL;

-- Add NOT NULL constraint after backfill
ALTER TABLE rooms
ALTER COLUMN aiModel SET NOT NULL;
```

**Migration Strategy:**

1. Deploy backend first (backward compatible - still accepts null)
2. Run backfill migration
3. Deploy dashboard with required field
4. Apply database constraint

### UI/UX Changes

**Before:**

```
AI Model: [Default model ▼]
         - Default model
         - GPT-4o
         - GPT-4o Mini
         - GPT-4 Turbo
```

**After:**

```
AI Model: [GPT-5.4 Pro ⚡ (Deep Reasoning) ▼] ← Pre-selected
         - GPT-5.4 ⚡ Latest
         - GPT-5.4 Pro (Deep Reasoning)
         - GPT-5.2
         - GPT-5.1
         - GPT-5 Mini (Cost-efficient)
         - GPT-4.1 (Stable)
```

**Hint Text:**

- Before: "Leave blank to use the provider default."
- After: "Select the model for translation quality and cost balance."

### Labels & Presentation

Follow research.md exactly:

**OpenAI:**

```typescript
{ value: 'gpt-5.4',      label: 'GPT-5.4 ⚡ Latest' },
{ value: 'gpt-5.4-pro',  label: 'GPT-5.4 Pro (Deep Reasoning)' },
{ value: 'gpt-5.2',      label: 'GPT-5.2' },
{ value: 'gpt-5.1',      label: 'GPT-5.1' },
{ value: 'gpt-5-mini',   label: 'GPT-5 Mini (Cost-efficient)' },
{ value: 'gpt-4.1',      label: 'GPT-4.1 (Stable)' },
```

**Gemini:**

```typescript
{ value: 'gemini-3.1-pro-preview',      label: 'Gemini 3.1 Pro Preview ⚡ Latest' },
{ value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
{ value: 'gemini-2.5-pro',              label: 'Gemini 2.5 Pro (Stable)' },
{ value: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash (Stable)' },
{ value: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash' },
```

## Testing Strategy

### Unit Tests to Update

1. **`provider-models.test.ts`**
   - Verify new model lists match research.md
   - Ensure no deprecated models remain
   - Validate emoji indicators render correctly

2. **`room-schema.test.ts`**
   - Test `aiModel` required validation
   - Test rejection of empty string
   - Test rejection of null

3. **`room-create.test.tsx`**
   - Verify default model pre-selection
   - Test provider switch updates model default
   - Ensure "Default model" option is gone

4. **`room-detail.test.tsx`**
   - Verify existing room model displays correctly
   - Test provider switch behavior
   - Ensure model dropdown shows new list

5. **Backend provider tests**
   - Remove tests relying on `DEFAULT_*_MODEL` constants
   - Test executor with explicit model IDs
   - Ensure error handling when model is missing

### Integration Tests

1. **Create Room Flow**
   - Verify user can create room with new models
   - Confirm model is saved to database correctly
   - Test validation prevents empty model

2. **Edit Room Flow**
   - Verify existing rooms load correctly
   - Test switching provider updates model options
   - Confirm model updates persist

3. **Translation Execution**
   - Test translation with gpt-5.4-pro
   - Test translation with gemini-3.1-pro-preview
   - Verify model ID is passed to provider correctly

### Manual Testing Checklist

- [ ] Dashboard displays new models only
- [ ] "Default model" option is removed
- [ ] Form defaults to best model (gpt-5.4-pro / gemini-3.1-pro-preview)
- [ ] Provider switch updates model default correctly
- [ ] Create room saves selected model
- [ ] Edit room preserves existing model
- [ ] Translation uses correct model
- [ ] No deprecated models appear anywhere
- [ ] Backend providers reject missing model ID

## Rollout Plan

### Phase 1: Backend Compatibility (Day 1)

- Deploy backend with backward-compatible changes
- Backend still accepts `aiModel: null` but logs warning
- No user-facing changes yet

### Phase 2: Data Migration (Day 1-2)

- Run backfill migration in production
- Verify all rooms have non-null `aiModel`
- Monitor logs for any issues

### Phase 3: Dashboard Deployment (Day 2-3)

- Deploy dashboard with new model lists
- Deploy required field validation
- Users immediately see new models

### Phase 4: Database Constraint (Day 3-4)

- Apply `NOT NULL` constraint on `aiModel` column
- Remove backward-compatibility code from backend
- Full enforcement complete

### Rollback Plan

- Keep deprecated models in backend `*_MODEL_VALUES` arrays during Phase 1-3
- If issues arise, revert dashboard deployment
- Migration is safe to rollback (just remove constraint)

## Risks & Mitigations

### Risk 1: Existing Rooms with Deprecated Models

**Impact:** Medium - Users may have saved rooms with gpt-4o
**Mitigation:**

- Keep deprecated models in backend type unions during rollout
- Backend will still accept them, but dashboard won't offer them
- Gradual deprecation: warn users to update models

**Alternative Mitigation:**

- Auto-migrate deprecated models to equivalents:
  - `gpt-4o` → `gpt-5.4`
  - `gpt-4o-mini` → `gpt-5-mini`
  - `gemini-1.5-pro` → `gemini-2.5-pro`

### Risk 2: Migration Script Failure

**Impact:** High - Deployment blocked if backfill fails
**Mitigation:**

- Run migration in staging first
- Add idempotency: script can be re-run safely
- Manual verification step before Phase 3

### Risk 3: New Models Not Yet Available in API

**Impact:** High - Translation failures if model doesn't exist
**Mitigation:**

- Verify model availability in staging/test API calls
- Add graceful fallback in backend (temporarily)
- Monitor error rates during rollout

### Risk 4: User Confusion About Model Changes

**Impact:** Low - Support tickets about missing old models
**Mitigation:**

- Add changelog/release notes
- Update documentation
- Show banner: "New AI models available!"

## Success Metrics

### Deployment Success

- Zero migration errors during backfill
- All existing rooms have non-null `aiModel` after Phase 2
- No 500 errors from missing model IDs

### User Experience

- 90%+ of new rooms use top-tier models (gpt-5.4-pro, gemini-3.1-pro-preview)
- Zero support tickets about "which model am I using?"
- Translation success rate unchanged or improved

### Code Quality

- Zero references to deprecated models in codebase (verified by grep)
- All tests pass with new model lists
- No `DEFAULT_*_MODEL` constants remain

## Open Questions

None remaining - all decisions finalized.

## Out of Scope

- Backend model type union cleanup (keep extra models like gpt-5-nano for now)
- Model performance benchmarking
- Cost analysis per model
- Auto-upgrade logic for deprecated models (manual update required)
- Model recommendation engine based on usage patterns

## References

- Research document: `research.md`
- Backend OpenAI plugin: `packages/provider-openai/src/openai-plugin.ts`
- Backend Gemini plugin: `packages/provider-gemini/src/gemini-plugin.ts`
- Dashboard models: `packages/dashboard/src/lib/provider-models.ts`

## Approval

**Prepared by:** AI Assistant (with user guidance)  
**Reviewed by:** [Pending user approval]  
**Approved by:** [Pending]  
**Date:** 2026-03-28

---

**Next Step:** Upon approval, generate implementation plan with detailed file changes.
