# Dashboard Phase 6: Code Review & Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review and refactor the full dashboard + backend codebase for atomic design, clean code, SOLID principles, loose coupling, and consistent patterns — ensuring the system is maintainable and extensible.

**Architecture:** This phase produces no new features. It audits the code written in Phases 1-5, fixes structural issues, extracts shared hooks/utilities, tightens TypeScript types, and ensures consistent error handling. The output is a cleaner, better-organized codebase with the same functionality.

**Tech Stack:** Same as Phases 1-5 (React 19, Zustand 5, Elysia, Zod, bun:test)

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** Code review report + `bun run typecheck && bun test && bun run lint` all pass. User reviews PR diff.

---

## ⚠️ Codebase state entering Phase 6 (post-Phase 5)

### Dashboard structure:

```
packages/dashboard/src/
  components/ui/     ← All UI components flat in ui/ folder
    ambient-orbs.tsx, brutal-card.tsx, brutal-input.tsx, brutal-select.tsx,
    brutal-toast.tsx, delete-room-confirm-modal.tsx, mock-field.tsx,
    page-shell.tsx, pixel-scatter-text.tsx, slide-stack-number.tsx,
    status-pill.tsx, sticker-label.tsx, toast-provider.tsx, webhook-stepper.tsx
  hooks/             ← Empty (no hooks extracted yet)
  lib/
    api-client.ts    ← Typed fetch wrapper (Phase 5)
    api-types.ts     ← RoomConfigPublic, ProviderInfo, API response types (Phase 5)
    provider-models.ts
    room-schema.ts   ← Create schema (with webhookSecret), edit schema, no activation schema
  stores/
    room-store.ts    ← Async Zustand store with enableRoom/disableRoom (Phase 5)
  pages/
    room-list.tsx, room-create.tsx, room-detail.tsx, webhook-guide.tsx
```

### Key patterns to preserve (from Phase 3+5):

- **Toast:** `useToast()` hook from `toast-provider.tsx`, `toast('message', 'info')` API
- **API types:** `RoomConfigPublic` (secrets redacted), `ProviderInfo`, `CreateRoomInput`, `UpdateRoomInput`
- **Store actions:** `fetchRooms`, `createRoom`, `updateRoom`, `deleteRoom`, `enableRoom`, `disableRoom`, `fetchProviders`
- **No activation concept** — rooms are created with `webhookSecret` upfront, then enabled/disabled
- **zodResolver pattern:** `zodResolver(schema as never) as Resolver<T>`
- **Navigate:** `void navigate('/path')`

---

## File Map

| File                                                    | Action   | Responsibility                                        |
| ------------------------------------------------------- | -------- | ----------------------------------------------------- |
| `packages/dashboard/src/components/**`                  | Refactor | Atomic design: atoms → molecules → organisms → layout |
| `packages/dashboard/src/hooks/use-copy-clipboard.ts`    | Extract  | Copy-to-clipboard shared hook                         |
| `packages/dashboard/src/hooks/use-async-action.ts`      | Extract  | Generic async action with loading/error state         |
| `packages/dashboard/src/lib/api-client.ts`              | Refactor | Tighten types, add generic error handler              |
| `packages/dashboard/src/lib/api-types.ts`               | Refactor | Verify types match backend `RoomConfigPublic` exactly |
| `packages/dashboard/src/stores/room-store.ts`           | Refactor | Separate selectors, derived state                     |
| `packages/translator/src/routes/*.ts`                   | Refactor | Consistent error responses, extract validation        |
| `packages/translator/src/services/room-config-store.ts` | Refactor | Tighten types, edge case handling                     |

---

## Task 1: Audit and report

**Files:**

- None (read-only analysis)

- [ ] **Step 1: Run static analysis**

```bash
bun run typecheck && bun run lint 2>&1 | tee /tmp/phase6-lint.txt
bun test 2>&1 | tee /tmp/phase6-tests.txt
```

- [ ] **Step 2: Generate audit report**

Review the following and document issues:

