# Dashboard Phase 5: FE + BE Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all dashboard forms and pages to the real backend API, replacing all mock data and static shells with live API calls backed by Zustand state, with correct loading, skeleton, error, and success states throughout.

**Architecture:** The dashboard SPA communicates with `@chatwork-bot/translator` exclusively through a typed API client (`~/lib/api-client.ts`). The Zustand store in `~/stores/room-store.ts` is the single source of truth for UI state — components never call `fetch` directly. A Vite dev proxy forwards `/api/*` requests to `localhost:3000`, so CORS is irrelevant in development. In production the dashboard is served as static files by the translator itself, so the proxy is not needed.

**Tech Stack:** React 19, Zustand 5, React Hook Form, Zod, Framer Motion, Vite 6 proxy, bun:test

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun run dev:dashboard` + start translator on port 3000 → open `localhost:5173` → open DevTools Network tab → verify real API calls, real room data, correct loading/error/success states on all pages

---

## File Map

| File                                                     | Action  | Responsibility                                                                         |
| -------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `packages/dashboard/vite.config.ts`                      | Modify  | Add `/api` proxy to `localhost:3000`                                                   |
| `packages/dashboard/src/lib/api-client.ts`               | Replace | Typed fetch wrapper: all CRUD + enable/disable + providers                             |
| `packages/dashboard/src/lib/api-types.ts`                | Create  | `RoomConfig`, `ProviderInfo`, API response types (FE mirror of backend contract)       |
| `packages/dashboard/src/stores/room-store.ts`            | Replace | Full Zustand store: rooms, providers, async actions, loading/error flags               |
| `packages/dashboard/src/hooks/use-toast.ts`              | Create  | Minimal toast hook (slide-in, auto-dismiss, Framer Motion)                             |
| `packages/dashboard/src/components/ui/toast.tsx`         | Create  | Toast component consuming `use-toast`                                                  |
| `packages/dashboard/src/components/ui/room-skeleton.tsx` | Create  | Brutal skeleton card for loading state                                                 |
| `packages/dashboard/src/pages/room-list.tsx`             | Replace | Real room list from API: loading skeleton, empty state, room cards, toggle, delete     |
| `packages/dashboard/src/pages/room-create.tsx`           | Replace | POST /api/rooms form submit, 409 duplicate handling, success → redirect to Room Detail |
| `packages/dashboard/src/pages/room-detail.tsx`           | Replace | GET /api/rooms/:id data load, PUT update, webhook activation (token → enable)          |
| `packages/dashboard/src/lib/api-client.test.ts`          | Create  | Unit tests for API client error handling (bun:test)                                    |
| `packages/dashboard/src/stores/room-store.test.ts`       | Create  | Unit tests for Zustand store actions (bun:test)                                        |

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

## Task 5: Create toast hook and component

**Files:**

- Create: `packages/dashboard/src/hooks/use-toast.ts`
- Create: `packages/dashboard/src/components/ui/toast.tsx`

- [ ] **Step 1: Create `packages/dashboard/src/hooks/use-toast.ts`**

```typescript
import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  tone: ToastTone
}

