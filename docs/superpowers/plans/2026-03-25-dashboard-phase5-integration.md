# Dashboard Phase 5: FE + BE Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all dashboard forms and pages to the real backend API, replacing all mock data and static shells with live API calls backed by Zustand state, with correct loading, skeleton, error, and success states throughout.

**Architecture:** The dashboard SPA communicates with `@chatwork-bot/translator` exclusively through a typed API client (`~/lib/api-client.ts`). The Zustand store in `~/stores/room-store.ts` is the single source of truth for UI state — components never call `fetch` directly. A Vite dev proxy forwards `/api/*` requests to `localhost:3000`, so CORS is irrelevant in development. In production the dashboard is served as static files by the translator itself, so the proxy is not needed.

**Tech Stack:** React 19, Zustand 5, React Hook Form, Zod, Framer Motion, Vite 6 proxy, bun:test

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun run dev:dashboard` + start translator on port 3000 → open `localhost:5173` → open DevTools Network tab → verify real API calls, real room data, correct loading/error/success states on all pages

**⚠️ Current codebase state (post-Phase 3):** Phase 3 implementation introduced several components and patterns not in the original plan. Key differences to preserve:

- **Toast system already exists:** `~/components/ui/toast-provider.tsx` provides `useToast()` hook with `toast(message, variant)` API where variant is `'success' | 'info' | 'warning' | 'error'`. Do NOT create a new toast system — reuse the existing one.
- **Body font:** `'Zen Maru Gothic', sans-serif` (NOT `'Kiwi Maru'`). CSS class: `.font-ui-body`
- **Metric font:** `'Fredoka', cursive` via `.font-metric` class (used in stats numbers)
- **BrutalSelect:** Custom dropdown portal with `colorVariant?: 'accent' | 'mint' | 'peach'` prop — NOT a native `<select>`
- **BrutalInput:** Styling via CSS classes `.brutal-input` / `.brutal-input-error` / `.brutal-input:focus`
- **StatusPill:** `children: ReactNode` (not string), added `className` prop
- **BrutalCard:** Added `animated?: boolean` prop
- **DeleteRoomConfirmModal:** Custom modal via `createPortal` — replaces `window.confirm()`
- **Animation components:** `PixelScatterText` (scatter text transitions), `SlideStackNumber` (slot-machine number wheel)
- **Seeded data:** 12 rooms exported as `SEEDED_ROOMS` (not 2 `MOCK_ROOMS`)
- **zodResolver pattern:** Uses `zodResolver(schema as never) as Resolver<T>` type cast
- **Toast call pattern:** `toast('message', 'info')` not `toast.success('message')`
- **Navigate pattern:** `void navigate('/path')` (void prefix for promise)

---

## File Map

| File                                                     | Action  | Responsibility                                                                      |
| -------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `packages/dashboard/vite.config.ts`                      | Modify  | Add `/api` proxy to `localhost:3000`                                                |
| `packages/dashboard/src/lib/api-client.ts`               | Replace | Typed fetch wrapper: all CRUD + enable/disable + providers                          |
| `packages/dashboard/src/lib/api-types.ts`                | Create  | `RoomConfig`, `ProviderInfo`, API response types (FE mirror of backend contract)    |
| `packages/dashboard/src/stores/room-store.ts`            | Replace | Full Zustand store: rooms, providers, async actions, loading/error flags            |
| `packages/dashboard/src/components/ui/room-skeleton.tsx` | Create  | Brutal skeleton card for loading state                                              |
| `packages/dashboard/src/pages/room-list.tsx`             | Modify  | Wire to API, add loading/error states, preserve DeleteRoomConfirmModal + animations |
| `packages/dashboard/src/pages/room-create.tsx`           | Modify  | Wire onSubmit to POST /api/rooms, 409 handling, preserve BrutalSelect colorVariant  |
| `packages/dashboard/src/pages/room-detail.tsx`           | Modify  | Wire to GET/PUT API, preserve PixelScatterText + existing form layout               |
| `packages/dashboard/src/lib/api-client.test.ts`          | Create  | Unit tests for API client error handling (bun:test)                                 |
| `packages/dashboard/src/stores/room-store.test.ts`       | Create  | Unit tests for Zustand store async actions (bun:test)                               |

**Removed from original plan (already exist from Phase 3):**

- ~~`packages/dashboard/src/hooks/use-toast.ts`~~ — toast system already at `~/components/ui/toast-provider.tsx`
- ~~`packages/dashboard/src/components/ui/toast.tsx`~~ — `BrutalToast` already exists at `~/components/ui/brutal-toast.tsx`

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

**Why:** The dashboard dev server runs on `localhost:5173` and the translator backend on `localhost:3000`. Without a proxy every `fetch('/api/...')` call would fail with CORS. The proxy rewrites matching requests to the backend transparently. In production this is irrelevant — the translator serves the built SPA as static files from the same origin.

---

## Task 2: Define API types (FE mirror of backend contract)

**Files:**

- Create: `packages/dashboard/src/lib/api-types.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/api-types.ts`**

These types mirror the backend `RoomConfig` data model and API response envelopes. The FE defines its own types (not imported from translator) to keep the packages decoupled.

```typescript
export type TranslationStyle =
  | 'AUTO_CONTEXT'
  | 'NATURAL_CASUAL'
  | 'PROFESSIONAL_BUSINESS'
  | 'TECHNICAL'

