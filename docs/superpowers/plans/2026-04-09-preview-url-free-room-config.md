# Preview URL for Free Room Config - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add computed `previewUrl` field to free room configs with single source of truth for Kagi URL building

**Architecture:** Consolidate `buildKagiUrl()` from kagi-sidecar into provider-kagi, compute previewUrl in translator store

**Tech Stack:** Bun, TypeScript, Zod, URLSearchParams

---

## Task 1: Move URL Builder to provider-kagi

**Files:**

- Create: `packages/provider-kagi/src/url-builder.ts`
- Create: `packages/provider-kagi/src/url-builder.test.ts`
- Modify: `packages/provider-kagi/src/index.ts`

### Step 1: Create url-builder.ts with moved code

- [ ] **Create file with constants and types**

Create `packages/provider-kagi/src/url-builder.ts`:

```typescript
import type { KagiStyle } from './types'
import { KAGI_STYLE_PRESETS } from './types'

const KAGI_TRANSLATE_BASE_URL = 'https://translate.kagi.com/'

type KagiTranslationType = 'natural' | 'literal'
type KagiFormality = 'standard' | 'vietnamese_formal' | 'vietnamese_casual'
type KagiReadingLevel = 'standard' | 'a2' | 'b2' | 'c1' | 'c2'

type KagiStyleQuery = Readonly<{
  formality?: 'less' | 'more'
  formalityContext?: string
  languageComplexity?: Exclude<KagiReadingLevel, 'standard'>
  style?: 'literal'
}>

function mapFormality(
  formality: KagiFormality,
): Pick<KagiStyleQuery, 'formality' | 'formalityContext'> {
  if (formality === 'vietnamese_formal') {
    return {
      formality: 'more',
      formalityContext: 'vi_formal',
    }
  }

  if (formality === 'vietnamese_casual') {
    return {
      formality: 'less',
      formalityContext: 'vi_casual',
    }
  }

  return {}
}

function mapReadingLevel(
  readingLevel: KagiReadingLevel,
): Pick<KagiStyleQuery, 'languageComplexity'> {
  if (readingLevel === 'standard') {
    return {}
  }

  return {
    languageComplexity: readingLevel,
  }
}

function mapTranslationType(translationType: KagiTranslationType): Pick<KagiStyleQuery, 'style'> {
  if (translationType === 'literal') {
    return {
      style: 'literal',
    }
  }

  return {}
}

function getStyleQuery(style: KagiStyle): KagiStyleQuery {
  const preset = KAGI_STYLE_PRESETS[style]

  return {
    ...mapFormality(preset.formality),
    ...mapReadingLevel(preset.readingLevel),
    ...mapTranslationType(preset.translationType),
  }
}

export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const params = new URLSearchParams()
  const styleParams = getStyleQuery(style)
  const trimmedContext = context?.trim()

  params.set('from', 'auto')
  params.set('to', 'vi')
  params.set('text', text)
  params.set('preserveFormatting', 'true')

  if (styleParams.formality !== undefined) {
    params.set('formality', styleParams.formality)
  }

  if (styleParams.formalityContext !== undefined) {
    params.set('formality_context', styleParams.formalityContext)
  }

  if (styleParams.languageComplexity !== undefined) {
    params.set('language_complexity', styleParams.languageComplexity)
  }

  if (styleParams.style !== undefined) {
    params.set('style', styleParams.style)
  }

  if (trimmedContext !== undefined && trimmedContext.length > 0) {
    params.set('context', trimmedContext)
  }

  return `${KAGI_TRANSLATE_BASE_URL}?${params.toString()}`
}

export function buildPreviewUrl(style: KagiStyle, context?: string | null): string {
  return buildKagiUrl('hello', style, context ?? undefined)
}
```

### Step 2: Run typecheck to verify syntax

- [ ] **Verify TypeScript compilation**

Run: `bun run typecheck --filter provider-kagi`

Expected: No errors (all types resolved correctly)

### Step 3: Export from index.ts

- [ ] **Add export statement**

Modify `packages/provider-kagi/src/index.ts`:

```typescript
export * from './types'
export * from './kagi-client'
export * from './url-builder'
```

### Step 4: Run typecheck again

- [ ] **Verify exports work**

Run: `bun run typecheck --filter provider-kagi`

Expected: No errors

### Step 5: Commit url-builder creation

