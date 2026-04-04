# Room Description Feature - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Neubrutalism-styled descriptions to translation destination rooms with manual input of original room name

**Architecture:**

- Add `originalRoomName` field to dashboard forms (Standard & Free)
- Create Unicode bold text utility function
- Compose description when creating Chatwork rooms
- Store `originalRoomName` in JSON config files

**Tech Stack:**

- Frontend: React, React Hook Form, Zod validation
- Backend: Bun, TypeScript, Chatwork API
- Testing: Bun test

---

## Task 1: Create Unicode Bold Utility Function

**Files:**

- Create: `packages/chatwork/src/services/compose-room-description.ts`
- Create: `packages/chatwork/src/services/compose-room-description.test.ts`

- [ ] **Step 1: Write failing test for basic description composition**

```typescript
// packages/chatwork/src/services/compose-room-description.test.ts
import { describe, it, expect } from 'bun:test'
import { composeRoomDescription } from './compose-room-description'

describe('composeRoomDescription', () => {
  it('generates correct Neubrutalism format with ASCII room name', () => {
    const result = composeRoomDescription('JP Project Demo')

    expect(result).toContain('🌐')
    expect(result).toContain('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌')
    expect(result).toContain('📍')
    expect(result).toContain('𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥')
    expect(result).toContain('JP Project Demo')
    expect(result).toContain('╔═')
    expect(result).toContain('╚═')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/chatwork/src/services/compose-room-description.test.ts`  
Expected: FAIL with "Cannot find module './compose-room-description'"

- [ ] **Step 3: Implement minimal description composition**

```typescript
// packages/chatwork/src/services/compose-room-description.ts

/**
 * Converts ASCII text to Unicode Math Bold characters (U+1D400-U+1D433).
 * Matches the style used in "Created"/"Updated" indicators.
 */
function convertToUnicodeBold(text: string): string {
  const boldMap: Record<string, string> = {
    A: '𝐀',
    B: '𝐁',
    C: '𝐂',
    D: '𝐃',
    E: '𝐄',
    F: '𝐅',
    G: '𝐆',
    H: '𝐇',
    I: '𝐈',
    J: '𝐉',
    K: '𝐊',
    L: '𝐋',
    M: '𝐌',
    N: '𝐍',
    O: '𝐎',
    P: '𝐏',
    Q: '𝐐',
    R: '𝐑',
    S: '𝐒',
    T: '𝐓',
    U: '𝐔',
    V: '𝐕',
    W: '𝐖',
    X: '𝐗',
    Y: '𝐘',
    Z: '𝐙',
    a: '𝐚',
    b: '𝐛',
    c: '𝐜',
    d: '𝐝',
    e: '𝐞',
    f: '𝐟',
    g: '𝐠',
    h: '𝐡',
    i: '𝐢',
    j: '𝐣',
    k: '𝐤',
    l: '𝐥',
    m: '𝐦',
    n: '𝐧',
    o: '𝐨',
    p: '𝐩',
    q: '𝐪',
    r: '𝐫',
    s: '𝐬',
    t: '𝐭',
    u: '𝐮',
    v: '𝐯',
    w: '𝐰',
    x: '𝐱',
    y: '𝐲',
    z: '𝐳',
  }

  return text
    .split('')
    .map((char) => boldMap[char] ?? char)
    .join('')
}

/**
 * Composes the Neubrutalism-styled room description for translation rooms.
 */
export function composeRoomDescription(originalRoomName: string): string {
  const title = convertToUnicodeBold('TRANSLATION ROOM')
  const label = convertToUnicodeBold('Original')

  return `╔════════════════════════════════════╗
║  🌐 ${title} 🌐  ║
╚════════════════════════════════════╝

