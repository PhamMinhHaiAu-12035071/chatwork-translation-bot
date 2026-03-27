# Dashboard Kawaii Clay Palette Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the dashboard palette so card surfaces and shells feel brighter, cuter, and more clay-like while preserving semantic state clarity and the repo's neubrutalist 3D structure.

**Architecture:** Update the shared dashboard tokens in `packages/dashboard/src/styles/global.css` first, then adjust the dashboard shell tests that encode those tokens and expectations. Keep the color work centralized in shared CSS so route/page components inherit the new look without logic changes.

**Tech Stack:** Bun, TypeScript, React, Tailwind utility classes, shared CSS tokens, Bun test

---

### Task 1: Lock the new palette expectations in tests

**Files:**

- Modify: `packages/dashboard/src/phase2-shells.test.tsx`

**Step 1: Write the failing test assertions**

Update the palette assertions so they expect the new brighter surface token values and any revised background token values needed for the approved design.

Add or revise assertions for:

- refreshed mint / lemon surface tokens
- any brightened companion surfaces such as lilac, peach, sky, blush, cream
- any new inner-shine/clay treatment tokens if they are centralized in CSS

**Step 2: Run the focused test to verify it fails**

Run:

```bash
bun test packages/dashboard/src/phase2-shells.test.tsx
```

Expected: FAIL on the old token values or missing new palette/shine assertions.

**Step 3: Keep the failure scoped**

Confirm the failure is about the expected palette change, not unrelated route logic.

### Task 2: Implement the shared palette token refresh

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`

**Step 1: Update the surface tokens**

Change the dashboard surface tokens to the approved brighter palette:

- move mint toward `#6EE7B7`
- move lemon toward `#FDE68A`
- brighten the supporting lilac, peach, sky, blush, and cream surfaces so they remain cohesive

**Step 2: Retune the page background**

Adjust the background gradient and organic-circle tokens just enough so the brighter surfaces still read clearly against the page.

**Step 3: Add restrained clay-style inner shine**

Add a reusable inner-shine treatment for key surfaces while preserving:

- dark border
- offset brutal shadow
- existing structural radii

Prefer shared tokenized CSS over one-off per-page overrides.

### Task 3: Verify the new palette against the shell components

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`
- Modify: `packages/dashboard/src/layouts/app-layout.tsx` only if a small class adjustment is needed
- Modify: `packages/dashboard/src/pages/room-list.tsx` only if a small class adjustment is needed
- Modify: `packages/dashboard/src/pages/room-create.tsx` only if a small class adjustment is needed
- Modify: `packages/dashboard/src/pages/room-detail.tsx` only if a small class adjustment is needed
- Modify: `packages/dashboard/src/components/organisms/delete-room-confirm-modal.tsx` only if a small class adjustment is needed

**Step 1: Check whether token changes alone are sufficient**

Review the rendered shell/class usage and keep component edits at zero unless a card or shell needs a better token pairing after the palette refresh.

**Step 2: Apply minimal class-level adjustments**

If needed, only adjust theme class usage to preserve hierarchy, for example:

- keep the main content shell neutral enough to frame brighter cards
- keep stat cards feeling brighter than supporting panels
- keep warning/error surfaces distinct from decorative lemon/mint surfaces

**Step 3: Avoid semantic drift**

Do not repurpose semantic status tokens as the general surface palette.

### Task 4: Run focused verification

**Files:**

- Modify: none

**Step 1: Re-run the palette shell test**

Run:

```bash
bun test packages/dashboard/src/phase2-shells.test.tsx
```

Expected: PASS with the updated palette expectations.

**Step 2: Re-run the sidebar copy regression test**

Run:

```bash
bun test packages/dashboard/src/layouts/app-layout.test.tsx
```

Expected: PASS.

**Step 3: Re-run the room list shell test**

Run:

```bash
bun test packages/dashboard/src/pages/room-list.test.tsx
```

Expected: PASS.

### Task 5: Run broader dashboard verification

**Files:**

- Modify: none

**Step 1: Run the dashboard package tests**

Run:

```bash
bun test packages/dashboard/src
```

Expected: PASS.

**Step 2: Run type and lint verification if the palette change touched component code**

Run:

```bash
bun run typecheck
bun run lint
```

Expected: PASS.

### Task 6: Commit the palette refresh

**Files:**

- Modify: all approved implementation files from the tasks above

**Step 1: Review the diff**

Run:

```bash
git diff -- packages/dashboard/src/styles/global.css packages/dashboard/src/layouts/app-layout.tsx packages/dashboard/src/pages/room-list.tsx packages/dashboard/src/pages/room-create.tsx packages/dashboard/src/pages/room-detail.tsx packages/dashboard/src/components/organisms/delete-room-confirm-modal.tsx packages/dashboard/src/phase2-shells.test.tsx packages/dashboard/src/layouts/app-layout.test.tsx
```

Expected: only the approved palette and shell-verification changes are present.

**Step 2: Commit**

Run:

```bash
git add docs/plans/2026-03-28-dashboard-kawaii-clay-palette-design.md docs/plans/2026-03-28-dashboard-kawaii-clay-palette.md packages/dashboard/src/styles/global.css packages/dashboard/src/phase2-shells.test.tsx packages/dashboard/src/layouts/app-layout.tsx packages/dashboard/src/layouts/app-layout.test.tsx packages/dashboard/src/pages/room-list.tsx packages/dashboard/src/pages/room-create.tsx packages/dashboard/src/pages/room-detail.tsx packages/dashboard/src/components/organisms/delete-room-confirm-modal.tsx
git commit -m "feat(dashboard): brighten kawaii clay palette"
```

Expected: commit created with only the planned palette refresh work.
