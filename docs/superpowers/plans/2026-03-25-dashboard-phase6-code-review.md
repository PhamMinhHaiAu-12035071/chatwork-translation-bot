# Dashboard Phase 6: Code Review & Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review and refactor the full dashboard + backend codebase for atomic design, clean code, SOLID principles, loose coupling, and consistent patterns — ensuring the system is maintainable and extensible.

**Architecture:** This phase produces no new features. It audits the code written in Phases 1-5, fixes structural issues, extracts shared hooks/utilities, tightens TypeScript types, and ensures consistent error handling. The output is a cleaner, better-organized codebase with the same functionality.

**Tech Stack:** Same as Phases 1-5 (React 19, Zustand, Elysia, Zod, bun:test)

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** Code review report + `bun run typecheck && bun test && bun run lint` all pass. User reviews PR diff.

---

## File Map

| File                                                    | Action   | Responsibility                                 |
| ------------------------------------------------------- | -------- | ---------------------------------------------- |
| `packages/dashboard/src/components/**`                  | Refactor | Atomic design: atoms → molecules → organisms   |
| `packages/dashboard/src/hooks/use-toast.ts`             | Extract  | Toast hook from ToastProvider context          |
| `packages/dashboard/src/hooks/use-copy-clipboard.ts`    | Extract  | Copy-to-clipboard shared hook                  |
| `packages/dashboard/src/hooks/use-async-action.ts`      | Extract  | Generic async action with loading/error state  |
| `packages/dashboard/src/lib/api-client.ts`              | Refactor | Tighten types, add generic error handler       |
| `packages/dashboard/src/stores/room-store.ts`           | Refactor | Separate selectors, derived state              |
| `packages/translator/src/routes/api/**`                 | Refactor | Consistent error responses, extract validation |
| `packages/translator/src/services/room-config-store.ts` | Refactor | Tighten types, edge case handling              |

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
3. Duplicated logic across pages
4. Inconsistent error handling patterns
5. Missing TypeScript strict checks (unused vars, implicit any)
6. Zustand store design (actions mixed with state?)
7. Backend route handler size and complexity
8. Test coverage gaps

---

## Task 2: Refactor dashboard component structure (Atomic Design)

**Files:**

- Refactor: `packages/dashboard/src/components/`

- [ ] **Step 1: Organize components into atomic layers**

```
components/
  atoms/          ← BrutalInput, BrutalSelect, StatusPill, StickerLabel
  molecules/      ← BrutalCard, MockField, WebhookUrlDisplay, ToastNotification
  organisms/      ← RoomCard, RoomForm, WebhookStepper, WebhookActivation
  layout/         ← AppLayout, PageShell, AmbientOrbs
```

Move files to correct directories. Update all imports using `~/components/atoms/`, `~/components/molecules/`, etc.

- [ ] **Step 2: Update all import paths across pages**

Grep for old import paths and update to new atomic structure.

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
- Refactor: `packages/dashboard/src/stores/room-store.ts`

- [ ] **Step 1: Add strict return types to API client**

Ensure every API function has an explicit return type (not inferred `Promise<any>`).

- [ ] **Step 2: Add Zustand selectors**

Create typed selector functions instead of `useRoomStore(state => state.xxx)` in every component:

```typescript
// In room-store.ts
export const selectRooms = (state: RoomState) => state.rooms
export const selectRoomById = (id: string) => (state: RoomState) =>
  state.rooms.find((r) => r.id === id)
export const selectIsLoading = (state: RoomState) => state.loading
```

- [ ] **Step 3: Remove any `any` types**

```bash
cd packages/dashboard && grep -rn ': any' src/ --include='*.ts' --include='*.tsx'
```

Fix each occurrence.

- [ ] **Step 4: Verify and commit**

```bash
bun run typecheck && bun run lint
git add packages/dashboard/src/
git commit -m "refactor(dashboard): tighten TypeScript types and add store selectors"
```

---

## Task 5: Review backend service boundaries

**Files:**

- Refactor: `packages/translator/src/routes/api/`
- Refactor: `packages/translator/src/services/room-config-store.ts`

- [ ] **Step 1: Ensure consistent API error responses**

All error responses must follow: `{ success: false, error: "message" }` with appropriate HTTP status codes. Audit each route handler.

- [ ] **Step 2: Extract Zod validation into shared schemas**

If request body schemas are inline in route definitions, extract to `packages/translator/src/types/room-config-schemas.ts`.

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

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "refactor(repo): Phase 6 code review complete — all quality checks pass"
```

---

## Ship & Review

**User action:** Review the PR diff showing all refactoring changes.

**Success criteria:**

1. `bun run typecheck && bun test && bun run lint` — all pass
2. Component structure follows atomic design
3. No `any` types in dashboard code
4. Shared hooks extracted (no duplicated patterns)
5. Backend error responses consistent
6. All existing functionality unchanged

**Await user approval before proceeding to Phase 7.**