interface ToastStore {
  toasts: Toast[]
  addToast(message: string, tone: ToastTone): void
  removeToast(id: string): void
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  addToast(message, tone) {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function useToast() {
  const { addToast } = useToastStore()
  return {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
    info: (msg: string) => addToast(msg, 'info'),
  }
}
```

- [ ] **Step 2: Create `packages/dashboard/src/components/ui/toast.tsx`**

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore, type ToastTone } from '~/hooks/use-toast'

const toneClasses: Record<ToastTone, string> = {
  success: 'theme-card-mint',
  error: 'theme-card-blush',
  warning: 'theme-card-butter',
  info: 'theme-card-sky',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={[
              'brutal-surface cursor-pointer px-5 py-3 font-heading text-sm font-bold',
              toneClasses[toast.tone],
            ].join(' ')}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Mount `<ToastContainer />` in `packages/dashboard/src/layouts/app-layout.tsx`**

Add the import and render `<ToastContainer />` as a sibling of `<Outlet />` inside the layout's root div:

```tsx
import { ToastContainer } from '~/components/ui/toast'

// Inside AppLayout return:
;<>
  {/* existing layout JSX */}
  <ToastContainer />
</>
```

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
    <div className="space-y-4">
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

- Replace: `packages/dashboard/src/pages/room-list.tsx`

- [ ] **Step 1: Replace `packages/dashboard/src/pages/room-list.tsx`**

The page fetches rooms on mount via `useRoomStore.fetchRooms()`. It handles four states:

1. `loading` — show `<RoomSkeletonList />`
2. `error` — show error card with Retry button
3. `success` + empty array — show empty state CTA
4. `success` + rooms — show room cards with enable toggle and delete button

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { RoomSkeletonList } from '~/components/ui/room-skeleton'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/hooks/use-toast'
import { ApiError } from '~/lib/api-client'
import { selectListError, selectListState, selectRooms, useRoomStore } from '~/stores/room-store'

export function RoomListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const rooms = useRoomStore(selectRooms)
  const listState = useRoomStore(selectListState)
  const listError = useRoomStore(selectListError)
  const { fetchRooms, toggleRoom, deleteRoom } = useRoomStore()

  useEffect(() => {
    void fetchRooms()
  }, [fetchRooms])

  async function handleToggle(id: string, currentEnabled: boolean) {
    try {
      await toggleRoom(id, !currentEnabled)
      toast.success(currentEnabled ? 'Room disabled' : 'Room enabled')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Toggle failed')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete room "${name}"? This cannot be undone.`)) return
    try {
      await deleteRoom(id)
      toast.success('Room deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    }
  }

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Translation Rooms"
      description="Manage your Chatwork translation room configurations."
      actions={
        <button
          type="button"
          onClick={() => navigate('/rooms/new')}
          className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
        >
          + New Room
        </button>
      }
    >
      {listState === 'loading' && <RoomSkeletonList count={3} />}

      {listState === 'error' && (
        <BrutalCard className="theme-card-blush space-y-3">
          <StickerLabel tone="warning">Error</StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{listError}</p>
          <button
            type="button"
            onClick={() => fetchRooms()}
            className="brutal-button theme-button-warm px-4 py-2 font-heading text-sm font-bold text-white"
          >
            Retry
          </button>
        </BrutalCard>
      )}

      {(listState === 'success' || listState === 'idle') && rooms.length === 0 && (
        <BrutalCard className="theme-card-sky space-y-5">
          <StatusPill tone="warning">Empty State</StatusPill>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold">Create your first translation room</h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              Set up a translation room to automatically relay messages from a customer Chatwork
              room to an internal room your dev team can read.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/rooms/new')}
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            + New Room
          </button>
        </BrutalCard>
      )}

      {listState === 'success' && rooms.length > 0 && (
        <div className="space-y-4">
          {rooms.map((room, idx) => (
            <BrutalCard
              key={room.id}
              tilt={idx % 2 === 0 ? 'flat' : 'right'}
              className="theme-card-cream space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StickerLabel tone={room.enabled ? 'success' : 'warning'}>
                      {room.enabled ? 'Active' : 'Inactive'}
                    </StickerLabel>
                    <h2
                      className="cursor-pointer font-heading text-xl font-bold hover:underline"
                      onClick={() => navigate(`/rooms/${room.id}`)}
                    >
                      {room.destinationRoomName}
                    </h2>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Room ID: {room.originalRoomId} · Provider: {room.aiProvider}
                    {room.aiModel ? ` (${room.aiModel})` : ''} · Style: {room.translationStyle}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(room.id, room.enabled)}
                    className={[
                      'brutal-button px-4 py-2 font-heading text-sm font-bold',
                      room.enabled ? 'theme-button-warm' : 'theme-button-violet',
                    ].join(' ')}
                  >
                    {room.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    className="brutal-button theme-button-sky px-4 py-2 font-heading text-sm font-bold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(room.id, room.destinationRoomName)}
                    className="brutal-button theme-button-pink px-4 py-2 font-heading text-sm font-bold text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </BrutalCard>
          ))}
        </div>
      )}
    </PageShell>
  )
}
```

---

## Task 8: Wire Room Create form to POST /api/rooms

**Files:**

- Replace: `packages/dashboard/src/pages/room-create.tsx`

The Phase 3 form (React Hook Form + Zod) is already wired up visually. This task replaces the `onSubmit` handler to call the real API, handles the 409 duplicate conflict case by showing an inline field error, and on success redirects to the new room's detail page with a toast.

- [ ] **Step 1: Replace `packages/dashboard/src/pages/room-create.tsx` `onSubmit` handler**

Locate the existing `onSubmit` function (currently a no-op or console.log stub from Phase 3) and replace it:

```tsx
import { useNavigate } from 'react-router'
import { useToast } from '~/hooks/use-toast'
import { ApiError } from '~/lib/api-client'
import { useRoomStore } from '~/stores/room-store'

