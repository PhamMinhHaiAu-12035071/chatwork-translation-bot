# Dashboard Phase 5: FE + BE Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all dashboard forms and pages to the real backend API, replacing all mock data and static shells with live API calls backed by Zustand state, with correct loading, skeleton, error, and success states throughout.

**Architecture:** The dashboard SPA communicates with `@chatwork-bot/translator` exclusively through a typed API client (`~/lib/api-client.ts`). The Zustand store in `~/stores/room-store.ts` is the single source of truth for UI state — components never call `fetch` directly. A Vite dev proxy forwards `/api/*` requests to `localhost:3000`, so CORS is irrelevant in development. In production the dashboard is served as static files by the translator itself, so the proxy is not needed.

**Tech Stack:** React 19, Zustand 5, React Hook Form, Zod, Framer Motion, Vite 6 proxy, bun:test

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun run dev:dashboard` + start translator on port 3000 → open `localhost:5173` → open DevTools Network tab → verify real API calls, real room data, correct loading/error/success states on all pages

---

## ⚠️ Backend API Contract (Phase 4 actual — source of truth)

The Phase 4 backend implementation differs from the original spec's 2-phase UX flow. **This plan integrates with the backend as-is.**

### Key differences from original plan:

1. **`webhookSecret` required at room creation** — Backend `POST /api/rooms` requires `webhookSecret` field (the Chatwork webhook token). There is NO separate "activate webhook" step. User must set up their Chatwork webhook FIRST, get the token, then create the room on the dashboard.
2. **No "activate" endpoint** — Backend only has `POST /api/rooms/:id/enable` and `POST /api/rooms/:id/disable`. No `activateRoom(id, webhookToken)` concept.
3. **Secrets are redacted** — `GET /api/rooms` and `GET /api/rooms/:id` return `RoomConfigPublic` which omits `encryptedAiApiToken` and `encryptedWebhookSecret`. Frontend never sees decrypted secrets.
4. **`webhookSecret` can be updated later** — `PUT /api/rooms/:id` accepts optional `webhookSecret` field. Room Detail edit form can update it.
5. **Naming: `webhookSecret`** not `webhookToken` — Backend uses `webhookSecret` consistently.
6. **`DELETE` returns 204** — No response body on successful delete.
7. **`POST /api/rooms` returns `webhookUrl`** — Response includes `{ success, data, webhookUrl }`.

### Backend API endpoints (actual):

| Endpoint                 | Method | Body                                        | Response                                          |
| ------------------------ | ------ | ------------------------------------------- | ------------------------------------------------- |
| `/api/rooms`             | GET    | —                                           | `{ success, data: RoomConfigPublic[] }`           |
| `/api/rooms/:id`         | GET    | —                                           | `{ success, data: RoomConfigPublic }`             |
| `/api/rooms`             | POST   | `CreateRoomRequest` (incl. `webhookSecret`) | `{ success, data: RoomConfigPublic, webhookUrl }` |
| `/api/rooms/:id`         | PUT    | `UpdateRoomRequest` (all optional)          | `{ success, data: RoomConfigPublic }`             |
| `/api/rooms/:id`         | DELETE | —                                           | 204 No Content                                    |
| `/api/rooms/:id/enable`  | POST   | —                                           | `{ success, data: RoomConfigPublic }`             |
| `/api/rooms/:id/disable` | POST   | —                                           | `{ success, data: RoomConfigPublic }`             |
| `/api/providers`         | GET    | —                                           | `{ success, data: ProviderInfo[] }`               |

### UX flow change:

**Old (spec):** Create room → redirect to Room Detail → paste webhook token → activate
**New (backend reality):** Read Webhook Guide → set up webhook on Chatwork → get secret → Create room (with secret) → room created as `enabled: false` → enable on Room Detail

---

## ⚠️ Current codebase state (post-Phase 3) — preserve these patterns

- **Toast system:** `~/components/ui/toast-provider.tsx` — `useToast()` hook, `toast(message, variant)` API
- **Fonts:** `.font-ui-body` (Zen Maru Gothic), `.font-metric` (Fredoka)
- **BrutalSelect:** Custom dropdown portal with `colorVariant?: 'accent' | 'mint' | 'peach'`
- **BrutalInput:** CSS classes `.brutal-input` / `.brutal-input-error`
- **StatusPill:** `children: ReactNode`, `className` prop
- **BrutalCard:** `animated?: boolean` prop
- **DeleteRoomConfirmModal:** Custom modal via `createPortal`
- **Animation components:** `PixelScatterText`, `SlideStackNumber`
- **zodResolver pattern:** `zodResolver(schema as never) as Resolver<T>`
- **Toast call:** `toast('message', 'info')` not `toast.success('message')`
- **Navigate:** `void navigate('/path')`

---

## File Map

| File                                                     | Action  | Responsibility                                                                |
| -------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `packages/dashboard/vite.config.ts`                      | Modify  | Add `/api` proxy to `localhost:3000`                                          |
| `packages/dashboard/src/lib/api-types.ts`                | Create  | `RoomConfigPublic`, `ProviderInfo`, API response types (FE mirror of backend) |
| `packages/dashboard/src/lib/api-client.ts`               | Create  | Typed fetch wrapper: CRUD + enable/disable + providers                        |
| `packages/dashboard/src/lib/room-schema.ts`              | Modify  | Add `webhookSecret` to create schema, remove `webhookActivationSchema`        |
| `packages/dashboard/src/stores/room-store.ts`            | Replace | Async Zustand store: rooms, providers, loading/error flags, API actions       |
| `packages/dashboard/src/components/ui/room-skeleton.tsx` | Create  | Brutal skeleton card for loading state                                        |
| `packages/dashboard/src/pages/room-list.tsx`             | Modify  | Wire to API, add loading/error states, preserve Phase 3 UI                    |
| `packages/dashboard/src/pages/room-create.tsx`           | Modify  | Add `webhookSecret` field, wire to `POST /api/rooms`, 409 handling            |
| `packages/dashboard/src/pages/room-detail.tsx`           | Modify  | Remove activation form, add enable/disable, wire to GET/PUT API               |
| `packages/dashboard/src/lib/api-client.test.ts`          | Create  | Unit tests for API client (bun:test)                                          |
| `packages/dashboard/src/stores/room-store.test.ts`       | Create  | Unit tests for Zustand store async actions (bun:test)                         |

**Removed from Phase 3 code (no longer needed):**

- `webhookActivationSchema` in `room-schema.ts` — no activation flow
- `activateWebhook` action in `room-store.ts` — replaced by `enableRoom`/`disableRoom`
- `Room.webhookToken` field — secrets are never returned by backend

**Already exist from Phase 3 (reuse):**

- Toast system (`toast-provider.tsx` + `brutal-toast.tsx`)
- All UI components (BrutalInput, BrutalSelect, etc.)

---

## Task 1: Add Vite dev proxy

**Files:**

- Modify: `packages/dashboard/vite.config.ts`

- [ ] **Step 1: Add proxy config to `packages/dashboard/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

