---
date: 2026-03-28
topic: ai-model-upgrade-implementation-plan
status: ready-to-execute
design-doc: ./2026-03-28-ai-model-upgrade-design.md
---

# Implementation Plan: AI Model Upgrade

**Goal:** Upgrade AI models from deprecated versions to latest GPT-5.x and Gemini 3.x with required model selection.

**Estimated Effort:** 4-6 hours (including testing)

**Prerequisites:**

- Design document approved ✅
- Staging environment available for testing
- Database backup taken

---

## Phase 1: Dashboard Updates (Frontend)

### Step 1.1: Update Model Lists (`provider-models.ts`)

**File:** `packages/dashboard/src/lib/provider-models.ts`

**Changes:**

```typescript
// Replace entire PROVIDER_MODELS object
export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    { value: 'gpt-5.4', label: 'GPT-5.4 ⚡ Latest' },
    { value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro (Deep Reasoning)' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.1', label: 'GPT-5.1' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini (Cost-efficient)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (Stable)' },
  ],
  gemini: [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview ⚡ Latest' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Stable)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Stable)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
}
```

**Verification:**

```bash
bun test packages/dashboard/src/lib/provider-models.test.ts
```

**Expected:** All model lists should contain only new models from research.md.

---

### Step 1.2: Update Schema Validation (`room-schema.ts`)

**File:** `packages/dashboard/src/lib/room-schema.ts`

**Changes:**

**In `roomCreateSchema`:**

```typescript
// OLD:
aiModel: z.string().nullable().optional(),

// NEW:
aiModel: z
  .string({ required_error: 'AI Model is required' })
  .min(1, 'AI Model is required'),
```

**In `roomEditSchema`:**

```typescript
// OLD:
aiModel: z.string().optional().default(''),

// NEW:
aiModel: z
  .string({ required_error: 'AI Model is required' })
  .min(1, 'AI Model is required'),
```

**Verification:**

```bash
bun test packages/dashboard/src/lib/room-schema.test.ts
```

**Expected:** Schema should reject empty strings and null values for `aiModel`.

---

### Step 1.3: Update Room Create Page (`room-create.tsx`)

**File:** `packages/dashboard/src/pages/room-create.tsx`

**Changes:**

**1. Update default values (lines ~54-60):**

```typescript
// OLD:
defaultValues: {
  aiProvider: 'openai',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiModel: '',  // ← Remove this line
  destinationRoomName: '',
  aiApiToken: '',
},

// NEW:
defaultValues: {
  aiProvider: 'openai',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiModel: 'gpt-5.4-pro',  // ← Default to best model
  destinationRoomName: '',
  aiApiToken: '',
},
```

**2. Remove "Default model" option from modelOptions (lines ~64-70):**

```typescript
// OLD:
const modelOptions = [
  { value: '', label: 'Default model' }, // ← Remove this line
  ...PROVIDER_MODELS[selectedProvider].map((model) => ({
    value: model.value,
    label: model.label,
  })),
]

// NEW:
const modelOptions = PROVIDER_MODELS[selectedProvider].map((model) => ({
  value: model.value,
  label: model.label,
}))
```

**3. Update aiProviderField onChange handler (lines ~72-76):**

```typescript
// OLD:
const aiProviderField = register('aiProvider', {
  onChange: () => {
    setValue('aiModel', '') // ← Reset to empty
  },
})

// NEW:
const aiProviderField = register('aiProvider', {
  onChange: (e) => {
    const newProvider = e.target.value as AiProvider
    const bestModel = newProvider === 'openai' ? 'gpt-5.4-pro' : 'gemini-3.1-pro-preview'
    setValue('aiModel', bestModel)
  },
})
```

**4. Remove normalization of empty string (lines ~78-86):**

```typescript
// OLD:
const onSubmit = async (data: RoomCreateInput) => {
  const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

  const result = await createRoomAction.execute(() =>
    createRoom({
      ...data,
      aiModel: normalizedAiModel, // ← No longer needed
    }),
  )
  // ...
}

// NEW:
const onSubmit = async (data: RoomCreateInput) => {
  const result = await createRoomAction.execute(
    () => createRoom(data), // ← Pass data directly, aiModel is always present
  )
  // ...
}
```