1. Any `any` or loose `unknown` types that can be narrowed
2. Components doing too much (>150 lines)
3. Duplicated logic across pages (e.g. inline clipboard copy, loading/error patterns)
4. Inconsistent error handling patterns
5. Missing TypeScript strict checks (unused vars, implicit any)
6. Zustand store design — are selectors clean? Are derived values computed inline or extracted?
7. Backend route handler size and complexity
8. Test coverage gaps (especially for Phase 5 API client and store)
9. Verify `api-types.ts` matches backend `RoomConfigPublic` exactly (no drift)
10. Check that no `webhookToken` / `activateWebhook` / `toggleRoom` remnants exist

---

## Task 2: Refactor dashboard component structure (Atomic Design)

**Files:**

- Refactor: `packages/dashboard/src/components/`

- [ ] **Step 1: Organize components into atomic layers**

Move from flat `components/ui/` to atomic structure:

```
components/
  atoms/          ← BrutalInput, BrutalSelect, StatusPill, StickerLabel, MockField
  molecules/      ← BrutalCard, BrutalToast, WebhookStepper
  organisms/      ← DeleteRoomConfirmModal, ToastProvider
  layout/         ← PageShell, AmbientOrbs
  animation/      ← PixelScatterText, SlideStackNumber
```

Note: No `WebhookActivation` organism — that concept doesn't exist in the current codebase.

Move files to correct directories. Update all imports using `~/components/atoms/`, `~/components/molecules/`, etc.

- [ ] **Step 2: Update all import paths across pages, stores, and other components**

Grep for old import paths (`~/components/ui/`) and update to new atomic structure.

- [ ] **Step 3: Verify no broken imports**

```bash
bun run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/
git commit -m "refactor(dashboard): reorganize components into atomic design layers"
```

---

## Task 3: Extract shared hooks

**Files:**

- Create: `packages/dashboard/src/hooks/use-copy-clipboard.ts`
- Create: `packages/dashboard/src/hooks/use-async-action.ts`
- Refactor: pages that duplicate these patterns

Note: `useToast()` is already available from `toast-provider.tsx` — do NOT extract it again.

- [ ] **Step 1: Create `use-copy-clipboard.ts`**

```typescript
import { useState } from 'react'

export function useCopyClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), resetMs)
  }

  return { copied, copy }
}
```

- [ ] **Step 2: Create `use-async-action.ts`**

```typescript
import { useState, useCallback } from 'react'

interface AsyncActionState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useAsyncAction<T>() {
  const [state, setState] = useState<AsyncActionState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setState({ data: null, error: null, loading: true })
    try {
      const data = await fn()
      setState({ data, error: null, loading: false })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ data: null, error: message, loading: false })
      throw err
    }
  }, [])

  return { ...state, execute }
}
```

- [ ] **Step 3: Replace duplicated patterns in pages with shared hooks**

Search for `navigator.clipboard` and inline loading/error state patterns → replace with hooks.

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/hooks/ packages/dashboard/src/pages/
git commit -m "refactor(dashboard): extract shared hooks for clipboard and async actions"
```

---

## Task 4: Tighten TypeScript types

**Files:**

- Refactor: `packages/dashboard/src/lib/api-client.ts`
- Refactor: `packages/dashboard/src/lib/api-types.ts`
- Refactor: `packages/dashboard/src/stores/room-store.ts`

- [ ] **Step 1: Verify api-types.ts matches backend exactly**

Compare `RoomConfigPublic` in `api-types.ts` against `packages/translator/src/types/room-config.ts`. Ensure:

- Same fields: `id`, `originalRoomId`, `destinationRoomId`, `destinationRoomName`, `aiProvider`, `aiModel`, `translationStyle`, `enabled`, `createdAt`, `updatedAt`
- NO `encryptedAiApiToken` or `encryptedWebhookSecret` — those are redacted
- NO `webhookToken` — that field doesn't exist in backend

- [ ] **Step 2: Add strict return types to API client**

Ensure every API function has an explicit return type (not inferred `Promise<any>`). Each method should return typed `ApiResponse<T>` or `void` (for 204 DELETE).

- [ ] **Step 3: Add Zustand selectors**

Create typed selector functions instead of `useRoomStore(state => state.xxx)` in every component:

```typescript
// In room-store.ts
export const selectRooms = (state: RoomState) => state.rooms
export const selectRoomById = (id: string) => (state: RoomState) =>
  state.rooms.find((r) => r.id === id)