**Why:** Dashboard dev server on `:5173`, translator on `:3000`. Proxy avoids CORS. In production the translator serves the SPA, so no proxy needed.

---

## Task 2: Define API types (FE mirror of backend contract)

**Files:**

- Create: `packages/dashboard/src/lib/api-types.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/api-types.ts`**

These types mirror the backend `RoomConfigPublic` and request schemas. FE defines its own types (not imported from translator) to keep packages decoupled.

```typescript
export type TranslationStyle =
  | 'AUTO_CONTEXT'
  | 'NATURAL_CASUAL'
  | 'PROFESSIONAL_BUSINESS'
  | 'TECHNICAL'

export type AiProvider = 'openai' | 'gemini'

/** Mirrors backend RoomConfigPublic — secrets are redacted (never returned) */
export interface RoomConfigPublic {
  id: string
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderInfo {
  id: string
  name: string
  models: string[]
  defaultModel: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
  webhookUrl?: string
}

export interface CreateRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  webhookSecret: string
}

export interface UpdateRoomInput {
  destinationRoomName?: string
  aiProvider?: AiProvider
  aiModel?: string | null
  translationStyle?: TranslationStyle
  aiApiToken?: string
  webhookSecret?: string
}
```

**Note:** No `ActivateRoomInput` — backend has no activation endpoint. Only enable/disable.