**5. Update hint text (line ~153):**

```typescript
// OLD:
hint = 'Leave blank to use the provider default.'

// NEW:
hint = 'Select the model for translation quality and cost balance.'
```

**Verification:**

```bash
bun test packages/dashboard/src/pages/room-create.test.tsx
```

**Expected:**

- Form should pre-select `gpt-5.4-pro` by default
- Switching provider should update model to best model
- "Default model" option should not appear

---

### Step 1.4: Update Room Detail Page (`room-detail.tsx`)

**File:** `packages/dashboard/src/pages/room-detail.tsx`

**Changes:**

**1. Remove "Default model" option (lines ~152-158):**

```typescript
// OLD:
const modelOptions = [
  { value: '', label: 'Default model' }, // ← Remove this line
  ...PROVIDER_MODELS[selectedProvider].map((model) => ({
    value: model.value,
    label: model.label,
  })),
]

// NEW:
const modelOptions = PROVIDER_MODELS[selectedProvider].map((model) => ({
  value: model.value,
  label: model.label,
}))
```

**2. Update aiProviderField onChange (lines ~160-164):**

```typescript
// OLD:
const aiProviderField = editForm.register('aiProvider', {
  onChange: () => {
    editForm.setValue('aiModel', '') // ← Reset to empty
  },
})

// NEW:
const aiProviderField = editForm.register('aiProvider', {
  onChange: (e) => {
    const newProvider = e.target.value as AiProvider
    const bestModel = newProvider === 'openai' ? 'gpt-5.4-pro' : 'gemini-3.1-pro-preview'
    editForm.setValue('aiModel', bestModel)
  },
})
```

**3. Remove normalization (lines ~168-179):**

```typescript
// OLD:
const onEditSubmit = async (data: RoomEditInput) => {
  const normalizedAiModel = data.aiModel === '' ? null : data.aiModel

  const result = await updateRoomAction.execute(() =>
    updateRoom(room.id, {
      destinationRoomName: data.destinationRoomName,
      aiProvider: data.aiProvider,
      aiModel: normalizedAiModel, // ← No longer needed
      translationStyle: data.translationStyle,
      ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
    }),
  )
  // ...
}

// NEW:
const onEditSubmit = async (data: RoomEditInput) => {
  const result = await updateRoomAction.execute(() =>
    updateRoom(room.id, {
      destinationRoomName: data.destinationRoomName,
      aiProvider: data.aiProvider,
      aiModel: data.aiModel, // ← Always has value now
      translationStyle: data.translationStyle,
      ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
    }),
  )
  // ...
}
```

**4. Update hint text (line ~286):**

```typescript
// OLD:
hint = 'Leave unchanged to keep the existing token.'

// NEW:
hint = 'Leave blank to keep existing token, or enter new token to update.'
```

**Note:** This is for the API token field, NOT the model field. The model field should not have a hint about "leaving blank" anymore.

**Verification:**

```bash
bun test packages/dashboard/src/pages/room-detail.test.tsx
```

**Expected:**

- Existing room should display its current model correctly
- Switching provider should update model to best model for new provider
- "Default model" option should not appear

---

## Phase 2: Backend Provider Updates

### Step 2.1: Update OpenAI Plugin (`openai-plugin.ts`)

**File:** `packages/provider-openai/src/openai-plugin.ts`

**Changes:**

**1. Remove DEFAULT_OPENAI_MODEL constant (line 23):**

```typescript
// OLD:
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-5.4'

// NEW:
// (Remove this line entirely)
```

**2. Update OpenAIExecutor constructor (lines ~38-42):**

```typescript
// OLD:
constructor(
  private readonly modelId: string = DEFAULT_OPENAI_MODEL,
  private readonly apiKey?: string,
  private readonly baseUrl?: string,
) {
  // ...
}

// NEW:
constructor(
  private readonly modelId: string,  // ← No default value
  private readonly apiKey?: string,
  private readonly baseUrl?: string,
) {
  // ...
}
```

**3. Update manifest.defaultModel (line ~99):**

```typescript
// OLD:
defaultModel: DEFAULT_OPENAI_MODEL,

// NEW:
defaultModel: null,  // ← No default, expects explicit model from room config
```

**4. Update createExecutor function:**