📍 ${label}: ${originalRoomName}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/chatwork/src/services/compose-room-description.test.ts`  
Expected: PASS

- [ ] **Step 5: Add test for Unicode characters in room name**

```typescript
it('handles Unicode characters in room name', () => {
  const result = composeRoomDescription('プロジェクト Demo')

  expect(result).toContain('プロジェクト Demo')
  expect(result).toContain('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌')
})
```

- [ ] **Step 6: Run test to verify it passes** (no code changes needed)

Run: `bun test packages/chatwork/src/services/compose-room-description.test.ts`  
Expected: PASS

- [ ] **Step 7: Add test for emoji in room name**

```typescript
it('handles emoji in room name', () => {
  const result = composeRoomDescription('Project 🚀 Demo')

  expect(result).toContain('Project 🚀 Demo')
})
```

- [ ] **Step 8: Run test to verify it passes** (no code changes needed)

Run: `bun test packages/chatwork/src/services/compose-room-description.test.ts`  
Expected: PASS

- [ ] **Step 9: Export function from package index**

```typescript
// packages/chatwork/src/index.ts
// Add to existing exports:
export { composeRoomDescription } from '~/services/compose-room-description'
```

- [ ] **Step 10: Run typecheck to verify exports**

Run: `bun run typecheck --filter @chatwork-bot/chatwork`  
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add packages/chatwork/src/services/compose-room-description.ts
git add packages/chatwork/src/services/compose-room-description.test.ts
git add packages/chatwork/src/index.ts
git commit -m "feat(chatwork): add Unicode bold description composer for translation rooms"
```

---

## Task 2: Update Standard Room Schema

**Files:**

- Modify: `packages/dashboard/src/lib/room-schema.ts`
- Modify: `packages/dashboard/src/lib/room-schema.test.ts`

- [ ] **Step 1: Write failing test for originalRoomName validation**

```typescript
// packages/dashboard/src/lib/room-schema.test.ts
// Add to existing test suite:

it('requires originalRoomName', () => {
  const result = roomCreateSchema.safeParse({
    originalRoomId: 123456,
    // originalRoomName: missing
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  })

  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues[0].message).toContain('required')
  }
})

it('trims originalRoomName whitespace', () => {
  const result = roomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: '  JP Project Demo  ',
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  })

  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.originalRoomName).toBe('JP Project Demo')
  }
})

it('rejects empty originalRoomName', () => {
  const result = roomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: '',
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  })

  expect(result.success).toBe(false)
})

it('rejects originalRoomName longer than 100 chars', () => {
  const result = roomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: 'A'.repeat(101),
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  })

  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues[0].message).toContain('100')
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/lib/room-schema.test.ts`  
Expected: FAIL (tests for originalRoomName)

- [ ] **Step 3: Add originalRoomName to schema**

```typescript
// packages/dashboard/src/lib/room-schema.ts
export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),

  // NEW FIELD
  originalRoomName: z
    .string({ required_error: 'Original room name is required' })
    .min(1, 'Original room name is required')
    .max(100, 'Max 100 characters')
    .trim(),

  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),

  // ... rest of schema
})

// Also add to type
export type RoomCreateInput = z.infer<typeof roomCreateSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/lib/room-schema.test.ts`  
Expected: PASS

- [ ] **Step 5: Update api-types.ts interface**

```typescript
// packages/dashboard/src/lib/api-types.ts
export interface CreateRoomInput {
  originalRoomId: number
  originalRoomName: string // NEW
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  context?: string | null
  protectedKeywords?: ProtectedKeyword[]
}

export interface RoomConfigPublic {
  id: string
  originalRoomId: number
  originalRoomName: string // NEW
  destinationRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  context: string | null
  protectedKeywords?: ProtectedKeyword[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 6: Run typecheck**

Run: `bun run typecheck --filter @chatwork-bot/dashboard`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/lib/room-schema.ts
git add packages/dashboard/src/lib/room-schema.test.ts
git add packages/dashboard/src/lib/api-types.ts
git commit -m "feat(dashboard): add originalRoomName to Standard room schema"
```

---

## Task 3: Update Standard Room Create Form

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-create.test.tsx`

- [ ] **Step 1: Write test for form with originalRoomName field**

```typescript
// packages/dashboard/src/pages/room-create.test.ts
// Add to existing test suite:

it('renders originalRoomName input field', () => {
  render(<RoomCreatePage />, { wrapper: BrowserRouter })

  const originalRoomNameInput = screen.getByLabelText(/Original Room Name/i)
  expect(originalRoomNameInput).toBeInTheDocument()
  expect(originalRoomNameInput).toHaveAttribute('type', 'text')
})