export type AiProvider = 'openai' | 'gemini'

export interface RoomConfig {
  id: string
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  // encryptedAiApiToken is NEVER returned — omitted from API responses
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
  warning?: string
}

export interface CreateRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
}

export interface UpdateRoomInput {
  destinationRoomName?: string
  aiProvider?: AiProvider
  aiModel?: string | null
  translationStyle?: TranslationStyle
  aiApiToken?: string
}

export interface ActivateRoomInput {
  webhookToken: string
}
```

---

## Task 3: Build the typed API client

**Files:**

- Replace: `packages/dashboard/src/lib/api-client.ts`

- [ ] **Step 1: Replace `packages/dashboard/src/lib/api-client.ts` with full typed client**

```typescript
import type {
  ApiResponse,
  ActivateRoomInput,
  CreateRoomInput,
  ProviderInfo,
  RoomConfig,
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
  listRooms(): Promise<ApiResponse<RoomConfig[]>> {
    return request<RoomConfig[]>('GET', '/rooms')
  },

  getRoom(id: string): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('GET', `/rooms/${id}`)
  },

  createRoom(input: CreateRoomInput): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('POST', '/rooms', input)
  },

  updateRoom(id: string, input: UpdateRoomInput): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('PUT', `/rooms/${id}`, input)
  },

  deleteRoom(id: string): Promise<ApiResponse<void>> {
    return request<void>('DELETE', `/rooms/${id}`)
  },

  enableRoom(id: string): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('POST', `/rooms/${id}/enable`)
  },

  disableRoom(id: string): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('POST', `/rooms/${id}/disable`)
  },

  activateRoom(id: string, input: ActivateRoomInput): Promise<ApiResponse<RoomConfig>> {
    return request<RoomConfig>('PUT', `/rooms/${id}`, {
      webhookToken: input.webhookToken,
    })
  },

  // Providers
  listProviders(): Promise<ApiResponse<ProviderInfo[]>> {
    return request<ProviderInfo[]>('GET', '/providers')
  },
}

export { ApiError }
```

---

## Task 4: Replace Zustand store with full async state

**Files:**

- Replace: `packages/dashboard/src/stores/room-store.ts`

- [ ] **Step 1: Replace `packages/dashboard/src/stores/room-store.ts`**

```typescript
import { create } from 'zustand'
import { apiClient, ApiError } from '~/lib/api-client'
import type { CreateRoomInput, ProviderInfo, RoomConfig, UpdateRoomInput } from '~/lib/api-types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface RoomStore {
  // State
  rooms: RoomConfig[]
  providers: ProviderInfo[]
  listState: LoadState
  listError: string | null
  actionError: string | null

  // Actions
  fetchRooms(): Promise<void>
  fetchProviders(): Promise<void>
  createRoom(input: CreateRoomInput): Promise<RoomConfig>
  updateRoom(id: string, input: UpdateRoomInput): Promise<RoomConfig>
  deleteRoom(id: string): Promise<void>
  toggleRoom(id: string, enabled: boolean): Promise<void>
  activateRoom(id: string, webhookToken: string): Promise<RoomConfig>
  clearActionError(): void
}

