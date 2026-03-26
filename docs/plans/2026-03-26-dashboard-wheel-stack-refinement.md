# Dashboard Wheel Stack Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine dashboard stat numbers so they animate like a soft wheel instead of a hard-clipped blur stack.

**Architecture:** Keep the existing `SlideStackNumber` API, but change its internals to use a masked wheel viewport and directional spring motion. Tests should lock the new wheel contract at the component level so the room pages do not need broader changes.

**Tech Stack:** React 19, Framer Motion, Bun test, Tailwind CSS utilities

---

### Task 1: Lock the new wheel contract

**Files:**

- Modify: `packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

**Step 1: Write the failing test**

- require a wheel viewport marker in the rendered markup
- require a soft-mask marker in the rendered markup
- require a helper that returns forward and reverse wheel motion metadata

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

**Step 3: Write minimal implementation**

- add the wheel-motion helper
- add wheel viewport structure to the component

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

### Task 2: Replace hard clipping with wheel motion

**Files:**

- Modify: `packages/dashboard/src/components/ui/slide-stack-number.tsx`

**Step 1: Write the failing test**

- require spring-style directional motion data for increment and decrement
- require reduced-motion fallback to keep the simple value render path

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

**Step 3: Write minimal implementation**

- remove blur-based entry and exit states
- add mask-image styling for soft top and bottom fade
- add spring transitions and light wheel-like perspective tilt

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

### Task 3: Verify dashboard safety

**Files:**

- Verify only: `packages/dashboard/src/pages/room-list.tsx`

**Step 1: Run focused verification**

Run: `bun test packages/dashboard/src/components/ui/slide-stack-number.test.tsx`

**Step 2: Run package verification**

Run:

- `bun test packages/dashboard/src`
- `bun run --cwd packages/dashboard typecheck`
- `bun run --cwd packages/dashboard lint`
- `bun run dev:dashboard -- --host 127.0.0.1 --port 4173`