- [ ] **Commit code**

```bash
git add packages/provider-kagi/src/url-builder.ts packages/provider-kagi/src/index.ts
git commit -m "feat(provider-kagi): add url-builder with buildKagiUrl and buildPreviewUrl

Move buildKagiUrl from kagi-sidecar to provider-kagi as single source of truth.
Add buildPreviewUrl convenience wrapper for preview URLs with text='hello'.

- Import KAGI_STYLE_PRESETS from ./types (uses structure with label field)
- Helper functions: mapFormality, mapReadingLevel, mapTranslationType
- buildKagiUrl: construct full Kagi Translate URL with style + context
- buildPreviewUrl: wrapper that calls buildKagiUrl with 'hello' text
"
```

---

## Task 2: Move URL Builder Tests to provider-kagi

**Files:**

- Create: `packages/provider-kagi/src/url-builder.test.ts`

### Step 1: Write test for buildKagiUrl

- [ ] **Create test file with buildKagiUrl tests**

Create `packages/provider-kagi/src/url-builder.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { buildKagiUrl, buildPreviewUrl } from './url-builder'

describe('buildKagiUrl', () => {
  it('should build URL with Wild style and context', () => {
    const url = buildKagiUrl('hello', 'Wild', 'software team')

    expect(url).toContain('https://translate.kagi.com/')
    expect(url).toContain('from=auto')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=hello')
    expect(url).toContain('preserveFormatting=true')
    expect(url).toContain('formality=less')
    expect(url).toContain('formality_context=vi_casual')
    expect(url).toContain('language_complexity=c2')
    expect(url).toContain('context=software+team')
  })

  it('should build URL with Clear style without context', () => {
    const url = buildKagiUrl('test', 'Clear')

    expect(url).toContain('text=test')
    expect(url).not.toContain('context=')
    expect(url).not.toContain('formality=')
    expect(url).not.toContain('language_complexity=')
  })

  it('should build URL with True style (literal translation)', () => {
    const url = buildKagiUrl('text', 'True')

    expect(url).toContain('style=literal')
    expect(url).toContain('language_complexity=b2')
  })

  it('should trim context and skip if empty', () => {
    const url = buildKagiUrl('text', 'Clear', '   ')

    expect(url).not.toContain('context=')
  })

  it('should encode special characters in context', () => {
    const url = buildKagiUrl('text', 'Clear', 'test & data')

    expect(url).toContain('context=test+%26+data')
  })
})
```

### Step 2: Add tests for buildPreviewUrl

- [ ] **Add buildPreviewUrl test cases**

Append to `packages/provider-kagi/src/url-builder.test.ts`:

```typescript
describe('buildPreviewUrl', () => {
  it('should build preview URL with context', () => {
    const url = buildPreviewUrl('Wild', 'software team')

    expect(url).toContain('text=hello')
    expect(url).toContain('context=software+team')
  })

  it('should build preview URL without context (null)', () => {
    const url = buildPreviewUrl('Clear', null)

    expect(url).toContain('text=hello')
    expect(url).not.toContain('context=')
  })

  it('should build preview URL without context (undefined)', () => {
    const url = buildPreviewUrl('Smart')

    expect(url).toContain('text=hello')
    expect(url).not.toContain('context=')
  })

  it('should build preview URL without context (empty string)', () => {
    const url = buildPreviewUrl('Deep', '')

    expect(url).toContain('text=hello')
    expect(url).not.toContain('context=')
  })

  it('should build preview URL without context (whitespace)', () => {
    const url = buildPreviewUrl('Fine', '   ')

    expect(url).toContain('text=hello')
    expect(url).not.toContain('context=')
  })

  it('should encode special characters in context', () => {
    const url = buildPreviewUrl('Polite', 'test & data')

    expect(url).toContain('text=hello')
    expect(url).toContain('context=test+%26+data')
  })

  it('should handle unicode context', () => {
    const url = buildPreviewUrl('Elegant', 'ソフトウェア')

    expect(url).toContain('text=hello')
    expect(url).toContain('context=')
    expect(decodeURIComponent(url)).toContain('ソフトウェア')
  })
})
```

### Step 3: Run tests to verify they pass

- [ ] **Execute test suite**

Run: `bun test --filter provider-kagi`

Expected: All tests PASS

### Step 4: Commit test file

- [ ] **Commit tests**