---

## Task 3: Build the typed API client

**Files:**

- Create: `packages/dashboard/src/lib/api-client.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/api-client.ts`**

```typescript
import type {
  ApiResponse,
  CreateRoomInput,
  ProviderInfo,
  RoomConfigPublic,
  UpdateRoomInput,
} from '~/lib/api-types'

const BASE = '/api'

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // DELETE returns 204 No Content
  if (res.status === 204) {
    return { success: true } as ApiResponse<T>
  }

  let json: ApiResponse<T>
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    throw new ApiError(`HTTP ${res.status}: non-JSON response`, res.status)
  }

  if (!res.ok) {
    throw new ApiError(json.error ?? `HTTP ${res.status}`, res.status)
  }

  return json
}

export const apiClient = {
  // Rooms
  listRooms(): Promise<ApiResponse<RoomConfigPublic[]>> {
    return request<RoomConfigPublic[]>('GET', '/rooms')
  },

  getRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('GET', `/rooms/${id}`)
  },

  createRoom(input: CreateRoomInput): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', '/rooms', input)
  },

  updateRoom(id: string, input: UpdateRoomInput): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('PUT', `/rooms/${id}`, input)
  },

  deleteRoom(id: string): Promise<ApiResponse<void>> {
    return request<void>('DELETE', `/rooms/${id}`)
  },

  enableRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', `/rooms/${id}/enable`)
  },

  disableRoom(id: string): Promise<ApiResponse<RoomConfigPublic>> {
    return request<RoomConfigPublic>('POST', `/rooms/${id}/disable`)
  },

  // Providers
  listProviders(): Promise<ApiResponse<ProviderInfo[]>> {
    return request<ProviderInfo[]>('GET', '/providers')
  },
}

export { ApiError }
```

**Key difference from old plan:** No `activateRoom` method. DELETE handles 204. Types use `RoomConfigPublic` (not `RoomConfig`).

---

## Task 4: Update frontend form schemas

**Files:**

- Modify: `packages/dashboard/src/lib/room-schema.ts`

- [ ] **Step 1: Add `webhookSecret` to create schema, remove activation schema**

```typescript
import { z } from 'zod'

export const TRANSLATION_STYLES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export const AI_PROVIDERS = ['openai', 'gemini'] as const

export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z
    .string({ required_error: 'AI API token is required' })
    .min(1, 'AI API token is required'),
  webhookSecret: z
    .string({ required_error: 'Webhook secret is required' })
    .min(1, 'Webhook secret is required'),
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

export const roomEditSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z.string().optional().default(''),
  webhookSecret: z.string().optional().default(''),
})

export type RoomEditInput = z.infer<typeof roomEditSchema>
```

**Changes:**

- `roomCreateSchema` adds required `webhookSecret`
- `roomEditSchema` now separate from create — `aiApiToken` and `webhookSecret` are optional (leave blank = keep existing)
- `webhookActivationSchema` **removed** — no activation flow
- `WebhookActivationInput` type **removed**

---

## Task 5: Replace Zustand store with async API state

**Files:**

- Replace: `packages/dashboard/src/stores/room-store.ts`

- [ ] **Step 1: Replace `packages/dashboard/src/stores/room-store.ts`**