export const useRoomStore = create<RoomStore>()((set, get) => ({
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
      // Non-fatal: provider list falls back to empty; form shows inline error
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

  async toggleRoom(id, enabled) {
    set({ actionError: null })
    const res = enabled ? await apiClient.enableRoom(id) : await apiClient.disableRoom(id)
    if (!res.data) return
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? res.data! : r)),
    }))
  },

  async activateRoom(id, webhookToken) {
    set({ actionError: null })
    const res = await apiClient.activateRoom(id, { webhookToken })
    if (!res.data) throw new Error('No data returned from activateRoom')
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? res.data! : r)),
    }))
    return res.data
  },

  clearActionError() {
    set({ actionError: null })
  },
}))

// Selector helpers — keeps component code clean
export const selectRooms = (s: RoomStore) => s.rooms
export const selectProviders = (s: RoomStore) => s.providers
export const selectListState = (s: RoomStore) => s.listState
export const selectListError = (s: RoomStore) => s.listError
```

---

## Task 5: Create brutal skeleton component

> **Note:** Toast system (Task 5 in the original plan) has been **removed** — it already exists from Phase 3 at `~/components/ui/toast-provider.tsx` with `useToast()` hook and `~/components/ui/brutal-toast.tsx`. Use `toast('message', 'variant')` where variant is `'success' | 'info' | 'warning' | 'error'`.

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
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <RoomSkeletonCard key={i} />
      ))}
    </div>
  )
}
```

---

## Task 6: Wire Room List page to real API

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Approach:** Preserve the existing Phase 3 UI (card theme cycling, `PixelScatterText`, `SlideStackNumber`, `DeleteRoomConfirmModal`, `motion.div` cards, stats row, `font-ui-body`/`font-metric` classes). Only change what's needed for API integration.

- [ ] **Step 1: Add imports and fetch on mount**

Add these imports and the `useEffect` fetch call:

```tsx
import { useEffect } from 'react'
import { RoomSkeletonList } from '~/components/ui/room-skeleton'
import { ApiError } from '~/lib/api-client'
import { selectListError, selectListState, useRoomStore } from '~/stores/room-store'
```

Add state selectors and fetch effect inside the component:

```tsx
const listState = useRoomStore(selectListState)
const listError = useRoomStore(selectListError)
const fetchRooms = useRoomStore((state) => state.fetchRooms)

useEffect(() => {
  void fetchRooms()
}, [fetchRooms])
```

- [ ] **Step 2: Make toggle/delete handlers async with error handling**

Replace the existing `handleToggle` and `handleConfirmDelete` with async versions that call the API:

