# Dashboard Create Room List Spotlight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Return users to the dashboard list after room creation, place the new room first, and briefly spotlight the new card.

**Architecture:** Keep the behavior in the dashboard client. `RoomCreatePage` will navigate back to `/` with route state that identifies the created room, `useRoomStore` will normalize room ordering to newest-first, and `RoomListPage` will consume the spotlight id and render a short-lived neubrutalist highlight using existing `framer-motion` infrastructure.

**Tech Stack:** React 19, React Router, Zustand, Framer Motion, Tailwind CSS, Bun test, TypeScript

---

### Task 1: Lock the approved redirect, ordering, and spotlight behavior with failing tests

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.test.tsx`
- Modify: `packages/dashboard/src/stores/room-store.test.ts`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`
- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/stores/room-store.ts`
- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Step 1: Write the failing tests**

Update the source-level expectations in `room-create.test.tsx` so they no longer accept detail-page navigation and instead expect navigation back to `/` with route state carrying the created room id.

Add a store test that proves:

```ts
expect(useRoomStore.getState().rooms.map((room) => room.id)).toEqual(['room-new', 'room-old'])
```

for a create path and for a fetched list whose raw API payload is not already newest-first.

Add room-list tests that assert the page source contains a transient spotlight state, timeout cleanup, and room-id-aware card treatment.

**Step 2: Run tests to verify they fail**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/stores/room-store.test.ts packages/dashboard/src/pages/room-list.test.tsx`

Expected: FAIL because the current create flow still navigates to detail, the store appends new rooms, and the list page has no spotlight logic.

### Task 2: Implement create redirect and deterministic newest-first ordering

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/stores/room-store.ts`

**Step 1: Write minimal implementation**

In `room-create.tsx`, replace:

```ts
void navigate(`/rooms/${result.data.id}`)
```

with a redirect back to the list:

```ts
void navigate('/', {
  state: { spotlightRoomId: result.data.id },
})
```

In `room-store.ts`, add a small helper that sorts by `createdAt` descending and apply it to:

- `fetchRooms`
- `createRoom`
- `updateRoom`
- `enableRoom`
- `disableRoom`

Use a shared helper instead of mixing `prepend` and `append` branches.

**Step 2: Run targeted tests to verify they pass**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/stores/room-store.test.ts`

Expected: PASS

### Task 3: Implement transient neubrutalist spotlight behavior in the room list

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`

**Step 1: Add transient spotlight state**

Use router location state to read `spotlightRoomId`, copy it into local component state, and clear it with a timeout around 2400ms. After consuming it once, replace the current history entry so the state does not replay on future renders.

**Step 2: Apply the highlight treatment**

Update the room card wrapper so the matching card:

- gets a temporary `New`/`Fresh` sticker
- animates background and shadow from a bright accent treatment back to the normal card theme
- respects reduced-motion mode by falling back to a static highlight then clear

Keep the animation scoped to color/shadow emphasis and avoid large scale or bounce.

**Step 3: Run the spotlight tests**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected: PASS

### Task 4: Verify dashboard package health

**Files:**

- Modify: none

**Step 1: Run the focused dashboard tests**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/stores/room-store.test.ts packages/dashboard/src/pages/room-list.test.tsx`

Expected: PASS

**Step 2: Run dashboard typecheck**

Run: `bunx tsc --noEmit -p packages/dashboard/tsconfig.json`

Expected: exit code 0

**Step 3: Run full repo lint**

Run: `bun run lint`

Expected: exit code 0

**Step 4: Run full repo tests if the change touches shared assumptions**

Run: `bun test`

Expected: PASS

### Task 5: Commit the dashboard UX change

**Files:**

- Modify: all files touched above

**Step 1: Create the commit**

Run:

```bash
git add packages/dashboard/src/pages/room-create.tsx \
  packages/dashboard/src/pages/room-create.test.tsx \
  packages/dashboard/src/pages/room-list.tsx \
  packages/dashboard/src/pages/room-list.test.tsx \
  packages/dashboard/src/stores/room-store.ts \
  packages/dashboard/src/stores/room-store.test.ts
git commit -m "feat(repo): return new rooms to list with spotlight highlight"
```

Expected: commit succeeds after hooks.