```typescript
import { create } from 'zustand'
import { apiClient, ApiError } from '~/lib/api-client'
import type {
  CreateRoomInput,
  ProviderInfo,
  RoomConfigPublic,
  UpdateRoomInput,
} from '~/lib/api-types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface RoomStore {
  // State
  rooms: RoomConfigPublic[]
  providers: ProviderInfo[]
  listState: LoadState
  listError: string | null
  actionError: string | null

  // Actions
  fetchRooms(): Promise<void>
  fetchProviders(): Promise<void>
  createRoom(input: CreateRoomInput): Promise<RoomConfigPublic>
  updateRoom(id: string, input: UpdateRoomInput): Promise<RoomConfigPublic>
  deleteRoom(id: string): Promise<void>
  enableRoom(id: string): Promise<void>
  disableRoom(id: string): Promise<void>
  clearActionError(): void
}

export const useRoomStore = create<RoomStore>()((set) => ({
  rooms: [],
  providers: [],
  listState: 'idle',
  listError: null,
  actionError: null,

  async fetchRooms() {
    set({ listState: 'loading', listError: null })
    try {
      const res = await apiClient.listRooms()
      set({ rooms: res.data ?? [], listState: 'success' })
    } catch (err) {
      set({
        listState: 'error',
        listError: err instanceof ApiError ? err.message : 'Failed to load rooms',
      })
    }
  },

  async fetchProviders() {
    try {
      const res = await apiClient.listProviders()
      set({ providers: res.data ?? [] })
    } catch {
      // Non-fatal: falls back to empty
    }
  },

  async createRoom(input) {
    set({ actionError: null })
    const res = await apiClient.createRoom(input)
    if (!res.data) throw new Error('No data returned from createRoom')
    set((state) => ({ rooms: [...state.rooms, res.data!] }))
    return res.data
  },

  async updateRoom(id, input) {
    set({ actionError: null })
    const res = await apiClient.updateRoom(id, input)
    if (!res.data) throw new Error('No data returned from updateRoom')
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? res.data! : r)),
    }))
    return res.data
  },

  async deleteRoom(id) {
    set({ actionError: null })
    await apiClient.deleteRoom(id)
    set((state) => ({ rooms: state.rooms.filter((r) => r.id !== id) }))
  },

  async enableRoom(id) {
    set({ actionError: null })
    const res = await apiClient.enableRoom(id)
    if (!res.data) return
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? res.data! : r)),
    }))
  },

  async disableRoom(id) {
    set({ actionError: null })
    const res = await apiClient.disableRoom(id)
    if (!res.data) return
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? res.data! : r)),
    }))
  },

  clearActionError() {
    set({ actionError: null })
  },
}))

// Selector helpers
export const selectRooms = (s: RoomStore) => s.rooms
export const selectProviders = (s: RoomStore) => s.providers
export const selectListState = (s: RoomStore) => s.listState
export const selectListError = (s: RoomStore) => s.listError
```

**Key differences from old plan:**

- No `activateRoom` — replaced by `enableRoom`/`disableRoom` (separate endpoints)
- No `toggleRoom(id, enabled)` — use `enableRoom`/`disableRoom` directly
- Uses `RoomConfigPublic` (no secrets)
- No `SEEDED_ROOMS` — starts with empty array, fetches from API

---

## Task 6: Create brutal skeleton component

**Files:**

- Create: `packages/dashboard/src/components/ui/room-skeleton.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/components/ui/room-skeleton.tsx`**

```tsx
import { motion } from 'framer-motion'

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      className={[
        'rounded-lg border-[3px] border-[var(--border)] bg-[var(--card-glass)]',
        className ?? '',
      ].join(' ')}
    />
  )
}

export function RoomSkeletonCard() {
  return (
    <div className="brutal-surface theme-card-cream space-y-4 p-5 md:p-6">
      <SkeletonBlock className="h-5 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <div className="flex gap-3">
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-8 w-20" />
      </div>
    </div>
  )
}

export function RoomSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <RoomSkeletonCard key={i} />
      ))}
    </div>
  )
}
```