```typescript
// If createExecutor function exists, ensure it requires modelId parameter
// Look for any places where DEFAULT_OPENAI_MODEL is used and remove them
```

**Verification:**

```bash
bun test packages/provider-openai/src/openai-plugin.test.ts
```

**Expected:**

- Executor should require explicit `modelId` parameter
- No references to `DEFAULT_OPENAI_MODEL` remain
- Tests should pass by providing explicit model IDs

---

### Step 2.2: Update Gemini Plugin (`gemini-plugin.ts`)

**File:** `packages/provider-gemini/src/gemini-plugin.ts`

**Changes:**

**1. Remove DEFAULT_GEMINI_MODEL constant (line 23):**

```typescript
// OLD:
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'

// NEW:
// (Remove this line entirely)
```

**2. Update GeminiExecutor constructor (lines ~43-46):**

```typescript
// OLD:
constructor(
  private readonly modelId: string = DEFAULT_GEMINI_MODEL,
  apiKey?: string,
) {
  // ...
}

// NEW:
constructor(
  private readonly modelId: string,  // ← No default value
  apiKey?: string,
) {
  // ...
}
```

**3. Update manifest.defaultModel (line ~104):**

```typescript
// OLD:
defaultModel: DEFAULT_GEMINI_MODEL,

// NEW:
defaultModel: null,  // ← No default, expects explicit model from room config
```

**Verification:**

```bash
bun test packages/provider-gemini/src/gemini-plugin.test.ts
```

**Expected:**

- Executor should require explicit `modelId` parameter
- No references to `DEFAULT_GEMINI_MODEL` remain
- Tests should pass by providing explicit model IDs

---

### Step 2.3: Update Provider Exports (`index.ts` files)

**Files:**

- `packages/provider-openai/src/index.ts`
- `packages/provider-gemini/src/index.ts`

**Changes:**

**OpenAI (`packages/provider-openai/src/index.ts`):**

```typescript
// OLD:
export {
  openaiPlugin,
  OPENAI_MODEL_VALUES,
  DEFAULT_OPENAI_MODEL, // ← Remove this line
  supportsThinking,
} from './openai-plugin'
export type { OpenAIModel } from './openai-plugin'

// NEW:
export { openaiPlugin, OPENAI_MODEL_VALUES, supportsThinking } from './openai-plugin'
export type { OpenAIModel } from './openai-plugin'
```

**Gemini (`packages/provider-gemini/src/index.ts`):**

```typescript
// OLD:
export {
  geminiPlugin,
  GEMINI_MODEL_VALUES,
  DEFAULT_GEMINI_MODEL, // ← Remove this line
  supportsThinking,
} from './gemini-plugin'
export type { GeminiModel } from './gemini-plugin'

// NEW:
export { geminiPlugin, GEMINI_MODEL_VALUES, supportsThinking } from './gemini-plugin'
export type { GeminiModel } from './gemini-plugin'
```

**Verification:**

```bash
grep -r "DEFAULT_OPENAI_MODEL\|DEFAULT_GEMINI_MODEL" packages/
```

**Expected:** No matches found (all references removed).

---

## Phase 3: Testing

### Step 3.1: Unit Tests

Run all unit tests to ensure changes are correct:

```bash
# Dashboard tests
bun test packages/dashboard/src/lib/provider-models.test.ts
bun test packages/dashboard/src/lib/room-schema.test.ts
bun test packages/dashboard/src/pages/room-create.test.tsx
bun test packages/dashboard/src/pages/room-detail.test.tsx

# Backend provider tests
bun test packages/provider-openai/src/openai-plugin.test.ts
bun test packages/provider-gemini/src/gemini-plugin.test.ts

# Full test suite
bun test
```

**Expected:** All tests should pass.

**If tests fail:**

- Check for hardcoded references to old models (gpt-4o, gemini-1.5-\*)
- Ensure test fixtures provide explicit `aiModel` values
- Update mock data to use new model IDs

---

### Step 3.2: Type Checking

```bash
bun run typecheck
```

**Expected:** No type errors.

**Common issues:**

- `aiModel` field might be used as nullable somewhere
- Provider constructors might be called without `modelId` parameter

---

### Step 3.3: Linting

```bash
bun run lint
```