```bash
git add packages/provider-kagi/src/url-builder.test.ts
git commit -m "test(provider-kagi): add comprehensive tests for url-builder

Add test coverage for buildKagiUrl and buildPreviewUrl:
- Wild style with context (formality, complexity, context params)
- Clear style without context (no optional params)
- True style (literal translation mode)
- Context trimming and empty string handling
- Special character encoding (& symbol)
- Unicode context handling (Japanese characters)
- buildPreviewUrl with null/undefined/empty context variants
"
```

---

## Task 3: Update kagi-sidecar to Import from provider-kagi

**Files:**

- Modify: `packages/kagi-sidecar/package.json`
- Modify: `packages/kagi-sidecar/src/browser-service.ts`
- Modify: `packages/kagi-sidecar/src/server.ts`
- Modify: `packages/kagi-sidecar/src/index.ts`
- Modify: `packages/kagi-sidecar/src/browser-service.test.ts`
- Delete: `packages/kagi-sidecar/src/url-builder.ts`
- Delete: `packages/kagi-sidecar/src/url-builder.test.ts`

### Step 1: Add provider-kagi dependency

- [ ] **Update package.json**

Modify `packages/kagi-sidecar/package.json` dependencies section:

```json
{
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@chatwork-bot/provider-kagi": "workspace:*",
    "playwright": "^1.49.1"
  }
}
```

### Step 2: Run install to update lockfile

- [ ] **Install dependencies**

Run: `bun install`

Expected: Lockfile updated, no errors

### Step 3: Update browser-service.ts import

- [ ] **Change import statement**

Modify `packages/kagi-sidecar/src/browser-service.ts`:

Find:

```typescript
import { buildKagiUrl } from './url-builder'
```

Replace with:

```typescript
import { buildKagiUrl } from '@chatwork-bot/provider-kagi'
```

### Step 4: Update server.ts import

- [ ] **Change import statement**

Modify `packages/kagi-sidecar/src/server.ts`:

Find:

```typescript
import { buildKagiUrl } from './url-builder'
```

Replace with:

```typescript
import { buildKagiUrl } from '@chatwork-bot/provider-kagi'
```

### Step 5: Update index.ts exports

- [ ] **Remove url-builder export**

Modify `packages/kagi-sidecar/src/index.ts`:

Find and delete:

```typescript
export * from './url-builder'
```

(Keep all other exports)

### Step 6: Update browser-service.test.ts import

- [ ] **Change type import**

Modify `packages/kagi-sidecar/src/browser-service.test.ts`:

Find:

```typescript
import type { KagiStyle } from './url-builder'
```

Replace with:

```typescript
import type { KagiStyle } from '@chatwork-bot/provider-kagi'
```

### Step 7: Run typecheck to verify imports

- [ ] **Verify TypeScript compilation**

Run: `bun run typecheck --filter kagi-sidecar`

Expected: No errors

### Step 8: Run tests to verify integration

- [ ] **Execute test suite**

Run: `bun test --filter kagi-sidecar`

Expected: All tests PASS (imports work correctly)

### Step 9: Delete old url-builder files

- [ ] **Remove duplicated code**

Run:

```bash
rm packages/kagi-sidecar/src/url-builder.ts
rm packages/kagi-sidecar/src/url-builder.test.ts
```

### Step 10: Run tests again to confirm

- [ ] **Verify tests still pass**

Run: `bun test --filter kagi-sidecar`

Expected: All tests PASS (using provider-kagi imports)

### Step 11: Commit kagi-sidecar cleanup

- [ ] **Commit changes**

```bash
git add packages/kagi-sidecar/
git commit -m "refactor(kagi-sidecar): remove url-builder duplication, import from provider-kagi

Delete url-builder.ts and url-builder.test.ts (~183 lines).
Update all imports to use @chatwork-bot/provider-kagi instead.

- Add provider-kagi workspace dependency
- Update browser-service.ts import
- Update server.ts import
- Update browser-service.test.ts type import
- Remove url-builder export from index.ts
- Delete local url-builder.ts and url-builder.test.ts files

Zero duplication - buildKagiUrl now has single source of truth.
"
```

---

## Task 4: Add previewUrl to FreeRoomConfigSchema

**Files:**

- Modify: `packages/translator/src/types/free-room-config.ts`

### Step 1: Add previewUrl field to schema