---

## Task 7: Wire Room List page to real API

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Approach:** Preserve Phase 3 UI (card theme cycling, `PixelScatterText`, `SlideStackNumber`, `DeleteRoomConfirmModal`, `motion.div`, stats row). Only add API integration.

- [ ] **Step 1: Add imports and fetch on mount**

```tsx
import { useEffect } from 'react'
import { RoomSkeletonList } from '~/components/ui/room-skeleton'
import { ApiError } from '~/lib/api-client'
import { selectListError, selectListState, useRoomStore } from '~/stores/room-store'
```

```tsx
const listState = useRoomStore(selectListState)
const listError = useRoomStore(selectListError)
const fetchRooms = useRoomStore((state) => state.fetchRooms)
const enableRoom = useRoomStore((state) => state.enableRoom)
const disableRoom = useRoomStore((state) => state.disableRoom)

useEffect(() => {
  void fetchRooms()
}, [fetchRooms])
```

- [ ] **Step 2: Make toggle/delete handlers async**

```tsx
const handleToggle = async (id: string, roomName: string, currentlyEnabled: boolean) => {
  try {
    if (currentlyEnabled) {
      await disableRoom(id)
    } else {
      await enableRoom(id)
    }
    toast(getRoomToggleToastMessage(roomName, currentlyEnabled), 'info')
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Toggle failed', 'error')
  }
}

const handleConfirmDelete = async () => {
  if (!selectedRoom) return
  try {
    await deleteRoom(selectedRoom.id)
    toast(`Room "${selectedRoom.destinationRoomName}" deleted`, 'warning')
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Delete failed', 'error')
  }
  setSelectedRoom(null)
}
```

- [ ] **Step 3: Add loading and error states**

```tsx
{
  listState === 'loading' && <RoomSkeletonList count={6} />
}

{
  listState === 'error' && (
    <BrutalCard className="theme-card-blush space-y-3">
      <StickerLabel tone="warning">Error</StickerLabel>
      <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">{listError}</p>
      <button
        type="button"
        onClick={() => {
          void fetchRooms()
        }}
        className="brutal-button theme-button-warm px-4 py-2 font-heading text-sm font-bold text-white"
      >
        Retry
      </button>
    </BrutalCard>
  )
}
```

**Preserve all existing:** `cardThemeByIndex`, `tiltByIndex`, `PixelScatterText`, `SlideStackNumber`, `DeleteRoomConfirmModal`, `motion.div` cards, `PROVIDER_LABELS`/`TRANSLATION_STYLE_LABELS`, `font-ui-body`/`font-metric`.

---

## Task 8: Wire Room Create form to POST /api/rooms

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`

**Approach:** Preserve BrutalSelect/BrutalInput, `colorVariant`, zodResolver pattern. Add `webhookSecret` field, wire to async API, add 409 handling.

- [ ] **Step 1: Add `webhookSecret` BrutalInput to the form**

Add between the AI API Token field and the button row:

```tsx
<BrutalInput
  label="Webhook Secret"
  type="password"
  hint="The token from Chatwork after saving the webhook. Follow the Webhook Guide first."
  error={errors.webhookSecret?.message}
  {...register('webhookSecret')}
/>
```

- [ ] **Step 2: Wire to async `createRoom` and add `setError` for 409**

```tsx
import { ApiError } from '~/lib/api-client'

const createRoom = useRoomStore((state) => state.createRoom)

// Add setError to useForm destructuring
const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<RoomCreateInput>({ ... })