it('shows validation error when originalRoomName is empty', async () => {
  const user = userEvent.setup()
  render(<RoomCreatePage />, { wrapper: BrowserRouter })

  // Fill other required fields but skip originalRoomName
  await user.type(screen.getByLabelText(/Original Room ID/i), '123456')
  await user.type(screen.getByLabelText(/Destination Room Name/i), 'Test Room')
  // ... fill other fields

  const submitButton = screen.getByRole('button', { name: /Create Room/i })
  await user.click(submitButton)

  await waitFor(() => {
    expect(screen.getByText(/Original room name is required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Add originalRoomName field to form**

```typescript
// packages/dashboard/src/pages/room-create.tsx
// Update defaultValues:
defaultValues: {
  ...(prefillRoomId !== undefined ? { originalRoomId: Number(prefillRoomId) } : {}),
  originalRoomName: '', // NEW
  aiProvider: 'openai',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  // ... rest
}

// Update form layout (in the grid):
<div className="grid gap-5 md:grid-cols-2">
  <div id="tour-field-roomid">
    <BrutalInput
      label="Original Room ID"
      type="text"
      inputMode="numeric"
      hint="The numeric ID of the source Chatwork room."
      error={errors.originalRoomId?.message}
      {...register('originalRoomId', {
        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
      })}
    />
  </div>

  {/* NEW FIELD */}
  <div id="tour-field-roomname-orig">
    <BrutalInput
      label="Original Room Name"
      type="text"
      hint="The name of the source Chatwork room (for description)."
      placeholder="e.g., JP Project Demo"
      error={errors.originalRoomName?.message}
      {...register('originalRoomName')}
    />
  </div>

  {/* Destination Room Name moves to next row */}
</div>

{/* Destination Room Name in separate row */}
<div>
  <div id="tour-field-roomname">
    <BrutalInput
      label="Destination Room Name"
      type="text"
      hint="Internal name for the translated output room."
      error={errors.destinationRoomName?.message}
      {...register('destinationRoomName')}
    />
  </div>
</div>

<div className="grid gap-5 md:grid-cols-2">
  {/* Provider, Model, Style, Token fields */}
</div>
```

- [ ] **Step 4: Update onSubmit handler to include originalRoomName**

```typescript
// In onSubmit function, update keywordData object:
const keywordData: {
  originalRoomId: number
  originalRoomName: string // NEW
  destinationRoomName: string
  aiProvider: 'openai' | 'gemini'
  aiModel: string | null
  translationStyle: 'NATURAL_CASUAL' | 'PROFESSIONAL_BUSINESS' | 'TECHNICAL'
  aiApiToken: string
  context: string | null
  protectedKeywords?: ProtectedKeyword[]
} = {
  originalRoomId: data.originalRoomId,
  originalRoomName: data.originalRoomName, // NEW
  destinationRoomName: data.destinationRoomName,
  aiProvider: data.aiProvider,
  aiModel: data.aiModel,
  translationStyle: data.translationStyle,
  aiApiToken: data.aiApiToken,
  context: data.context.trim() || null,
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx`  
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `bun run typecheck --filter @chatwork-bot/dashboard`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/pages/room-create.tsx
git add packages/dashboard/src/pages/room-create.test.tsx
git commit -m "feat(dashboard): add originalRoomName field to Standard room create form"
```

---

## Task 4: Update Free Room Schema

**Files:**

- Modify: `packages/dashboard/src/lib/free-room-schemas.ts`
- Modify: `packages/dashboard/src/lib/free-room-schemas.test.ts`

- [ ] **Step 1: Write failing test for Free room originalRoomName**

```typescript
// packages/dashboard/src/lib/free-room-schemas.test.ts
// Add similar tests as Standard room schema

it('requires originalRoomName', () => {
  const result = freeRoomCreateSchema.safeParse({
    originalRoomId: 123456,
    // originalRoomName: missing
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  })

  expect(result.success).toBe(false)
})

it('trims originalRoomName', () => {
  const result = freeRoomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: '  Free Demo  ',
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  })

  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.originalRoomName).toBe('Free Demo')
  }
})

it('rejects empty originalRoomName', () => {
  const result = freeRoomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: '',
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  })

  expect(result.success).toBe(false)
})

it('rejects originalRoomName longer than 100 chars', () => {
  const result = freeRoomCreateSchema.safeParse({
    originalRoomId: 123456,
    originalRoomName: 'B'.repeat(101),
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  })

  expect(result.success).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/lib/free-room-schemas.test.ts`  
Expected: FAIL

- [ ] **Step 3: Add originalRoomName to Free room schema**

```typescript
// packages/dashboard/src/lib/free-room-schemas.ts
export const freeRoomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),

  // NEW FIELD
  originalRoomName: z
    .string({ required_error: 'Original room name is required' })
    .min(1, 'Original room name is required')
    .max(100, 'Max 100 characters')
    .trim(),

  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),

  // ... rest
})