**Expected:** No linting errors.

---

### Step 3.4: Build Check

```bash
bun run build
```

**Expected:** Successful build for all packages.

---

### Step 3.5: Manual Testing (Local)

**Prerequisites:** Start local dev environment

```bash
# Terminal 1: Start translator backend
cd packages/translator
bun dev

# Terminal 2: Start dashboard frontend
cd packages/dashboard
bun dev
```

**Test Cases:**

#### Test 1: Create New Room

1. Navigate to `/create`
2. ✅ Verify default model is pre-selected (`gpt-5.4-pro` for OpenAI)
3. ✅ Verify "Default model" option does NOT appear in dropdown
4. ✅ Verify all new models appear (gpt-5.4, gpt-5.4-pro, etc.)
5. ✅ Verify old models do NOT appear (gpt-4o, gpt-4-turbo)
6. Switch provider to Gemini
7. ✅ Verify model auto-changes to `gemini-3.1-pro-preview`
8. Fill in other fields and submit
9. ✅ Verify room is created successfully
10. ✅ Verify `aiModel` is saved correctly in database

#### Test 2: Edit Existing Room

1. Navigate to an existing room detail page
2. ✅ Verify current model is displayed correctly
3. ✅ Verify "Default model" option does NOT appear
4. ✅ Verify all new models appear
5. Switch provider to a different one
6. ✅ Verify model auto-changes to best model for new provider
7. Save changes
8. ✅ Verify model is updated correctly in database

#### Test 3: Translation Execution

1. Create a room with `gpt-5.4-pro` model
2. Send a test message to Chatwork room
3. ✅ Verify translation executes successfully
4. ✅ Check backend logs: model ID should be `gpt-5.4-pro`
5. Repeat with Gemini `gemini-3.1-pro-preview`
6. ✅ Verify translation works correctly

#### Test 4: Validation

1. Attempt to create room without selecting a model (if possible via manual form manipulation)
2. ✅ Verify validation error appears: "AI Model is required"

---

## Phase 4: Data Migration (Production Only)

**⚠️ IMPORTANT:** Only run in production AFTER testing in staging.

### Step 4.1: Pre-Migration Checks

```bash
# Check how many rooms have null aiModel
SELECT COUNT(*) FROM rooms WHERE aiModel IS NULL;

# View all rooms with null aiModel
SELECT id, destinationRoomName, aiProvider, aiModel
FROM rooms
WHERE aiModel IS NULL;
```

**Expected:** Determine the number of rooms that need migration.

---

### Step 4.2: Run Backfill Migration

**File:** Create migration script `migrations/backfill-ai-models.sql`

```sql
-- Backfill existing rooms with null aiModel
-- Uses best model for each provider

BEGIN;

UPDATE rooms
SET aiModel = CASE
  WHEN aiProvider = 'openai' THEN 'gpt-5.4-pro'
  WHEN aiProvider = 'gemini' THEN 'gemini-3.1-pro-preview'
  ELSE 'gpt-5.4-pro'  -- Fallback (should never happen)
END
WHERE aiModel IS NULL;

-- Verify no null values remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rooms WHERE aiModel IS NULL) THEN
    RAISE EXCEPTION 'Migration failed: rooms with null aiModel still exist';
  END IF;
END $$;

COMMIT;
```

**Run migration:**

```bash
# Using psql
psql -U your_user -d your_database -f migrations/backfill-ai-models.sql

# Or using Bun (if you have a migration runner)
bun run migrate
```

**Verification:**

```sql
-- Should return 0
SELECT COUNT(*) FROM rooms WHERE aiModel IS NULL;

-- Verify all rooms have valid models
SELECT aiProvider, aiModel, COUNT(*)
FROM rooms
GROUP BY aiProvider, aiModel
ORDER BY aiProvider, aiModel;
```

**Expected:** All rooms should have non-null `aiModel` values.

---

### Step 4.3: Apply Database Constraint

**⚠️ Only after verifying migration success!**

```sql
-- Add NOT NULL constraint
ALTER TABLE rooms
ALTER COLUMN aiModel SET NOT NULL;
```

**Verification:**

