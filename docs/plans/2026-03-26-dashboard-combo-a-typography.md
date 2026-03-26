# Dashboard Combo A Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the approved `Shantell Sans + Fredoka + Zen Maru Gothic` typography system across the dashboard.

**Architecture:** Keep the existing structural components, but formalize typography into reusable CSS roles so the visual system stays consistent. Update font loading, global role classes, and the highest-value dashboard surfaces first, then extend the same rules through forms, pills, stickers, and helper text.

**Tech Stack:** React 19, Tailwind CSS utilities, Google Fonts, Bun test

---

### Task 1: Load the approved font stack

**Files:**

- Modify: `packages/dashboard/index.html`
- Test: `packages/dashboard/src/phase2-shells.test.tsx`

**Step 1: Write the failing test**

- require `Fredoka` in the dashboard font import
- require `Zen Maru Gothic` in the dashboard font import
- keep `Shantell Sans` in the import

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

**Step 3: Write minimal implementation**

- update the Google Fonts link in `packages/dashboard/index.html`

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

### Task 2: Formalize typography roles in shared styles

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`
- Test: `packages/dashboard/src/phase2-shells.test.tsx`

**Step 1: Write the failing test**

- require body font role to use `Zen Maru Gothic`
- require display font role to use `Shantell Sans`
- require numeric role to use `Fredoka`

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

**Step 3: Write minimal implementation**

- switch the global body font to `Zen Maru Gothic`
- keep `.font-heading` on `Shantell Sans`
- add a dedicated metric class for `Fredoka`
- add a readable body-ui class if needed to make page-level wiring explicit

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

### Task 3: Apply typography roles to room dashboard surfaces

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`
- Modify: `packages/dashboard/src/components/ui/status-pill.tsx`
- Test: `packages/dashboard/src/pages/room-list.test.tsx`

**Step 1: Write the failing test**

- require stat numbers to use the metric font role
- require room metadata to use the readable body font role
- require status pill text to use the display voice

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx packages/dashboard/src/components/ui/status-pill.test.tsx`

**Step 3: Write minimal implementation**

- update room list stat, meta, and status class wiring
- update status pill base class to the approved display voice

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/pages/room-list.test.tsx packages/dashboard/src/components/ui/status-pill.test.tsx`

### Task 4: Extend the same system through forms and shell surfaces

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`
- Modify: `packages/dashboard/src/components/ui/page-shell.tsx`
- Modify: `packages/dashboard/src/components/ui/brutal-input.tsx`
- Modify: `packages/dashboard/src/components/ui/brutal-select.tsx`
- Modify: `packages/dashboard/src/pages/room-create.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.tsx`
- Modify: `packages/dashboard/src/components/ui/webhook-stepper.tsx`
- Test: `packages/dashboard/src/phase2-shells.test.tsx`

**Step 1: Write the failing test**

- require nav blurbs and descriptive copy to use the body-ui role
- require form labels and helper text to use the body-ui role
- require metric and display roles to remain separated

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

**Step 3: Write minimal implementation**

- apply the new role classes consistently to shell, forms, and guide surfaces

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/phase2-shells.test.tsx`

### Task 5: Verify the dashboard package

**Files:**

- Verify only: `packages/dashboard/src/**/*`

**Step 1: Run focused tests**

Run:

- `bun test packages/dashboard/src/pages/room-list.test.tsx`
- `bun test packages/dashboard/src/phase2-shells.test.tsx`

**Step 2: Run package verification**

Run:

- `bun test packages/dashboard/src`
- `bun run --cwd packages/dashboard typecheck`
- `bun run --cwd packages/dashboard lint`
- `bun run dev:dashboard -- --host 127.0.0.1 --port 4173`