const onSubmit = async (data: RoomCreateInput) => {
  const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

  try {
    const room = await createRoom({
      ...data,
      aiModel: normalizedAiModel,
    })
    toast(getRoomCreatedToastMessage(data.destinationRoomName))
    void navigate(`/rooms/${room.id}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      setError('originalRoomId', {
        message: 'A room config for this Chatwork room already exists.',
      })
      return
    }
    toast(err instanceof ApiError ? err.message : 'Failed to create room', 'error')
  }
}
```

- [ ] **Step 3: Update the info card about manual steps**

The "Manual Step Required" card should mention: "Before creating a room, set up a Chatwork webhook and have the webhook secret ready. Follow the Webhook Guide."

**Preserve:** BrutalSelect `colorVariant` (accent/mint/peach), `void navigate()`, `isSubmitting` disabled state.

---

## Task 9: Wire Room Detail page — remove activation, add enable/disable

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`

**Approach:** Major UX change. Remove the webhook activation form (backend doesn't have this concept). Replace with:

- Edit form (left column) — same fields + optional `webhookSecret` update
- Status & controls (right column) — enable/disable toggle, webhook URL display, link to guide

- [ ] **Step 1: Remove activation form imports and state**

Remove:

- `webhookActivationSchema`, `WebhookActivationInput` imports
- `webhookActivationResolver`
- `activationForm` useForm instance
- `activateWebhook` store action
- `onActivateSubmit` handler
- The entire activation `<form>` in the right column

- [ ] **Step 2: Add API imports and enable/disable handlers**

```tsx
import { useEffect } from 'react'
import { RoomSkeletonCard } from '~/components/ui/room-skeleton'
import { ApiError } from '~/lib/api-client'

const enableRoom = useRoomStore((state) => state.enableRoom)
const disableRoom = useRoomStore((state) => state.disableRoom)
const fetchRooms = useRoomStore((state) => state.fetchRooms)
const rooms = useRoomStore((state) => state.rooms)
const listState = useRoomStore((state) => state.listState)

const room = rooms.find((candidate) => candidate.id === id)

useEffect(() => {
  if (!room) {
    void fetchRooms()
  }
}, [room, fetchRooms])
```

- [ ] **Step 3: Add loading state**

```tsx
if (listState === 'loading' && !room) {
  return (
    <PageShell eyebrow="Loading…" title="Room Detail" description="">
      <RoomSkeletonCard />
    </PageShell>
  )
}
```

- [ ] **Step 4: Make edit form async**

```tsx
const onEditSubmit = async (data: RoomEditInput) => {
  const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

  try {
    await updateRoom(room.id, {
      ...data,
      aiModel: normalizedAiModel,
      // Only send secrets if user typed something (non-empty)
      aiApiToken: data.aiApiToken || undefined,
      webhookSecret: data.webhookSecret || undefined,
    })
    toast(getRoomUpdatedToastMessage(data.destinationRoomName), 'info')
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Update failed', 'error')
  }
}
```

- [ ] **Step 5: Add `webhookSecret` field to edit form**

Add a `BrutalInput` for webhook secret (password type, optional):

```tsx
<BrutalInput
  label="Webhook Secret"
  type="password"
  hint="Leave blank to keep existing. Paste new secret to update."
  error={editForm.formState.errors.webhookSecret?.message}
  {...editForm.register('webhookSecret')}
/>
```

- [ ] **Step 6: Replace activation form with enable/disable controls**

In the right column, replace the activation form with:

```tsx
<BrutalCard className="theme-card-cream space-y-4">
  <StickerLabel tone={room.enabled ? 'success' : 'warning'}>Room Status</StickerLabel>
  <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
    {room.enabled
      ? 'Room is enabled. Translation is active for incoming webhooks.'
      : 'Room is disabled. Enable to start receiving translations.'}
  </p>
  <button
    type="button"
    onClick={() => {
      void (room.enabled ? disableRoom(room.id) : enableRoom(room.id))
        .then(() => toast(room.enabled ? 'Room disabled' : 'Room enabled!', 'info'))
        .catch((err) => toast(err instanceof ApiError ? err.message : 'Failed', 'error'))
    }}
    className={[
      'brutal-button w-full py-3 font-heading text-sm font-bold',
      room.enabled ? 'theme-button-warm text-white' : 'theme-button-violet text-white',
    ].join(' ')}
  >
    <PixelScatterText
      value={room.enabled ? 'Disable Room' : 'Enable Room'}
      reserveText="Disable Room"
    />
  </button>
</BrutalCard>
```

**Preserve:** `BrutalInput`/`BrutalSelect` with `colorVariant`, `PixelScatterText` for status, webhook URL + copy button, `handleCopyUrl`, `void navigate('/guide')`.

---

## Task 10: API client unit tests

**Files:**

- Create: `packages/dashboard/src/lib/api-client.test.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/api-client.test.ts`**

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'

const fetchMock = mock(async (_url: string, _opts?: RequestInit) => {
  return new Response(JSON.stringify({ success: false, error: 'mocked' }), { status: 500 })
})

global.fetch = fetchMock as unknown as typeof fetch

import { apiClient, ApiError } from '~/lib/api-client'

describe('apiClient', () => {
  beforeEach(() => {
    fetchMock.mockClear()
  })

  it('throws ApiError with correct status on non-ok response', async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404 }),
    )

    let caught: unknown
    try {
      await apiClient.getRoom('non-existent-id')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(404)
    expect((caught as ApiError).message).toBe('Not found')
  })

  it('returns data on successful response', async () => {
    const mockRoom = { id: 'abc', originalRoomId: 1, enabled: true }
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ success: true, data: mockRoom }), { status: 200 }),
    )

    const res = await apiClient.getRoom('abc')
    expect(res.success).toBe(true)
    expect(res.data).toEqual(mockRoom)
  })

  it('handles 204 No Content for deleteRoom', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))

    const res = await apiClient.deleteRoom('room-123')
    expect(res.success).toBe(true)
  })

  it('sends webhookSecret in createRoom body', async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ success: true, data: { id: 'new' } }), { status: 201 }),
    )

    await apiClient.createRoom({
      originalRoomId: 123,
      destinationRoomName: 'Test',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-test',
      webhookSecret: 'secret-123',
    })

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string) as Record<string, unknown>
    expect(body.webhookSecret).toBe('secret-123')
  })
})
```

---

## Task 11: Zustand store unit tests

**Files:**

- Create: `packages/dashboard/src/stores/room-store.test.ts`

- [ ] **Step 1: Create `packages/dashboard/src/stores/room-store.test.ts`**

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { RoomConfigPublic } from '~/lib/api-types'

const mockListRooms = mock(async () => ({ success: true, data: [] as RoomConfigPublic[] }))
const mockCreateRoom = mock(async () => ({ success: true, data: {} as RoomConfigPublic }))
const mockDeleteRoom = mock(async () => ({ success: true }))
const mockEnableRoom = mock(async () => ({ success: true, data: {} as RoomConfigPublic }))
const mockDisableRoom = mock(async () => ({ success: true, data: {} as RoomConfigPublic }))

mock.module('~/lib/api-client', () => ({
  apiClient: {
    listRooms: mockListRooms,
    createRoom: mockCreateRoom,
    deleteRoom: mockDeleteRoom,
    enableRoom: mockEnableRoom,
    disableRoom: mockDisableRoom,
    getRoom: mock(async () => ({ success: true, data: {} as RoomConfigPublic })),
    updateRoom: mock(async () => ({ success: true, data: {} as RoomConfigPublic })),
    listProviders: mock(async () => ({ success: true, data: [] })),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))

import { useRoomStore } from '~/stores/room-store'

const sampleRoom: RoomConfigPublic = {
  id: 'room-1',
  originalRoomId: 12345,
  destinationRoomId: 67890,
  destinationRoomName: 'Test Room JP',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  enabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.setState({ rooms: [], listState: 'idle', listError: null, providers: [] })
    mockListRooms.mockClear()
    mockCreateRoom.mockClear()
    mockDeleteRoom.mockClear()
  })

  it('fetchRooms sets listState to success with data', async () => {
    mockListRooms.mockImplementationOnce(async () => ({
      success: true,
      data: [sampleRoom],
    }))

    await useRoomStore.getState().fetchRooms()

    const { rooms, listState } = useRoomStore.getState()
    expect(listState).toBe('success')
    expect(rooms).toHaveLength(1)
    expect(rooms[0].id).toBe('room-1')
  })

  it('fetchRooms sets listState to error on failure', async () => {
    const { ApiError } = await import('~/lib/api-client')
    mockListRooms.mockImplementationOnce(async () => {
      throw new ApiError('Network error', 503)
    })

    await useRoomStore.getState().fetchRooms()

    const { listState, listError } = useRoomStore.getState()
    expect(listState).toBe('error')
    expect(listError).toBe('Network error')
  })

  it('createRoom appends room to state', async () => {
    mockCreateRoom.mockImplementationOnce(async () => ({
      success: true,
      data: sampleRoom,
    }))

    await useRoomStore.getState().createRoom({
      originalRoomId: 12345,
      destinationRoomName: 'Test Room JP',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-test',
      webhookSecret: 'secret-test',
    })

    expect(useRoomStore.getState().rooms).toHaveLength(1)
  })

  it('deleteRoom removes room from state', async () => {
    useRoomStore.setState({ rooms: [sampleRoom] })
    await useRoomStore.getState().deleteRoom('room-1')
    expect(useRoomStore.getState().rooms).toHaveLength(0)
  })

  it('enableRoom updates room enabled state', async () => {
    const enabledRoom = { ...sampleRoom, enabled: true }
    mockEnableRoom.mockImplementationOnce(async () => ({
      success: true,
      data: enabledRoom,
    }))

    useRoomStore.setState({ rooms: [sampleRoom] })
    await useRoomStore.getState().enableRoom('room-1')

    expect(useRoomStore.getState().rooms[0].enabled).toBe(true)
  })
})
```

---

## Task 12: Commit and quality gate

- [ ] **Step 1: Run quality gate**

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot
bun run typecheck && bun test && bun run lint
```

Expected: All pass with no errors.

- [ ] **Step 2: Commit API types and client**

```bash
git add packages/dashboard/src/lib/api-types.ts packages/dashboard/src/lib/api-client.ts packages/dashboard/src/lib/api-client.test.ts
git commit -m "feat(dashboard): add typed API client matching Phase 4 backend contract"
```

- [ ] **Step 3: Commit schema + store**

```bash
git add packages/dashboard/src/lib/room-schema.ts packages/dashboard/src/stores/room-store.ts packages/dashboard/src/stores/room-store.test.ts
git commit -m "feat(dashboard): replace mock store with async API-backed Zustand store"
```

- [ ] **Step 4: Commit skeleton + page integrations**

```bash
git add packages/dashboard/src/components/ui/room-skeleton.tsx packages/dashboard/src/pages/ packages/dashboard/vite.config.ts
git commit -m "feat(dashboard): wire pages to backend API with loading/error states"
```

---

## Ship & Review

**User action:**

1. Start the translator backend: `bun run dev` (port 3000)
2. In a separate terminal: `bun run dev:dashboard` (port 5173)
3. Open `http://localhost:5173` in a browser
4. Open DevTools → Network tab

**Success criteria:**

- Room List: `GET /api/rooms` on load; skeleton during loading; error state with Retry; empty state CTA; room cards with enable/disable + delete
- Room Create: Form has 7 fields (incl. webhook secret); `POST /api/rooms` on submit; 409 → inline error on originalRoomId; success → redirect to Room Detail
- Room Detail: Room data from API; edit form with optional webhook secret update; enable/disable button; webhook URL + copy; no activation form
- Toast notifications for all success/error events
- Skeleton cards during loading states
- No `activateWebhook` concept anywhere in FE code

**Await user approval before proceeding to Phase 6.**