export const selectProviders = (state: RoomState) => state.providers
export const selectIsLoading = (state: RoomState) => state.loading
```

- [ ] **Step 4: Remove any `any` types**

```bash
cd packages/dashboard && grep -rn ': any' src/ --include='*.ts' --include='*.tsx'
```

Fix each occurrence.

- [ ] **Step 5: Verify and commit**

```bash
bun run typecheck && bun run lint
git add packages/dashboard/src/
git commit -m "refactor(dashboard): tighten TypeScript types and add store selectors"
```

---

## Task 5: Review backend service boundaries

**Files:**

- Refactor: `packages/translator/src/routes/*.ts` (rooms.ts, providers.ts, internal-room-secret.ts)
- Refactor: `packages/translator/src/services/room-config-store.ts`

- [ ] **Step 1: Ensure consistent API error responses**

All error responses should follow a consistent pattern with appropriate HTTP status codes. Audit each route handler in:

- `routes/rooms.ts` — POST (400, 409, 502), PUT (400, 404), DELETE (404), enable/disable (404)
- `routes/providers.ts` — GET (no errors expected)
- `routes/internal-room-secret.ts` — GET (400, 401, 404)

Verify all use `{ error: "message" }` format consistently.

- [ ] **Step 2: Review validation approach**

Request body schemas are already defined in `packages/translator/src/types/room-config.ts` (`CreateRoomRequestSchema`, `UpdateRoomRequestSchema`). Verify route handlers use `.safeParse()` consistently and return proper 400 errors with `parsed.error.issues`.

- [ ] **Step 3: Review RoomConfigStore for edge cases**

- File not found on startup → create empty file
- Corrupt JSON → fail fast with clear error
- Concurrent writes → verify mutex works
- Archive file missing → create on first delete

- [ ] **Step 4: Verify and commit**

```bash
bun run typecheck && bun test && bun run lint
git add packages/translator/src/
git commit -m "refactor(translator): consolidate API error handling and validation schemas"
```

---

## Task 6: Final quality gate

- [ ] **Step 1: Run full quality checks**

```bash
bun run typecheck && bun test && bun run lint
```

All must pass with zero warnings.

- [ ] **Step 2: Check for unused exports**

```bash
cd packages/dashboard && grep -rn 'export ' src/ --include='*.ts' --include='*.tsx' | head -50
```

Remove any unused exports.

- [ ] **Step 3: Verify no Phase 3→5 dead code remains**

Search for and remove any remnants:

- `webhookToken` (replaced by `webhookSecret` at creation)
- `activateWebhook` (no activation concept)
- `toggleRoom` (replaced by `enableRoom`/`disableRoom`)
- `webhookActivationSchema` (removed in Phase 5)

```bash
cd packages/dashboard && grep -rn 'webhookToken\|activateWebhook\|toggleRoom\|webhookActivationSchema' src/
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor(repo): Phase 6 code review complete — all quality checks pass"
```

---

## Ship & Review

**User action:** Review the PR diff showing all refactoring changes.

**Success criteria:**

1. `bun run typecheck && bun test && bun run lint` — all pass
2. Component structure follows atomic design (atoms/molecules/organisms/layout/animation)
3. No `any` types in dashboard code
4. Shared hooks extracted (no duplicated clipboard/async patterns)
5. Backend error responses consistent across all routes
6. `api-types.ts` matches backend `RoomConfigPublic` exactly — no drift
7. No dead code remnants from pre-Phase 5 patterns (`webhookToken`, `activateWebhook`, `toggleRoom`)
8. All existing functionality unchanged — same UX, same API behavior

**Await user approval before proceeding to Phase 7.**
