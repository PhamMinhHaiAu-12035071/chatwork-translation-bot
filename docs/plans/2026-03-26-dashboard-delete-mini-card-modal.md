# Dashboard Delete Mini Card Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the native room delete confirmation with a custom neubrutal mini-card modal that confirms the exact room being deleted.

**Architecture:** Keep the delete flow local to the room list page. Add one focused modal component that renders fixed-position over the dashboard, receives the selected room as props, and calls back into the existing store deletion + toast flow. Reuse the current typography, button, pill, and card language instead of introducing a generic modal system.

**Tech Stack:** React 19, TypeScript, Bun test, react-dom/server, Tailwind utility classes, existing dashboard CSS variables and UI primitives

---

### Task 1: Add failing tests for the custom delete modal direction

**Files:**

- Create: `packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`

**Step 1: Write the failing test**

- add a modal component test that expects static markup to include:
  - `role="dialog"`
  - `aria-modal="true"`
  - `Cancel`
  - `Confirm Delete`
  - room preview fields such as `Room ID`, `Provider`, and `Style`
- update the room list source-contract test to expect:
  - `DeleteRoomConfirmModal`
  - selected-room modal state
  - no `window.confirm`

**Step 2: Run test to verify it fails**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- FAIL because the modal component does not exist yet and `room-list.tsx` still contains `window.confirm`

**Step 3: Write minimal implementation**

- create an empty modal component shell with the expected exported name
- adjust test imports if needed

**Step 4: Run test to verify partial progress**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- the missing-file failure is gone
- markup and source-contract expectations still fail until later tasks

**Step 5: Commit**

```bash
git add packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx
git commit -m "test: add delete modal coverage"
```

### Task 2: Build the mini-card delete modal component

**Files:**

- Create: `packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx`
- Modify: `packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

**Step 1: Write the failing test**

- extend the modal component test to require:
  - sticker label
  - `Delete {roomName}?` heading
  - short warning copy
  - mini room preview fields
  - `Cancel` and `Confirm Delete`

**Step 2: Run test to verify it fails**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

Expected:

- FAIL because the component does not yet render the approved structure

**Step 3: Write minimal implementation**

- implement `DeleteRoomConfirmModal`
- keep it prop-driven:
  - `room`
  - `isOpen`
  - `isDeleting`
  - `onCancel`
  - `onConfirm`
- reuse existing visual primitives where practical:
  - `StatusPill`
  - current button class system
  - current font classes

**Step 4: Run test to verify it passes**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

Expected:

- PASS

**Step 5: Commit**

```bash
git add packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx
git commit -m "feat: add delete mini-card modal"
```

### Task 3: Add modal styling hooks that match the dashboard visual system

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`
- Modify: `packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

**Step 1: Write the failing test**

- require modal-specific class hooks in the component markup for:
  - overlay
  - modal shell
  - warning copy
  - mini room preview
  - action row

**Step 2: Run test to verify it fails**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

Expected:

- FAIL because the visual hooks are not fully wired

**Step 3: Write minimal implementation**

- add the modal visual rules to `global.css`
- keep the palette aligned with existing variables:
  - cream base
  - blush/lilac tint
  - dark border
  - pink-red destructive CTA
- keep motion restrained and compatible with reduced motion

**Step 4: Run test to verify it passes**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`

Expected:

- PASS

**Step 5: Commit**

```bash
git add packages/dashboard/src/styles/global.css packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx
git commit -m "style: add dashboard delete modal theme"
```

### Task 4: Replace `window.confirm` in the room list with the custom modal

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`

**Step 1: Write the failing test**

- update the room list test to expect:
  - imported `DeleteRoomConfirmModal`
  - local selected-room modal state
  - `window.confirm` removed
  - delete button opening the modal instead of deleting immediately

**Step 2: Run test to verify it fails**

Run:

- `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- FAIL because the source still contains the native confirm flow

**Step 3: Write minimal implementation**

- add selected-room state to `RoomListPage`
- clicking room-card `Delete` stores that room in modal state
- modal `Cancel` clears the state
- modal `Confirm Delete` calls:
  - `deleteRoom(id)`
  - existing success toast
  - modal close

**Step 4: Run test to verify it passes**

Run:

- `bun test packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- PASS

**Step 5: Commit**

```bash
git add packages/dashboard/src/pages/room-list.tsx packages/dashboard/src/pages/room-list.test.tsx
git commit -m "feat: replace native delete confirm with custom modal"
```

### Task 5: Add dialog accessibility and close behavior

**Files:**

- Modify: `packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx`
- Modify: `packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx`
- Modify: `packages/dashboard/src/pages/room-list.tsx`

**Step 1: Write the failing test**

- require dialog semantics and close affordances in the component test:
  - `aria-labelledby`
  - `aria-describedby`
  - `Cancel`
  - backdrop close hook
  - `Esc` close hook markers in source

**Step 2: Run test to verify it fails**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- FAIL because the accessibility and close behavior hooks are incomplete

**Step 3: Write minimal implementation**

- wire `aria-labelledby` and `aria-describedby`
- add close-on-backdrop-click behavior
- add `Esc` close behavior
- set initial focus to `Cancel`
- keep implementation local and lightweight; do not build a generic modal framework

**Step 4: Run test to verify it passes**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- PASS

**Step 5: Commit**

```bash
git add packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.tsx
git commit -m "feat: add accessible dashboard delete modal behavior"
```

### Task 6: Final verification

**Files:**

- Verify only: `packages/dashboard/src/**/*`

**Step 1: Run targeted tests**

Run:

- `bun test packages/dashboard/src/components/ui/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- PASS

**Step 2: Run dashboard package verification**

Run:

- `bun test packages/dashboard/src`
- `bun run --cwd packages/dashboard typecheck`
- `bun run --cwd packages/dashboard lint`

Expected:

- all commands PASS

**Step 3: Run manual local verification**

Run:

- `bun run dev:dashboard -- --host 127.0.0.1 --port 4173`

Expected:

- Vite reports ready
- manual browser check confirms:
  - delete opens custom modal
  - modal shows correct room preview
  - `Cancel` closes cleanly
  - `Confirm Delete` removes the correct room
  - toast still appears

**Step 4: Commit**

```bash
git add packages/dashboard/src
git commit -m "feat: ship dashboard delete mini-card modal"
```