```sql
-- Should fail with constraint violation
INSERT INTO rooms (originalRoomId, destinationRoomName, aiProvider, aiModel, translationStyle, enabled)
VALUES (999999, 'Test Room', 'openai', NULL, 'PROFESSIONAL_BUSINESS', false);

-- Expected error: null value in column "aiModel" violates not-null constraint
```

**Expected:** Database should enforce `aiModel` as required field.

---

## Phase 5: Deployment

### Step 5.1: Deploy Backend (Backward Compatible)

**Deployment Steps:**

1. Build backend packages

   ```bash
   bun run build
   ```

2. Deploy translator service

   ```bash
   # Example: Deploy to production server
   ssh your-server
   cd /path/to/chatwork-translation-bot
   git pull origin main
   bun install
   bun run build
   pm2 restart translator
   ```

3. Verify backend is running
   ```bash
   curl https://your-domain.com/health
   ```

**Expected:** Backend should accept both old and new model IDs (temporarily).

---

### Step 5.2: Run Data Migration

Run the backfill migration script from Step 4.2.

**Verification:**

- Check logs for errors
- Verify all rooms have non-null `aiModel`
- Test a few rooms to ensure translations still work

---

### Step 5.3: Deploy Dashboard

**Deployment Steps:**

1. Build dashboard

   ```bash
   cd packages/dashboard
   bun run build
   ```

2. Deploy to hosting (e.g., Vercel, Netlify, or static hosting)

   ```bash
   # Example: Deploy to Vercel
   vercel --prod

   # Or: Copy build to web server
   rsync -avz dist/ your-server:/var/www/dashboard/
   ```

3. Verify dashboard is accessible
   ```bash
   curl https://your-dashboard.com
   ```

**Expected:** Users should see new model lists immediately.

---

### Step 5.4: Apply Database Constraint

Run the ALTER TABLE command from Step 4.3.

**Expected:** Database enforces required `aiModel` field.

---

### Step 5.5: Remove Backward Compatibility Code

**Optional:** If you added temporary support for old models during rollout, remove it now.

**Files to check:**

- Provider plugins: Remove any fallback logic for deprecated models
- Backend: Remove temporary warnings about old models

---

## Phase 6: Verification & Monitoring

### Step 6.1: Smoke Tests (Production)

**Test Cases:**

1. ✅ Create new room with OpenAI gpt-5.4-pro
2. ✅ Create new room with Gemini gemini-3.1-pro-preview
3. ✅ Edit existing room and change model
4. ✅ Execute translation with new models
5. ✅ Verify backend logs show correct model IDs

---

### Step 6.2: Monitor Error Rates

**Metrics to watch:**

- Translation success rate (should remain stable or improve)
- API errors from OpenAI/Gemini (watch for "model not found" errors)
- Dashboard error logs (no validation errors for existing rooms)
- Database constraint violations (should be zero)

**Tools:**

- Check application logs
- Monitor API error rates
- Review user reports/support tickets

---

### Step 6.3: Rollback Plan (If Needed)

**If critical issues arise:**

1. **Rollback Dashboard:**

   ```bash
   # Revert to previous deployment
   vercel rollback

   # Or: Re-deploy previous version
   git checkout previous-commit
   bun run build
   vercel --prod
   ```

2. **Rollback Backend:**

   ```bash
   ssh your-server
   cd /path/to/chatwork-translation-bot
   git checkout previous-commit
   bun install
   bun run build
   pm2 restart translator
   ```

3. **Rollback Database Constraint (if needed):**
   ```sql
   -- Remove NOT NULL constraint
   ALTER TABLE rooms
   ALTER COLUMN aiModel DROP NOT NULL;
   ```

**Note:** Data migration (backfill) does NOT need to be rolled back - it's safe to keep.

---

## Phase 7: Cleanup

### Step 7.1: Remove Deprecated Model Tests

**Search for and update any remaining references:**

```bash
# Find references to old models
grep -r "gpt-4o\|gpt-4-turbo\|gemini-1.5" packages/
```

**Update or remove:**

- Test fixtures using old model IDs
- Documentation mentioning old models
- Example configurations

---

### Step 7.2: Update Documentation

**Files to update:**

- `README.md`: Update model examples
- `docs/`: Update any architecture docs mentioning models
- `.env.example`: Update example model IDs
- API documentation: Update supported models list