// Inside RoomCreatePage component:
const navigate = useNavigate()
const toast = useToast()
const { createRoom, fetchProviders, providers } = useRoomStore()

// Fetch providers for the dropdown on mount
useEffect(() => {
  void fetchProviders()
}, [fetchProviders])

const {
  register,
  handleSubmit,
  setError,
  formState: { errors, isSubmitting },
} = useForm<CreateRoomFormValues>({ resolver: zodResolver(createRoomSchema) })

async function onSubmit(values: CreateRoomFormValues) {
  try {
    const room = await createRoom({
      originalRoomId: Number(values.originalRoomId),
      destinationRoomName: values.destinationRoomName,
      aiProvider: values.aiProvider,
      aiModel: values.aiModel || null,
      translationStyle: values.translationStyle,
      aiApiToken: values.aiApiToken,
    })
    toast.success('Room created! Now set up the webhook to activate translation.')
    navigate(`/rooms/${room.id}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      setError('originalRoomId', {
        message: 'A room config for this Chatwork room already exists.',
      })
      return
    }
    toast.error(err instanceof ApiError ? err.message : 'Failed to create room')
  }
}
```

- [ ] **Step 2: Wire providers dropdown to real `providers` state**

Replace the hardcoded `['openai', 'gemini']` array in the AI Provider `<select>` with:

```tsx
<select {...register('aiProvider')} /* existing className */>
  <option value="">Select provider…</option>
  {providers.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ))}
</select>
```

- [ ] **Step 3: Wire AI Model dropdown to selected provider's models**

Use `useWatch` from React Hook Form to react to the selected provider and populate models:

```tsx
import { useWatch } from 'react-hook-form'

const selectedProvider = useWatch({ control, name: 'aiProvider' })
const providerModels = providers.find((p) => p.id === selectedProvider)?.models ?? []
const defaultModel = providers.find((p) => p.id === selectedProvider)?.defaultModel

// In AI Model select:
<select {...register('aiModel')} /* existing className */>
  <option value="">Default ({defaultModel ?? 'provider default'})</option>
  {providerModels.map((m) => (
    <option key={m} value={m}>{m}</option>
  ))}
</select>
```

- [ ] **Step 4: Disable submit button and show spinner during submission**

```tsx
<button
  type="submit"
  disabled={isSubmitting}
  className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:opacity-60"
>
  {isSubmitting ? 'Creating…' : 'Create Room'}
</button>
```

---

## Task 9: Wire Room Detail page to GET /api/rooms/:id + PUT + activation

**Files:**

- Replace: `packages/dashboard/src/pages/room-detail.tsx`

- [ ] **Step 1: Replace `packages/dashboard/src/pages/room-detail.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { RoomSkeletonCard } from '~/components/ui/room-skeleton'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/hooks/use-toast'
import { ApiError } from '~/lib/api-client'
import { useRoomStore } from '~/stores/room-store'
import type { RoomConfig } from '~/lib/api-types'

const activateSchema = z.object({
  webhookToken: z.string().min(1, 'Webhook token is required'),
})

type ActivateFormValues = z.infer<typeof activateSchema>

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { activateRoom, updateRoom, fetchRooms, rooms } = useRoomStore()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomConfig | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivateFormValues>({
    resolver: zodResolver(activateSchema),
  })

  useEffect(() => {
    if (!id) return
    // Check store first; if not found, trigger a full fetch
    const existing = rooms.find((r) => r.id === id)
    if (existing) {
      setRoom(existing)
      setLoading(false)
      return
    }
    void fetchRooms()
      .then(() => {
        // After fetch, room should be in store; useEffect will re-run via rooms dependency
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load room')
        setLoading(false)
      })
  }, [id, rooms, fetchRooms])

  // Sync room from store after fetchRooms completes
  useEffect(() => {
    if (!id) return
    const found = rooms.find((r) => r.id === id)
    if (found) {
      setRoom(found)
      setLoading(false)
    }
  }, [rooms, id])

  async function onActivate(values: ActivateFormValues) {
    if (!id) return
    try {
      const updated = await activateRoom(id, values.webhookToken)
      setRoom(updated)
      toast.success('Room activated! Translation is now live.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Activation failed')
    }
  }

  const webhookUrl = room
    ? `${window.location.origin}/webhook?room_id=${room.originalRoomId}`
    : null

  if (loading) {
    return (
      <PageShell eyebrow="Loading…" title="Room Detail">
        <RoomSkeletonCard />
      </PageShell>
    )
  }

  if (loadError || !room) {
    return (
      <PageShell eyebrow="Error" title="Room Not Found">
        <BrutalCard className="theme-card-blush space-y-3">
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            {loadError ?? 'Room not found.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="brutal-button theme-button-warm px-4 py-2 font-heading text-sm font-bold text-white"
          >
            Back to Dashboard
          </button>
        </BrutalCard>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="Room Config"
      title={room.destinationRoomName}
      description="Review your room configuration and complete webhook activation to go live."
      actions={
        <StatusPill tone={room.enabled ? 'success' : 'warning'}>
          {room.enabled ? 'Active' : 'Inactive'}
        </StatusPill>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* Config summary */}
        <BrutalCard className="theme-card-sky space-y-4" tilt="left">
          <StickerLabel tone="accent">Room Config</StickerLabel>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-2">
              <dt className="font-bold">Original Room ID:</dt>
              <dd>{room.originalRoomId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Destination Room ID:</dt>
              <dd>{room.destinationRoomId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Provider:</dt>
              <dd>
                {room.aiProvider}
                {room.aiModel ? ` / ${room.aiModel}` : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Style:</dt>
              <dd>{room.translationStyle}</dd>
            </div>
          </dl>
          {webhookUrl && (
            <div className="space-y-1">
              <div className="font-heading text-xs font-bold uppercase tracking-wide">
                Webhook URL
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border-[3px] border-[var(--border)] bg-white px-3 py-2 text-xs shadow-[3px_3px_0_var(--border)] break-all">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(webhookUrl)
                    toast.success('Copied!')
                  }}
                  className="brutal-button theme-button-sky px-3 py-2 font-heading text-xs font-bold"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </BrutalCard>

        {/* Webhook activation */}
        <BrutalCard className="theme-card-peach space-y-4" tilt="right">
          <StickerLabel tone="warning" tilt="right">
            {room.enabled ? 'Activated' : 'Activate Room'}
          </StickerLabel>
          {room.enabled ? (
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Translation is live. Messages in Room {room.originalRoomId} will be translated and
              posted to the destination room.
            </p>
          ) : (
            <>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                Paste the Chatwork webhook token to activate translation. Follow the{' '}
                <a href="/guide" className="font-bold underline">
                  Webhook Guide
                </a>{' '}
                if you haven't set up the webhook yet.
              </p>
              <form onSubmit={handleSubmit(onActivate)} className="space-y-3">
                <div className="space-y-1">
                  <label className="font-heading text-xs font-bold uppercase tracking-wide">
                    Webhook Token
                  </label>
                  <input
                    type="password"
                    placeholder="Paste Chatwork webhook token…"
                    className="w-full rounded-lg border-[3px] border-[var(--border)] bg-white px-4 py-2 text-sm shadow-[3px_3px_0_var(--border)] outline-none focus:shadow-[5px_5px_0_var(--accent)]"
                    {...register('webhookToken')}
                  />
                  {errors.webhookToken && (
                    <p className="text-xs text-[var(--error)]">{errors.webhookToken.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="brutal-button theme-button-violet w-full py-3 font-heading text-sm font-bold text-white disabled:opacity-60"
                >
                  {isSubmitting ? 'Activating…' : 'Activate Translation'}
                </button>
              </form>
            </>
          )}
        </BrutalCard>
      </div>
    </PageShell>
  )
}
```

---

## Task 10: API client unit tests

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

## Task 11: Zustand store unit tests

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
git commit -m "feat(dashboard): add typed API client with error handling"
```

- [ ] **Step 3: Commit Zustand store**

```bash
git add packages/dashboard/src/stores/room-store.ts packages/dashboard/src/stores/room-store.test.ts
git commit -m "feat(dashboard): wire Zustand store to API with async actions"
```

- [ ] **Step 4: Commit toast and skeleton UI**

```bash
git add packages/dashboard/src/hooks/ packages/dashboard/src/components/ui/toast.tsx packages/dashboard/src/components/ui/room-skeleton.tsx
git commit -m "feat(dashboard): add toast hook, ToastContainer, and skeleton components"
```

- [ ] **Step 5: Commit page integrations**

```bash
git add packages/dashboard/src/pages/ packages/dashboard/vite.config.ts
git commit -m "feat(dashboard): integrate room list, create, and detail pages with backend API"
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
