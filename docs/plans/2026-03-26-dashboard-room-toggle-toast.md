# Dashboard Room Toggle Toast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the dashboard room toggle toast include the affected room name and explicit enabled/paused status.

**Architecture:** Keep the change local to `RoomListPage`. Add a tiny pure helper for toast copy, use it inside the toggle handler, and lock the behavior with a focused unit test plus the existing page source test.

**Tech Stack:** React 19, TypeScript, Bun test, Zustand

---

### Task 1: Lock the toast copy with a failing test

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.test.tsx`
- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Step 1: Write the failing test**

Add assertions for a pure helper such as:

```ts
expect(getRoomToggleToastMessage('Sakura Desk JP', false)).toBe('"Sakura Desk JP" is now enabled')
expect(getRoomToggleToastMessage('Sakura Desk JP', true)).toBe('"Sakura Desk JP" is now paused')
```

Also update the source-level assertion so it no longer accepts the generic `Room enabled` / `Room disabled` toast.

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected: FAIL because the helper or approved copy does not exist yet.

### Task 2: Implement the minimal toast-copy change

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Step 1: Write minimal implementation**

Add a pure helper:

```ts
export function getRoomToggleToastMessage(roomName: string, currentlyEnabled: boolean): string {
  return `"${roomName}" is now ${currentlyEnabled ? 'paused' : 'enabled'}`
}
```

Update `handleToggle` to accept the room name and call the helper after `toggleRoom(id)`.

Update the toggle button click handler to pass `room.destinationRoomName`.

**Step 2: Run test to verify it passes**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected: PASS

### Task 3: Verify dashboard package health

**Files:**

- Modify: none

**Step 1: Run targeted tests**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected: PASS

**Step 2: Run dashboard typecheck**

Run: `bunx tsc --noEmit -p packages/dashboard/tsconfig.json`

Expected: exit code 0

**Step 3: Run dashboard lint**

Run: `bun run lint`

Expected: exit code 0 from `packages/dashboard`