---

### Step 7.3: Update Changelog

**File:** `CHANGELOG.md` (or create if doesn't exist)

```markdown
## [Unreleased]

### Changed

- Upgraded AI models to latest versions:
  - OpenAI: GPT-5.4, GPT-5.4-pro, GPT-5.2, GPT-5.1, GPT-5-mini, GPT-4.1
  - Gemini: Gemini 3.1 Pro Preview, Gemini 3.1 Flash Lite, Gemini 2.5 Pro/Flash, Gemini 2.0 Flash
- Removed deprecated models: GPT-4o, GPT-4-turbo, Gemini 1.5 Pro/Flash
- Made AI model selection required (removed "Default model" option)
- Updated dashboard to pre-select best models by default (gpt-5.4-pro, gemini-3.1-pro-preview)

### Removed

- Backend `DEFAULT_OPENAI_MODEL` and `DEFAULT_GEMINI_MODEL` constants

### Migration

- Existing rooms with null `aiModel` were backfilled with best models for their providers
- Database constraint added: `aiModel` is now NOT NULL
```

---

## Success Criteria

### Definition of Done

- [ ] All unit tests pass (`bun test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Manual testing checklist completed
- [ ] Data migration executed successfully (production)
- [ ] Dashboard deployed and accessible
- [ ] Backend deployed and running
- [ ] Database constraint applied
- [ ] Smoke tests pass in production
- [ ] No error rate increase in monitoring
- [ ] Documentation updated
- [ ] Changelog updated

### Metrics (1 week post-deployment)

- **Translation success rate:** ≥ 99% (unchanged or improved)
- **Dashboard errors:** Zero validation errors related to model selection
- **Support tickets:** Zero tickets about "missing old models" or "which model am I using?"
- **Model adoption:**
  - ≥ 70% of new rooms use top-tier models (gpt-5.4-pro, gemini-3.1-pro-preview)
  - 100% of rooms have non-null `aiModel` values

---

## Timeline Estimate

**Total Time:** 4-6 hours (including testing and deployment)

| Phase | Task                                  | Time Estimate |
| ----- | ------------------------------------- | ------------- |
| 1     | Dashboard updates (4 files)           | 1.5 hours     |
| 2     | Backend provider updates (2 plugins)  | 1 hour        |
| 3     | Testing (unit + manual)               | 1 hour        |
| 4     | Data migration (staging + production) | 30 min        |
| 5     | Deployment                            | 30 min        |
| 6     | Verification & monitoring             | 30 min        |
| 7     | Cleanup & documentation               | 30 min        |

**Buffer:** +1 hour for unexpected issues

---

## Notes & Tips

### Development Tips

1. **Work in feature branch:**

   ```bash
   git checkout -b feature/ai-model-upgrade
   ```

2. **Commit frequently:**

   ```bash
   git commit -m "Update dashboard provider-models.ts"
   git commit -m "Update room-schema.ts validation"
   # etc.
   ```

3. **Test incrementally:**
   - Test after each file change
   - Don't wait until the end to run tests

4. **Use grep to verify cleanup:**
   ```bash
   # Should return no results after cleanup
   grep -r "DEFAULT_OPENAI_MODEL" packages/
   grep -r "gpt-4o" packages/
   ```

### Common Pitfalls

1. **Forgetting to update tests:** Tests may still reference old models
2. **Not handling provider switch:** Provider change should update model default
3. **Database migration without backup:** Always backup before migration
4. **Deploying dashboard before backend:** Backend must support new models first

### Debug Tips

If translations fail with new models:

1. Check backend logs for model ID being sent

   ```bash
   tail -f logs/translator.log | grep "modelId"
   ```

2. Verify model ID is supported by API

   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     | grep "gpt-5.4-pro"
   ```

3. Check if model requires special parameters (e.g., thinking tokens)

---

## Contacts & Resources

- **Design Doc:** `docs/2026-03-28-ai-model-upgrade-design.md`
- **Research Doc:** `research.md`
- **Support:** [Your team contact info]
- **Monitoring Dashboard:** [Your monitoring tool URL]

---

**Status:** Ready to execute ✅  
**Last Updated:** 2026-03-28  
**Author:** AI Assistant (with user guidance)