- [ ] **Update schema definition**

Modify `packages/translator/src/types/free-room-config.ts`:

Find:

```typescript
export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
```

Replace with:

```typescript
export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  previewUrl: z.string().url(),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
```

### Step 2: Run typecheck to verify schema

- [ ] **Verify TypeScript compilation**

Run: `bun run typecheck --filter translator`

Expected: Errors (FreeRoomConfig type now requires previewUrl, but store doesn't provide it yet)

This is expected - we'll fix it in the next task.

### Step 3: Commit schema change

- [ ] **Commit schema update**

```bash
git add packages/translator/src/types/free-room-config.ts
git commit -m "feat(translator): add previewUrl field to FreeRoomConfigSchema

Add required previewUrl field to schema:
- Type: z.string().url() (required)
- Position: after context, before protectedKeywords
- Purpose: Store computed Kagi Translate preview URL

Schema validation will now require previewUrl in all rooms.
Next step: Update store to compute this field on create/update.
"
```

---

## Task 5: Compute previewUrl in FreeRoomConfigStore

**Files:**

- Modify: `packages/translator/src/services/free-room-config-store.ts`

### Step 1: Add import for buildPreviewUrl

- [ ] **Add import statement**

Modify `packages/translator/src/services/free-room-config-store.ts`:

Add to imports section (after existing imports):

```typescript
import { buildPreviewUrl } from '@chatwork-bot/provider-kagi'
```

### Step 2: Update create() method to compute previewUrl

- [ ] **Add previewUrl computation in create()**

Modify `packages/translator/src/services/free-room-config-store.ts` in the `create()` method:

Find:

```typescript
async create(params: CreateFreeRoomStoreParams): Promise<FreeRoomConfig> {
  return this.withMutex(async () => {
    if (this.roomsByOriginalId.has(params.originalRoomId)) {
      throw new FreeRoomConfigStoreError(
        `originalRoomId ${params.originalRoomId.toString()} already exists`,
        'DUPLICATE_ORIGINAL_ROOM_ID',
      )
    }

    const now = new Date().toISOString()
    const room: FreeRoomConfig = {
      id: crypto.randomUUID(),
      originalRoomId: params.originalRoomId,
      originalRoomName: params.originalRoomName,
      destinationRoomId: params.destinationRoomId,
      destinationRoomName: params.destinationRoomName,
      kagiStyle: params.kagiStyle,
      context: params.context ?? null,
      ...(params.protectedKeywords !== undefined
        ? { protectedKeywords: params.protectedKeywords }
        : {}),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
```

Replace with:

```typescript
async create(params: CreateFreeRoomStoreParams): Promise<FreeRoomConfig> {
  return this.withMutex(async () => {
    if (this.roomsByOriginalId.has(params.originalRoomId)) {
      throw new FreeRoomConfigStoreError(
        `originalRoomId ${params.originalRoomId.toString()} already exists`,
        'DUPLICATE_ORIGINAL_ROOM_ID',
      )
    }

    const now = new Date().toISOString()
    const previewUrl = buildPreviewUrl(params.kagiStyle, params.context)

    const room: FreeRoomConfig = {
      id: crypto.randomUUID(),
      originalRoomId: params.originalRoomId,
      originalRoomName: params.originalRoomName,
      destinationRoomId: params.destinationRoomId,
      destinationRoomName: params.destinationRoomName,
      kagiStyle: params.kagiStyle,
      context: params.context ?? null,
      previewUrl,
      ...(params.protectedKeywords !== undefined
        ? { protectedKeywords: params.protectedKeywords }
        : {}),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
```

### Step 3: Update update() method to recompute previewUrl

- [ ] **Add previewUrl recomputation in update()**

Modify `packages/translator/src/services/free-room-config-store.ts` in the `update()` method:

Find:

```typescript
async update(id: string, patch: UpdateFreeRoomRequest): Promise<FreeRoomConfig> {
  return this.withMutex(async () => {
    const existing = this.roomsById.get(id)
    if (existing === undefined) {
      throw new FreeRoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
    }

    const updated: FreeRoomConfig = {
      ...existing,
      ...(patch.destinationRoomName !== undefined
        ? { destinationRoomName: patch.destinationRoomName }
        : {}),
      ...(patch.kagiStyle !== undefined ? { kagiStyle: patch.kagiStyle } : {}),
      ...(patch.context !== undefined ? { context: patch.context } : {}),
      ...(patch.protectedKeywords !== undefined
        ? { protectedKeywords: patch.protectedKeywords }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
```

Replace with:

```typescript
async update(id: string, patch: UpdateFreeRoomRequest): Promise<FreeRoomConfig> {
  return this.withMutex(async () => {
    const existing = this.roomsById.get(id)
    if (existing === undefined) {
      throw new FreeRoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
    }

    const updated: FreeRoomConfig = {
      ...existing,
      ...(patch.destinationRoomName !== undefined
        ? { destinationRoomName: patch.destinationRoomName }
        : {}),
      ...(patch.kagiStyle !== undefined ? { kagiStyle: patch.kagiStyle } : {}),
      ...(patch.context !== undefined ? { context: patch.context } : {}),
      ...(patch.protectedKeywords !== undefined
        ? { protectedKeywords: patch.protectedKeywords }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    const previewUrl = buildPreviewUrl(updated.kagiStyle, updated.context)
    updated.previewUrl = previewUrl

    const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
```

### Step 4: Run typecheck to verify implementation

- [ ] **Verify TypeScript compilation**

Run: `bun run typecheck --filter translator`

Expected: No errors (previewUrl now provided in both create and update)

### Step 5: Commit store implementation

- [ ] **Commit changes**

```bash
git add packages/translator/src/services/free-room-config-store.ts
git commit -m "feat(translator): compute previewUrl in FreeRoomConfigStore

Add previewUrl computation in create() and update() methods:
- Import buildPreviewUrl from @chatwork-bot/provider-kagi
- In create(): Compute previewUrl from params.kagiStyle + params.context
- In update(): Recompute previewUrl from merged updated.kagiStyle + updated.context
- previewUrl always reflects current kagiStyle and context settings

All rooms created/updated via API now include previewUrl field.
"
```

---

## Task 6: Add Tests for previewUrl in Store

**Files:**

- Modify: `packages/translator/src/services/free-room-config-store.test.ts`

### Step 1: Add test for create() with previewUrl

- [ ] **Add create test case**

Modify `packages/translator/src/services/free-room-config-store.test.ts`:

Add test case in the `create` describe block:

```typescript
it('should include previewUrl in created room', async () => {
  const room = await store.create({
    originalRoomId: 999,
    originalRoomName: 'Test Room',
    destinationRoomId: 888,
    destinationRoomName: 'Test Room VN',
    kagiStyle: 'Wild',
    context: 'software',
  })

  expect(room.previewUrl).toBeDefined()
  expect(room.previewUrl).toMatch(/^https:\/\/translate\.kagi\.com\//)
  expect(room.previewUrl).toContain('text=hello')
  expect(room.previewUrl).toContain('context=software')
  expect(room.previewUrl).toContain('formality=less')
  expect(room.previewUrl).toContain('formality_context=vi_casual')
})
```

### Step 2: Add test for create() without context

- [ ] **Add create without context test**

Add another test case:

```typescript
it('should create previewUrl without context when null', async () => {
  const room = await store.create({
    originalRoomId: 888,
    originalRoomName: 'Test Room 2',
    destinationRoomId: 777,
    destinationRoomName: 'Test Room 2 VN',
    kagiStyle: 'Clear',
    context: null,
  })

  expect(room.previewUrl).toBeDefined()
  expect(room.previewUrl).toMatch(/^https:\/\/translate\.kagi\.com\//)
  expect(room.previewUrl).not.toContain('context=')
})
```

### Step 3: Run tests to verify create tests pass

- [ ] **Execute test suite**

Run: `bun test --filter translator -- free-room-config-store`

Expected: New tests PASS

### Step 4: Add test for update() with kagiStyle change

- [ ] **Add update kagiStyle test**

Add test case in the `update` describe block:

```typescript
it('should recompute previewUrl when kagiStyle changes', async () => {
  const created = await store.create({
    originalRoomId: 777,
    originalRoomName: 'Test Room 3',
    destinationRoomId: 666,
    destinationRoomName: 'Test Room 3 VN',
    kagiStyle: 'Wild',
    context: 'software',
  })

  const originalPreviewUrl = created.previewUrl

  const updated = await store.update(created.id, {
    kagiStyle: 'Clear',
  })

  expect(updated.previewUrl).toBeDefined()
  expect(updated.previewUrl).not.toBe(originalPreviewUrl)
  expect(updated.previewUrl).toContain('text=hello')
  expect(updated.previewUrl).not.toContain('formality=')
})
```

### Step 5: Add test for update() with context change

- [ ] **Add update context test**

Add another test case:

```typescript
it('should recompute previewUrl when context changes', async () => {
  const created = await store.create({
    originalRoomId: 666,
    originalRoomName: 'Test Room 4',
    destinationRoomId: 555,
    destinationRoomName: 'Test Room 4 VN',
    kagiStyle: 'Wild',
    context: 'software',
  })

  const updated = await store.update(created.id, {
    context: 'testing',
  })

  expect(updated.previewUrl).toBeDefined()
  expect(updated.previewUrl).not.toBe(created.previewUrl)
  expect(updated.previewUrl).toContain('context=testing')
  expect(updated.previewUrl).not.toContain('context=software')
})
```

### Step 6: Add test for update() keeping previewUrl consistent

- [ ] **Add consistency test**

Add final test case:

```typescript
it('should keep previewUrl consistent when style/context unchanged', async () => {
  const created = await store.create({
    originalRoomId: 555,
    originalRoomName: 'Test Room 5',
    destinationRoomId: 444,
    destinationRoomName: 'Test Room 5 VN',
    kagiStyle: 'Wild',
    context: 'software',
  })

  const updated = await store.update(created.id, {
    destinationRoomName: 'New Name VN',
  })

  expect(updated.previewUrl).toBe(created.previewUrl)
})
```

### Step 7: Run all tests to verify

- [ ] **Execute full test suite**

Run: `bun test --filter translator`

Expected: All tests PASS (including new previewUrl tests)

### Step 8: Commit test additions

- [ ] **Commit test changes**

```bash
git add packages/translator/src/services/free-room-config-store.test.ts
git commit -m "test(translator): add tests for previewUrl in FreeRoomConfigStore

Add comprehensive test coverage for previewUrl field:
- create() includes previewUrl with context
- create() includes previewUrl without context (null)
- update() recomputes when kagiStyle changes
- update() recomputes when context changes
- update() keeps previewUrl consistent when style/context unchanged

All tests verify URL format and parameter presence/absence.
"
```

---

## Task 7: Full Integration Verification

**Files:**

- None (verification only)

### Step 1: Run full test suite

- [ ] **Execute all tests**

Run: `bun test`

Expected: All tests PASS across all packages

### Step 2: Run typecheck on entire monorepo

- [ ] **Verify all TypeScript**

Run: `bun run typecheck`

Expected: No errors in any package

### Step 3: Run linter

- [ ] **Verify code style**

Run: `bun run lint`

Expected: No linting errors

### Step 4: Verify no url-builder duplication

- [ ] **Check for duplicated code**

Run: `grep -r "buildKagiUrl" packages/kagi-sidecar/src/ | grep -v "from '@chatwork-bot/provider-kagi'"`

Expected: No matches (all references are imports)

### Step 5: Manual functional test - Create room

- [ ] **Test create room API**

Run:

```bash
# Start translator server in background (if not running)
# cd packages/translator && bun run dev &

# Wait for server to start
sleep 2

# Create test room
curl -X POST http://localhost:3000/api/free-rooms \
  -H "Content-Type: application/json" \
  -d '{
    "originalRoomId": 123456,
    "originalRoomName": "Test JP Room",
    "destinationRoomName": "Test VN Room",
    "kagiStyle": "Wild",
    "context": "software team"
  }'
```

Expected: Response contains `previewUrl` field with full Kagi URL

### Step 6: Verify JSON file contains previewUrl

- [ ] **Check persisted data**

Run: `cat data/free-room-configs.json | jq '.rooms[0].previewUrl'`

Expected: Full URL string like `"https://translate.kagi.com/?from=auto&to=vi&text=hello&...&context=software+team"`

### Step 7: Manual functional test - Update room

- [ ] **Test update room API**

Run:

```bash
# Get room ID from previous create
ROOM_ID=$(cat data/free-room-configs.json | jq -r '.rooms[0].id')

# Update kagiStyle
curl -X PUT "http://localhost:3000/api/free-rooms/$ROOM_ID" \
  -H "Content-Type: application/json" \
  -d '{"kagiStyle": "Clear"}'
```

Expected: Response shows updated `previewUrl` without formality params

### Step 8: Verify URL works in browser

- [ ] **Manual browser test**

Run:

```bash
# Get previewUrl
PREVIEW_URL=$(cat data/free-room-configs.json | jq -r '.rooms[0].previewUrl')

# Replace "hello" with test text
TEST_URL=$(echo "$PREVIEW_URL" | sed 's/text=hello/text=これはテストです/')

# Print URL to copy
echo "Open this URL in browser:"
echo "$TEST_URL"
```

Expected: Copy URL, paste into browser, see Kagi Translate page with Vietnamese translation

### Step 9: Create final verification commit

- [ ] **Document verification**

```bash
git commit --allow-empty -m "verify(repo): confirm previewUrl feature fully functional

Verification completed:
- ✅ All tests pass (bun test)
- ✅ All types valid (bun typecheck)
- ✅ No lint errors (bun lint)
- ✅ No url-builder duplication (grep check)
- ✅ API creates rooms with previewUrl
- ✅ API updates recompute previewUrl
- ✅ JSON file persists previewUrl
- ✅ Preview URLs work in browser

Feature complete and ready for deployment.
"
```

---

## Task 8: Final Commit and Summary

**Files:**

- None (summary only)

### Step 1: Review git log

- [ ] **Check commit history**

Run: `git log --oneline --graph -10`

Expected: See all 8+ commits from this implementation

### Step 2: Create summary of changes

- [ ] **Document summary**

Summary of implementation:

**Files Created:**

- `packages/provider-kagi/src/url-builder.ts` (main implementation)
- `packages/provider-kagi/src/url-builder.test.ts` (test suite)
- `docs/superpowers/plans/2026-04-09-preview-url-free-room-config.md` (this plan)

**Files Modified:**

- `packages/provider-kagi/src/index.ts` (export url-builder)
- `packages/kagi-sidecar/package.json` (add provider-kagi dependency)
- `packages/kagi-sidecar/src/browser-service.ts` (update import)
- `packages/kagi-sidecar/src/server.ts` (update import)
- `packages/kagi-sidecar/src/index.ts` (remove url-builder export)
- `packages/kagi-sidecar/src/browser-service.test.ts` (update import)
- `packages/translator/src/types/free-room-config.ts` (add previewUrl field)
- `packages/translator/src/services/free-room-config-store.ts` (compute previewUrl)
- `packages/translator/src/services/free-room-config-store.test.ts` (add tests)

**Files Deleted:**

- `packages/kagi-sidecar/src/url-builder.ts` (~183 lines)
- `packages/kagi-sidecar/src/url-builder.test.ts` (~100 lines)

**Net Change:** -200 lines (removed duplication), +300 lines (tests + implementation)

### Step 3: Tag implementation complete

- [ ] **Mark completion**

Run:

```bash
git tag -a v1.0.0-preview-url-feature -m "Feature: Add previewUrl to free room configs

- Consolidate buildKagiUrl to provider-kagi (single source of truth)
- Add computed previewUrl field to FreeRoomConfigSchema
- Compute preview URLs on create/update with kagiStyle + context
- Comprehensive test coverage (provider-kagi, translator, kagi-sidecar)
- Zero duplication, backward compatible

Design doc: docs/superpowers/specs/2026-04-09-preview-url-free-room-config-design.md
Plan: docs/superpowers/plans/2026-04-09-preview-url-free-room-config.md
"
```

### Step 4: Final verification command

- [ ] **Run complete validation**

Run: `bun test && bun run typecheck && bun run lint`

Expected: All checks PASS

### Step 5: Done!

✅ **Implementation complete!**

**Feature delivered:**

- ✅ Single source of truth for Kagi URL building (provider-kagi)
- ✅ Computed previewUrl field in all free rooms
- ✅ Preview URLs match actual kagi-sidecar browser automation URLs
- ✅ Comprehensive test coverage (unit + integration)
- ✅ Zero code duplication (~183 lines removed)
- ✅ Type-safe, validated schema
- ✅ Documented with design doc and implementation plan

**Next steps for user:**

1. Open `data/free-room-configs.json`
2. Copy `previewUrl` from any room
3. Replace `hello` with actual text to translate
4. Paste into browser to verify translation style

---

**End of Implementation Plan**