// Update freeRoomEditSchema too
export const freeRoomEditSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),

  // NEW FIELD
  originalRoomName: z
    .string({ required_error: 'Original room name is required' })
    .min(1, 'Original room name is required')
    .max(100, 'Max 100 characters')
    .trim(),

  // ... rest
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/lib/free-room-schemas.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/lib/free-room-schemas.ts
git add packages/dashboard/src/lib/free-room-schemas.test.ts
git commit -m "feat(dashboard): add originalRoomName to Free room schema"
```

---

## Task 5: Update Free Room Create Form

**Files:**

- Modify: `packages/dashboard/src/pages/free-room-create.tsx`
- Modify: `packages/dashboard/src/pages/free-room-create.test.tsx`

- [ ] **Step 1: Write test for Free room form with originalRoomName**

```typescript
// packages/dashboard/src/pages/free-room-create.test.tsx
// Add similar tests as Standard room form

it('renders originalRoomName input field', () => {
  render(<FreeRoomCreatePage />, { wrapper: BrowserRouter })

  const originalRoomNameInput = screen.getByLabelText(/Original Room Name/i)
  expect(originalRoomNameInput).toBeInTheDocument()
})

it('shows validation error when originalRoomName is empty', async () => {
  const user = userEvent.setup()
  render(<FreeRoomCreatePage />, { wrapper: BrowserRouter })

  await user.type(screen.getByLabelText(/Original Room ID/i), '123456')
  await user.type(screen.getByLabelText(/Destination Room Name/i), 'Test')
  // Skip originalRoomName

  const submitButton = screen.getByRole('button', { name: /Create Room/i })
  await user.click(submitButton)

  await waitFor(() => {
    expect(screen.getByText(/Original room name is required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/free-room-create.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Add originalRoomName field to Free room form**

```typescript
// packages/dashboard/src/pages/free-room-create.tsx
// Update defaultValues:
defaultValues: {
  ...(prefillRoomId !== undefined ? { originalRoomId: Number(prefillRoomId) } : {}),
  originalRoomName: '', // NEW
  destinationRoomName: '',
  kagiStyle: 'Clear',
  // ... rest
}

// Update form layout (same pattern as Standard room form):
<div className="grid gap-5 md:grid-cols-2">
  <div>
    <BrutalInput
      label="Original Room ID"
      type="text"
      inputMode="numeric"
      hint="The numeric ID of the source Chatwork room."
      error={errors.originalRoomId?.message}
      {...register('originalRoomId', {
        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
      })}
    />
  </div>

  {/* NEW FIELD */}
  <div>
    <BrutalInput
      label="Original Room Name"
      type="text"
      hint="The name of the source Chatwork room (for description)."
      placeholder="e.g., JP Project Demo"
      error={errors.originalRoomName?.message}
      {...register('originalRoomName')}
    />
  </div>
</div>

<div>
  <BrutalInput
    label="Destination Room Name"
    type="text"
    hint="Internal name for the translated output room."
    error={errors.destinationRoomName?.message}
    {...register('destinationRoomName')}
  />
</div>

{/* Other fields... */}
```

- [ ] **Step 4: Update onSubmit to include originalRoomName**

```typescript
// In onSubmit:
return createRoom({
  originalRoomId: data.originalRoomId,
  originalRoomName: data.originalRoomName, // NEW
  destinationRoomName: data.destinationRoomName,
  kagiStyle: data.kagiStyle,
  context: data.context.trim() || null,
  protectedKeywords: data.protectedKeywords.length > 0 ? data.protectedKeywords : undefined,
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/dashboard/src/pages/free-room-create.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/pages/free-room-create.tsx
git add packages/dashboard/src/pages/free-room-create.test.tsx
git commit -m "feat(dashboard): add originalRoomName field to Free room create form"
```

---

## Task 6: Update Backend Type Definitions

**Files:**

- Modify: `packages/translator/src/types/room-config.ts`
- Modify: `packages/translator/src/types/free-room-config.ts`

- [ ] **Step 1: Update Standard room config types**

```typescript
// packages/translator/src/types/room-config.ts
import { z } from 'zod'

export const RoomConfigSchema = z.object({
  id: z.string().uuid(),
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1), // NEW
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  aiProvider: z.enum(['openai', 'gemini']),
  // ... rest
})

export type RoomConfig = z.infer<typeof RoomConfigSchema>

export const CreateRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1).max(100), // NEW
  destinationRoomName: z.string().min(1).max(128),
  aiProvider: z.enum(['openai', 'gemini']),
  // ... rest
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>
```

- [ ] **Step 2: Update Free room config types**

```typescript
// packages/translator/src/types/free-room-config.ts
export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1), // NEW
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  // ... rest
})

export const CreateFreeRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1).max(100), // NEW
  destinationRoomName: z.string().min(1).max(128),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  // ... rest
})
```

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck --filter @chatwork-bot/translator`  
Expected: PASS (may show errors in routes, will fix in next task)

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/types/room-config.ts
git add packages/translator/src/types/free-room-config.ts
git commit -m "feat(translator): add originalRoomName to room config types"
```

---

## Task 7: Update Standard Room Backend Route

**Files:**

- Modify: `packages/translator/src/routes/rooms.ts`
- Modify: `packages/translator/src/routes/rooms.test.ts`

- [ ] **Step 1: Write failing test for room creation with description**

```typescript
// packages/translator/src/routes/rooms.test.ts
// Add test for description parameter

it('creates Chatwork room with description containing original room name', async () => {
  const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: 999888 })
  vi.mocked(chatworkCreateRoom).mockImplementation(mockCreateRoom)

  const payload = {
    originalRoomId: 123456,
    originalRoomName: 'JP Project Demo', // NEW
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  }

  const response = await request(app).post('/api/rooms').send(payload).expect(201)

  expect(mockCreateRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Translation Room',
      description: expect.stringContaining('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌'),
    }),
    expect.any(String),
  )

  expect(mockCreateRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      description: expect.stringContaining('JP Project Demo'),
    }),
    expect.any(String),
  )
})

it('rejects creation without originalRoomName', async () => {
  const payload = {
    originalRoomId: 123456,
    // originalRoomName: missing
    destinationRoomName: 'Translation Room',
    aiProvider: 'openai',
    aiModel: 'gpt-5.4',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-test',
  }

  const response = await request(app).post('/api/rooms').send(payload).expect(400)

  expect(response.body.error).toContain('required')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/translator/src/routes/rooms.test.ts`  
Expected: FAIL

- [ ] **Step 3: Import composeRoomDescription utility**

```typescript
// packages/translator/src/routes/rooms.ts
import { composeRoomDescription } from '@chatwork-bot/chatwork'
```

- [ ] **Step 4: Update room creation handler to compose description**

```typescript
// In POST /api/rooms handler:
const validatedData = CreateRoomRequestSchema.parse(await request.json())

// NEW: Compose description
const description = composeRoomDescription(validatedData.originalRoomName)

// Create Chatwork room with description
const createdRoom = await createRoom(
  {
    name: validatedData.destinationRoomName,
    members_admin_ids: String(chatworkMe.account_id),
    description, // NEW
    icon_preset: 'group',
  },
  env.CHATWORK_API_TOKEN,
)

// Save to config with originalRoomName
const roomConfig: RoomConfig = {
  id: crypto.randomUUID(),
  originalRoomId: validatedData.originalRoomId,
  originalRoomName: validatedData.originalRoomName, // NEW
  destinationRoomId: createdRoom.room_id,
  destinationRoomName: validatedData.destinationRoomName,
  // ... rest
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test packages/translator/src/routes/rooms.test.ts`  
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `bun run typecheck --filter @chatwork-bot/translator`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/translator/src/routes/rooms.ts
git add packages/translator/src/routes/rooms.test.ts
git commit -m "feat(translator): compose and set room description on Standard room creation"
```

---

## Task 8: Update Free Room Backend Route

**Files:**

- Modify: `packages/translator/src/routes/free-rooms.ts`
- Modify: `packages/translator/src/routes/free-rooms.test.ts`

- [ ] **Step 1: Write failing test for Free room creation with description**

```typescript
// packages/translator/src/routes/free-rooms.test.ts
// Add similar test as Standard rooms

it('creates Chatwork room with description containing original room name', async () => {
  const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: 888777 })
  vi.mocked(chatworkCreateRoom).mockImplementation(mockCreateRoom)

  const payload = {
    originalRoomId: 654321,
    originalRoomName: 'Free Demo Room', // NEW
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  }

  const response = await request(app).post('/api/free-rooms').send(payload).expect(201)

  expect(mockCreateRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      description: expect.stringContaining('𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌'),
    }),
    expect.any(String),
  )

  expect(mockCreateRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      description: expect.stringContaining('Free Demo Room'),
    }),
    expect.any(String),
  )
})

