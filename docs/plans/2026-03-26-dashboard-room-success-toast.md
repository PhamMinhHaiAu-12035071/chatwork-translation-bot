# Dashboard Room Success Toast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make room create and room update success toasts include the affected room name.

**Architecture:** Keep the change local to the two page modules that emit these toasts. Add tiny pure helpers for the create and update success strings, use submitted form data to build the messages, and lock the behavior with focused tests.

**Tech Stack:** React 19, TypeScript, Bun test, React Hook Form, Zustand

---

### Task 1: Lock create and update toast copy with failing tests

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.test.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.test.tsx`
- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.tsx`

**Step 1: Write the failing tests**

Add pure helper assertions:

```ts
expect(getRoomCreatedToastMessage('Sakura Desk JP')).toBe(
  '"Sakura Desk JP" was created successfully',
)
expect(getRoomUpdatedToastMessage('Sakura Desk JP')).toBe(
  '"Sakura Desk JP" was updated successfully',
)
```

Update source-level assertions so they no longer accept the generic success strings.

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/pages/room-detail.test.tsx`

Expected: FAIL because the helpers and approved copy do not exist yet.

### Task 2: Implement the minimal success-toast change

**Files:**

- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.tsx`

**Step 1: Write minimal implementation**

Add:

```ts
export function getRoomCreatedToastMessage(roomName: string): string {
  return `"${roomName}" was created successfully`
}
```

and:

```ts
export function getRoomUpdatedToastMessage(roomName: string): string {
  return `"${roomName}" was updated successfully`
}
```

Use `data.destinationRoomName` in each submit handler when calling `toast(...)`.

**Step 2: Run tests to verify they pass**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/pages/room-detail.test.tsx`

Expected: PASS

### Task 3: Verify dashboard package health

**Files:**

- Modify: none

**Step 1: Run targeted tests**

Run: `bun test packages/dashboard/src/pages/room-create.test.tsx packages/dashboard/src/pages/room-detail.test.tsx`

Expected: PASS

**Step 2: Run dashboard typecheck**

Run: `bunx tsc --noEmit -p packages/dashboard/tsconfig.json`

Expected: exit code 0

**Step 3: Run dashboard lint**

Run: `bun run lint`

Expected: exit code 0 from `packages/dashboard`