```tsx
const handleToggle = async (id: string, roomName: string, currentlyEnabled: boolean) => {
  try {
    await toggleRoom(id, !currentlyEnabled)
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

- [ ] **Step 3: Add loading and error states before the room grid**

Insert loading/error states between the stats row and the room grid/empty state:

```tsx
{
  listState === 'loading' && <RoomSkeletonList count={3} />
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

**Preserve all existing:** card theme cycling (`cardThemeByIndex`), tilt cycling (`tiltByIndex`), `PixelScatterText` for status/toggle buttons, `SlideStackNumber` for stats, `DeleteRoomConfirmModal`, `motion.div` card wrappers, `PROVIDER_LABELS`/`TRANSLATION_STYLE_LABELS` lookups, `font-ui-body`/`font-metric` classes.

- [ ] **Step 4: Update `toggleRoom` store call signature**

The Phase 5 store's `toggleRoom(id, enabled)` takes a boolean (the desired state), while Phase 3 used `toggleRoom(id)` (toggles current). Update the button `onClick` to pass the desired state:

```tsx
onClick={() => {
  void handleToggle(room.id, room.destinationRoomName, room.enabled)
}}
```

---

## Task 7: Wire Room Create form to POST /api/rooms

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`

**Approach:** Preserve the existing Phase 3 form structure: `BrutalSelect` with `colorVariant`, `BrutalInput`, `zodResolver(roomCreateSchema as never) as Resolver<RoomCreateInput>` pattern, `void navigate()`, `PROVIDER_MODELS`/`PROVIDER_LABELS` lookups. Only change the `onSubmit` handler and add `setError` for 409 handling.

- [ ] **Step 1: Add API imports and wire `createRoom` from store**

```tsx
import { ApiError } from '~/lib/api-client'

// Inside RoomCreatePage, replace addRoom with createRoom:
const createRoom = useRoomStore((state) => state.createRoom)
```

- [ ] **Step 2: Replace `onSubmit` handler with async API call**

Replace the existing sync `onSubmit` function. Add `setError` to the `useForm` destructuring:

```tsx
const {
  register,
  handleSubmit,
  watch,
  setValue,
  setError,
  formState: { errors, isSubmitting },
} = useForm<RoomCreateInput>({
  resolver: roomCreateResolver,
  defaultValues: {
    /* ...existing defaults... */
  },
})

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

- [ ] **Step 3: Update form `onSubmit` to handle async**

```tsx
<form
  onSubmit={(event) => {
    void handleSubmit(onSubmit)(event)
  }}
  noValidate
>
```

**Preserve all existing:** `BrutalSelect` with `colorVariant` props (`accent`, `mint`, `peach`), `BrutalInput` components, `PROVIDER_MODELS[selectedProvider]` model lookup, `aiProviderField` with `onChange` resetting model, `void navigate()` pattern, `isSubmitting` disabled state on button.

---

## Task 8: Wire Room Detail page to GET /api/rooms/:id + PUT + activation

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`

**Approach:** Preserve the existing Phase 3 layout: two-column grid with edit form (left) and webhook section (right), `BrutalInput`/`BrutalSelect` with `colorVariant`, `PixelScatterText` for status, `zodResolver(roomEditSchema as never) as Resolver<RoomEditInput>` pattern, `webhookActivationResolver`, `handleCopyUrl`, `void navigate()`, `getRoomUpdatedToastMessage()`. Only change handlers to be async API calls and add loading/error states.

- [ ] **Step 1: Add API imports**

```tsx
import { useEffect } from 'react'
import { RoomSkeletonCard } from '~/components/ui/room-skeleton'
import { ApiError } from '~/lib/api-client'
```

- [ ] **Step 2: Wire room data from API store**

Replace the sync store lookup with API-backed loading:

```tsx
const rooms = useRoomStore((state) => state.rooms)
const fetchRooms = useRoomStore((state) => state.fetchRooms)
const listState = useRoomStore((state) => state.listState)

const room = rooms.find((candidate) => candidate.id === id)

useEffect(() => {
  if (!room) {
    void fetchRooms()
  }
}, [room, fetchRooms])
```

Add a loading state before the "not found" check:

```tsx
if (listState === 'loading' && !room) {
  return (
    <PageShell eyebrow="Loading…" title="Room Detail" description="">
      <RoomSkeletonCard />
    </PageShell>
  )
}
```

- [ ] **Step 3: Make `onEditSubmit` async**

```tsx
const onEditSubmit = async (data: RoomEditInput) => {
  const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

  try {
    await updateRoom(room.id, {
      ...data,
      aiModel: normalizedAiModel,
    })
    toast(getRoomUpdatedToastMessage(data.destinationRoomName), 'info')
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Update failed', 'error')
  }
}
```

- [ ] **Step 4: Make `onActivateSubmit` async**

```tsx
const onActivateSubmit = async (data: WebhookActivationInput) => {
  try {
    await activateWebhook(room.id, data.webhookToken)
    toast('Webhook activated! Room is now live.')
    activationForm.reset()
  } catch (err) {
    toast(err instanceof ApiError ? err.message : 'Activation failed', 'error')
  }
}
```

**Preserve all existing:** `BrutalInput` for all text/password fields, `BrutalSelect` with `colorVariant` (`accent`, `mint`, `peach`), `PixelScatterText` for status pill, `StickerLabel`, webhook URL with copy button, `handleCopyUrl` with `setCopied` state, edit form + activation form dual-form layout, `font-ui-body` classes, `void navigate('/guide')` pattern.

---

## Task 9: API client unit tests

**Files:**

- Create: `packages/dashboard/src/lib/api-client.test.ts`

- [ ] **Step 1: Create `packages/dashboard/src/lib/api-client.test.ts`**

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock global fetch before importing module under test
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

  it('throws ApiError with status 0 on non-JSON response', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response('Internal Server Error', { status: 500 }),
    )

    let caught: unknown
    try {
      await apiClient.listRooms()
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ApiError)
  })

  it('calls correct URL for listRooms', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    )

    await apiClient.listRooms()
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms', expect.any(Object))
  })

  it('calls correct URL for deleteRoom', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
    )

    await apiClient.deleteRoom('room-123')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms/room-123',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
```

---

## Task 10: Zustand store unit tests

**Files:**

- Create: `packages/dashboard/src/stores/room-store.test.ts`

- [ ] **Step 1: Create `packages/dashboard/src/stores/room-store.test.ts`**

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { RoomConfig } from '~/lib/api-types'

// Mock the api-client module before importing the store
const mockListRooms = mock(async () => ({ success: true, data: [] as RoomConfig[] }))
const mockCreateRoom = mock(async () => ({ success: true, data: {} as RoomConfig }))
const mockDeleteRoom = mock(async () => ({ success: true }))
const mockEnableRoom = mock(async () => ({ success: true, data: {} as RoomConfig }))

mock.module('~/lib/api-client', () => ({
  apiClient: {
    listRooms: mockListRooms,
    createRoom: mockCreateRoom,
    deleteRoom: mockDeleteRoom,
    enableRoom: mockEnableRoom,
    disableRoom: mock(async () => ({ success: true, data: {} as RoomConfig })),
    getRoom: mock(async () => ({ success: true, data: {} as RoomConfig })),
    updateRoom: mock(async () => ({ success: true, data: {} as RoomConfig })),
    activateRoom: mock(async () => ({ success: true, data: {} as RoomConfig })),
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

const sampleRoom: RoomConfig = {
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

  it('fetchRooms sets listState to loading then success', async () => {
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

    useRoomStore.setState({ rooms: [] })
    await useRoomStore.getState().createRoom({
      originalRoomId: 12345,
      destinationRoomName: 'Test Room JP',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-test',
    })

    expect(useRoomStore.getState().rooms).toHaveLength(1)
  })

  it('deleteRoom removes room from state', async () => {
    useRoomStore.setState({ rooms: [sampleRoom] })
    await useRoomStore.getState().deleteRoom('room-1')
    expect(useRoomStore.getState().rooms).toHaveLength(0)
  })

  it('clearActionError resets actionError', () => {
    useRoomStore.setState({ actionError: 'some error' })
    useRoomStore.getState().clearActionError()
    expect(useRoomStore.getState().actionError).toBeNull()
  })
})
```

---

## Task 11: Commit and quality gate

- [ ] **Step 1: Run quality gate**

```bash
cd /Users/phamau/Desktop/projects/research/chatwork-translation-bot
bun run typecheck && bun test && bun run lint
```

Expected: All pass with no errors.

- [ ] **Step 2: Commit API types and client**

```bash
git add packages/dashboard/src/lib/api-types.ts packages/dashboard/src/lib/api-client.ts packages/dashboard/src/lib/api-client.test.ts
git commit -m "feat(dashboard): add typed API client with error handling"
```

- [ ] **Step 3: Commit Zustand store**

```bash
git add packages/dashboard/src/stores/room-store.ts packages/dashboard/src/stores/room-store.test.ts
git commit -m "feat(dashboard): wire Zustand store to API with async actions"
```

- [ ] **Step 4: Commit skeleton component and page integrations**

```bash
git add packages/dashboard/src/components/ui/room-skeleton.tsx packages/dashboard/src/pages/ packages/dashboard/vite.config.ts
git commit -m "feat(dashboard): add skeleton loading states and wire pages to backend API"
```

---

## Ship & Review

**User action:**

1. Start the translator backend: `bun run dev` (or `bun --hot packages/translator/src/index.ts` for just the backend)
2. In a separate terminal: `bun run dev:dashboard`
3. Open `http://localhost:5173` in a browser
4. Open DevTools → Network tab

**Success criteria:**

- Room List: Network tab shows `GET /api/rooms` on page load; empty state renders; after creating a room the list shows it
- Room Create: Form submits `POST /api/rooms`; duplicate `originalRoomId` shows inline field error; success redirects to Room Detail with toast
- Room Detail: Page loads room data from store/API; webhook URL shown and copyable; activation form submits and room becomes active
- Toast notifications appear and auto-dismiss for all success/error events
- Skeleton cards show during loading states

**Await user approval before proceeding to Phase 6.**