it('rejects creation without originalRoomName', async () => {
  const payload = {
    originalRoomId: 654321,
    // originalRoomName: missing
    destinationRoomName: 'Free Translation',
    kagiStyle: 'Clear',
  }

  const response = await request(app).post('/api/free-rooms').send(payload).expect(400)

  expect(response.body.error).toContain('required')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/translator/src/routes/free-rooms.test.ts`  
Expected: FAIL

- [ ] **Step 3: Import composeRoomDescription and update handler**

```typescript
// packages/translator/src/routes/free-rooms.ts
import { composeRoomDescription } from '@chatwork-bot/chatwork'

// In POST /api/free-rooms handler:
const validatedData = CreateFreeRoomRequestSchema.parse(await request.json())

// NEW: Compose description
const description = composeRoomDescription(validatedData.originalRoomName)

// Create Chatwork room with description
const createdRoom = await createRoom(
  {
    name: validatedData.destinationRoomName,
    members_admin_ids: String(chatworkMe.account_id),
    description, // NEW
    icon_preset: 'group',
  },
  env.CHATWORK_API_TOKEN,
)

// Save with originalRoomName
const roomConfig: FreeRoomConfig = {
  id: crypto.randomUUID(),
  originalRoomId: validatedData.originalRoomId,
  originalRoomName: validatedData.originalRoomName, // NEW
  destinationRoomId: createdRoom.room_id,
  // ... rest
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/translator/src/routes/free-rooms.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/routes/free-rooms.ts
git add packages/translator/src/routes/free-rooms.test.ts
git commit -m "feat(translator): compose and set room description on Free room creation"
```

---

## Task 9: Run Full Test Suite

**Files:** N/A (verification task)

- [ ] **Step 1: Run all unit tests**

Run: `bun test`  
Expected: All tests PASS

- [ ] **Step 2: Run typecheck across all packages**

Run: `bun run typecheck`  
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `bun run lint`  
Expected: No errors

- [ ] **Step 4: Commit test verification**

```bash
git commit --allow-empty -m "test(repo): verify all tests pass after room description feature"
```

---

## Task 10: Manual Verification & Documentation

**Files:**

- Create: `docs/verification/2026-04-03-room-description.md`

- [ ] **Step 1: Start backend server**

Run: `bun run --filter @chatwork-bot/translator dev`  
Expected: Server starts on port 3000

- [ ] **Step 2: Start dashboard**

Run: `bun run --filter @chatwork-bot/dashboard dev`  
Expected: Dashboard starts on port 5173

- [ ] **Step 3: Manual test - Create Standard room**

Manual steps:

1. Open dashboard at `http://localhost:5173`
2. Click "Create Room" for Standard
3. Fill in:
   - Original Room ID: `123456`
   - Original Room Name: `JP Project Demo` (NEW FIELD)
   - Destination Room Name: `Translation - JP Project`
   - AI Provider: OpenAI
   - AI Model: gpt-5.4
   - Translation Style: Professional Business
   - AI API Token: (valid token)
4. Click "Create Room"
5. Expected: Success toast, room created
6. Verify in Chatwork:
   - Open destination room info
   - Description should show:

     ```
     ╔════════════════════════════════════╗
     ║  🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐  ║
     ╚════════════════════════════════════╝

     📍 𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥: JP Project Demo
     ```

- [ ] **Step 4: Manual test - Create Free room**

Manual steps:

1. Click "Create Room" for Free
2. Fill in:
   - Original Room ID: `654321`
   - Original Room Name: `Free Demo Room` (NEW FIELD)
   - Destination Room Name: `Free Translation`
   - Kagi Style: Clear
3. Click "Create Room"
4. Expected: Success, description displays correctly in Chatwork

- [ ] **Step 5: Test validation**

Manual steps:

1. Try to create room WITHOUT entering Original Room Name
2. Expected: Validation error "Original room name is required"
3. Try to enter 101-character name
4. Expected: Validation error "Max 100 characters"

- [ ] **Step 6: Test Unicode characters**

Manual steps:

1. Create room with Japanese room name: `プロジェクト Demo`
2. Expected: Description displays correctly with Japanese characters
3. Create room with emoji: `Project 🚀 Demo`
4. Expected: Emoji displays correctly

- [ ] **Step 7: Cross-platform verification**

Manual steps (if possible):

- [ ] Check description on Chatwork Desktop app
- [ ] Check description on Chatwork Mobile app (iOS/Android)
- [ ] Check description on Chatwork Web app
- [ ] Verify Unicode bold renders correctly on all platforms

- [ ] **Step 8: Document verification results**

Create verification document:

```markdown
# Room Description Feature - Manual Verification

**Date:** 2026-04-03  
**Tester:** [Your name]  
**Environment:** Local development

## Test Results

### Standard Room Creation

- [x] Field renders in form
- [x] Validation works (required, max length)
- [x] Description created correctly
- [x] Unicode bold displays in Chatwork
- [x] Original room name appears correctly

### Free Room Creation

- [x] Field renders in form
- [x] Validation works
- [x] Description created correctly
- [x] Displays correctly in Chatwork

### Edge Cases

- [x] Japanese characters (プロジェクト Demo)
- [x] Emoji (Project 🚀 Demo)
- [x] Long room names (99 chars)

### Cross-Platform

- [ ] Desktop app: [PASS/FAIL/NOT TESTED]
- [ ] Mobile iOS: [PASS/FAIL/NOT TESTED]
- [ ] Mobile Android: [PASS/FAIL/NOT TESTED]
- [ ] Web app: [PASS/FAIL/NOT TESTED]

## Issues Found

[List any issues discovered]

## Sign-off

Feature verified and ready for deployment: [YES/NO]
```

- [ ] **Step 9: Commit verification doc**

```bash
git add docs/verification/2026-04-03-room-description.md
git commit -m "docs(repo): add manual verification for room description feature"
```

---

## Task 11: Completion Checklist

**Files:**

- Update: `docs/superpowers/specs/2026-04-03-room-description-feature.md`

- [ ] **Step 1: Update spec status to "Implemented"**

- [ ] **Step 2: Verify all acceptance criteria**

From spec:

- [x] User can input original room name in dashboard
- [x] Original room name field is required and validates correctly
- [x] Description is composed with Neubrutalism style and Unicode bold
- [x] Description is set when creating destination room
- [x] Works for both Standard and Free room types
- [x] Existing rooms are not affected

- [ ] **Step 3: Review implementation against plan**

Verify all tasks completed:

- [x] Task 1: Unicode bold utility
- [x] Task 2: Standard room schema
- [x] Task 3: Standard room form
- [x] Task 4: Free room schema
- [x] Task 5: Free room form
- [x] Task 6: Backend types
- [x] Task 7: Standard room route
- [x] Task 8: Free room route
- [x] Task 9: Test suite
- [x] Task 10: Manual verification
- [x] Task 11: Completion checklist

- [ ] **Step 4: Run final validation**

```bash
# All tests pass
bun test

# No type errors
bun run typecheck

# No lint errors
bun run lint

# Git status clean (all changes committed)
git status
```

Expected: All checks PASS, working directory clean

- [ ] **Step 5: Create summary commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
feat(repo): complete room description feature implementation

Summary:
- Add originalRoomName field to dashboard forms (Standard & Free)
- Create Unicode bold description composer utility
- Compose Neubrutalism-styled description on room creation
- Store originalRoomName in room configs
- Full test coverage (unit + integration)
- Manual verification complete

Closes: Room Description Feature
Spec: docs/superpowers/specs/2026-04-03-room-description-feature.md
EOF
)"
```

- [ ] **Step 6: Tag release (optional)**

```bash
git tag -a room-description-v1.0 -m "Room Description Feature v1.0"
```

---

**✅ Implementation Complete!**

All tasks completed. Feature is ready for deployment.

**Next Steps:**

1. Review PR (if applicable)
2. Deploy to production
3. Monitor for issues
4. Gather user feedback
