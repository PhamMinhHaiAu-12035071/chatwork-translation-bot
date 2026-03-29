# Dashboard UI Polish — 10/10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift dashboard UI from 7.9/10 to 10/10 by fixing typography semantics, color tokens, layout boldness, room card color stability, animation expressiveness, and mobile navigation.

**Architecture:** All changes are in `packages/dashboard/src/` only — no backend, no API, no schema. Pure visual-layer improvements: CSS variables, Tailwind classes, framer-motion props, and one new utility function with its test.

**Tech Stack:** React 19 · TypeScript 5.4 · Tailwind v4 · Framer Motion · Bun test runner · `renderToStaticMarkup` for render tests

**Design doc:** `docs/2026-03-28-dashboard-ui-polish-10-10-design.md`

---

## File Map

| File                                                        | Change                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/styles/global.css`                  | `.brutal-input` font fix · `--error` token · `delete-modal-pop-in` spring · `.page-divider-brutal` class |
| `packages/dashboard/src/components/layout/ambient-orbs.tsx` | Add 2 orbs · increase blur                                                                               |
| `packages/dashboard/src/components/layout/page-shell.tsx`   | Add `<div className="page-divider-brutal">`                                                              |
| `packages/dashboard/src/layouts/app-layout.tsx`             | Page transition props · mobile nav flex classes                                                          |
| `packages/dashboard/src/pages/room-list.tsx`                | Export `getRoomCardIndex` · use hash instead of `index % 6`                                              |
| `packages/dashboard/src/pages/room-list.test.tsx`           | Test `getRoomCardIndex` stability and distribution                                                       |
| `packages/dashboard/src/pages/room-detail.tsx`              | Webhook URL code: `font-['Shantell_Sans',cursive]` → `font-mono`                                         |

---

## Task 1: Fix `--error` Color Token

Separate the semantic error color from the decorative hot-pink. Currently both are `#d44470`.

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`

- [ ] **Step 1: Change `--error` in `:root`**

In `global.css`, find line 10 and change:

```css
/* before */
--error: #d44470;

/* after */
--error: #c0392b;
```

- [ ] **Step 2: Run typecheck + lint to confirm no breakage**

```bash
cd packages/dashboard && bun run typecheck && bun run lint
```

Expected: no errors (this is a CSS-only change, TS is unaffected).

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/styles/global.css
git commit -m "fix(dashboard): separate --error token from pink-accent (#c0392b vs #d44470)"
```

---

## Task 2: Fix Input Typography — Body Font in Form Fields

`.brutal-input` currently applies `Shantell Sans` (handwriting font) to inputs. Typed user data is
hard to scan in a handwriting font. Fix to `Zen Maru Gothic`.

Separately, the webhook URL in `room-detail.tsx` uses `Shantell Sans` — a URL is technical content
and needs monospace.

**Files:**

- Modify: `packages/dashboard/src/styles/global.css` (`.brutal-input` font)
- Modify: `packages/dashboard/src/pages/room-detail.tsx` (webhook URL code element)

- [ ] **Step 1: Fix `.brutal-input` font in `global.css`**

Find the `.brutal-input` rule (around line 205) and change:

```css
/* before */
.brutal-input {
  border: 3px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 3px 3px 0 var(--border);
  font-family: 'Shantell Sans', cursive;
  font-weight: 400;
  transition:
    box-shadow 160ms ease,
    border-color 160ms ease;
}

/* after */
.brutal-input {
  border: 3px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 3px 3px 0 var(--border);
  font-family: 'Zen Maru Gothic', sans-serif;
  font-weight: 400;
  transition:
    box-shadow 160ms ease,
    border-color 160ms ease;
}
```

- [ ] **Step 2: Fix webhook URL code element in `room-detail.tsx`**

Find the `<code>` element inside the webhook URL display block (around line 353–358):

```tsx
/* before */
<code
  className="min-w-0 flex-1 truncate font-['Shantell_Sans',cursive] text-sm font-medium text-[var(--text-primary)]"
  title={webhookUrl}
>
  {webhookUrl}
</code>

/* after */
<code
  className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-[var(--text-primary)]"
  title={webhookUrl}
>
  {webhookUrl}
</code>
```

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass (these are class-name changes only, existing tests check for `theme-card-cream` etc not font classes).

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/styles/global.css packages/dashboard/src/pages/room-detail.tsx
git commit -m "fix(dashboard): use Zen Maru Gothic in inputs, font-mono for webhook URL code"
```

---

## Task 3: Stable Room Card Colors via ID Hash

Room cards currently cycle by `index % 6` — adding or removing a room shifts every card's color.
Fix: derive color from a hash of `room.id` so each room always gets the same color.

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`

- [ ] **Step 1: Write the failing test for `getRoomCardIndex`**

Add to `packages/dashboard/src/pages/room-list.test.tsx` (inside the existing `describe` block):

```typescript
import { getRoomCardIndex } from '~/pages/room-list'

describe('getRoomCardIndex', () => {
  it('returns the same index for the same room ID every time (stable identity)', () => {
    const id = 'abc-123-xyz'
    const first = getRoomCardIndex(id)
    expect(getRoomCardIndex(id)).toBe(first)
    expect(getRoomCardIndex(id)).toBe(first)
  })

  it('returns a value in range [0, 5]', () => {
    const ids = ['room-1', 'room-2', 'abc', 'xyz-999', '', 'Z', 'hello-world']
    for (const id of ids) {
      const idx = getRoomCardIndex(id)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThanOrEqual(5)
    }
  })

  it('distributes across at least 4 of 6 buckets for varied IDs', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `room-uuid-${String(i)}`)
    const seen = new Set(ids.map(getRoomCardIndex))
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('returns 0 for empty string without throwing', () => {
    expect(() => getRoomCardIndex('')).not.toThrow()
    const idx = getRoomCardIndex('')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run the test and confirm it FAILS (function not defined yet)**

```bash
cd packages/dashboard && bun test --reporter=verbose 2>&1 | grep -A 3 getRoomCardIndex
```

Expected: error containing "getRoomCardIndex is not a function" or import error.

- [ ] **Step 3: Implement `getRoomCardIndex` in `room-list.tsx`**

In `packages/dashboard/src/pages/room-list.tsx`, replace:

```typescript
// before — these two const arrays and the raw index usage
const cardThemeByIndex = [
  'theme-card-lilac',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-peach',
  'theme-card-blush',
] as const

const tiltByIndex = ['left', 'flat', 'right', 'left', 'flat', 'right'] as const
```

With:

```typescript
const cardThemeByIndex = [
  'theme-card-lilac',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-peach',
  'theme-card-blush',
] as const

const tiltByIndex = ['left', 'flat', 'right', 'left', 'flat', 'right'] as const

/**
 * Maps a room ID to a stable theme index [0–5] via polynomial hash.
 * Same ID always gets the same color regardless of list position.
 */
export function getRoomCardIndex(roomId: string): number {
  let h = 0
  for (let i = 0; i < roomId.length; i++) {
    h = (h * 31 + roomId.charCodeAt(i)) | 0
  }
  return Math.abs(h) % cardThemeByIndex.length
}
```

- [ ] **Step 4: Update the room grid map to use `getRoomCardIndex` instead of `index`**

In the `rooms.map((room, index) => ...)` block, find where `cardTheme` and `tilt` are derived:

```typescript
// before (around line 329)
const cardTheme = cardThemeByIndex[index % cardThemeByIndex.length] ?? 'theme-card-lilac'
const tilt = tiltByIndex[index % tiltByIndex.length] ?? 'flat'

// after
const roomIdx = getRoomCardIndex(room.id)
const cardTheme = cardThemeByIndex[roomIdx] ?? 'theme-card-lilac'
const tilt = tiltByIndex[roomIdx] ?? 'flat'
```

Also update the `motion.div` transition delay — currently uses `index * 0.04`. This stagger is
purely cosmetic and should stay as-is (use `index` for stagger, `roomIdx` for color only):

```typescript
// transition delay stays as index * 0.04 — stagger by list position is fine
transition={{
  duration: reducedMotion ? 0 : isSpotlighted ? 2.2 : 0.18,
  delay: index * 0.04,
  ease: 'easeOut',
}}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd packages/dashboard && bun test --reporter=verbose 2>&1 | grep -A 3 getRoomCardIndex
```

Expected: all 4 `getRoomCardIndex` tests pass.

- [ ] **Step 6: Run full test suite**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/pages/room-list.tsx packages/dashboard/src/pages/room-list.test.tsx
git commit -m "feat(dashboard): stable room card colors via ID hash (getRoomCardIndex)"
```

---

## Task 4: Enhanced Ambient Orbs

Current orbs use `blur-[1px]` and `blur-[2px]` — nearly invisible. Increase to soft atmospheric blobs.
Add 2 more orbs for better depth coverage.

**Files:**

- Modify: `packages/dashboard/src/components/layout/ambient-orbs.tsx`

- [ ] **Step 1: Replace all orb definitions**

Replace the entire file content of `packages/dashboard/src/components/layout/ambient-orbs.tsx`:

```tsx
const orbClassNames = [
  // Top-left — soft matcha green, large focal orb
  'absolute -left-16 -top-8 h-48 w-48 rounded-full bg-[var(--organic-circle-1)]/60 blur-[32px]',
  // Top-right — warm amber, medium
  'absolute right-24 top-20 h-36 w-36 rounded-full bg-[var(--organic-circle-2)]/55 blur-[24px]',
  // Bottom-right — soft green, large
  'absolute -bottom-8 -right-10 h-52 w-52 rounded-full bg-[var(--organic-circle-3)]/50 blur-[40px]',
  // Center-left — lilac accent orb, soft
  'absolute left-[15%] top-[40%] h-28 w-28 rounded-full bg-[var(--card-lilac)]/50 blur-[28px]',
  // Bottom-center — warm peach glow
  'absolute bottom-[10%] left-[45%] h-24 w-24 rounded-full bg-[var(--card-peach)]/45 blur-[20px]',
] as const

export function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbClassNames.map((className, index) => (
        <div
          key={index}
          className={className}
          style={{
            animation: `float-orb ${String(6 + index * 1.2)}s ease-in-out infinite`,
            animationDelay: `${String(index * 0.8)}s`,
          }}
        />
      ))}
    </div>
  )
}
```

Note: `float-orb` keyframe is already defined in `global.css`. The staggered delays and varied
durations make the orbs move at different rates, creating organic parallax depth.

- [ ] **Step 2: Run tests**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass (orbs component has no dedicated test, just render tests that check parent layout).

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/layout/ambient-orbs.tsx
git commit -m "fix(dashboard): enhance ambient orbs — larger blur, 5 orbs with staggered float"
```

---

## Task 5: PageShell — Add Neubrutalism Ruling Divider

A bold dashed ruling between the page header and content area transforms the layout from "box of text"
to editorial composition. This is the key change for Layout & Composition score.

**Files:**

- Modify: `packages/dashboard/src/styles/global.css` (new `.page-divider-brutal` class)
- Modify: `packages/dashboard/src/components/layout/page-shell.tsx` (insert divider element)

- [ ] **Step 1: Add `.page-divider-brutal` to `global.css`**

Add before the `@keyframes float-orb` block (after the `.room-meta` rule, around line 476):

```css
/* ── PageShell ruling divider ── */
.page-divider-brutal {
  height: 3px;
  margin: 0.25rem 0;
  background: repeating-linear-gradient(
    90deg,
    var(--border) 0px,
    var(--border) 14px,
    transparent 14px,
    transparent 20px
  );
  border-radius: 2px;
  opacity: 0.55;
}
```

- [ ] **Step 2: Insert the divider in `page-shell.tsx`**

Replace the entire `page-shell.tsx` content:

```tsx
import type { ReactNode } from 'react'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface PageShellProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function PageShell({ eyebrow, title, description, actions, children }: PageShellProps) {
  return (
    <div className="relative space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <StickerLabel tone="warning" tilt="flat">
            {eyebrow}
          </StickerLabel>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-extrabold md:text-5xl">{title}</h1>
            <p className="font-ui-body max-w-2xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="page-divider-brutal" aria-hidden />
      <div className="pt-2">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass. If any test checks for `space-y-6` class on the outer `<div>`, update the
expected value to `space-y-4` (the outer wrapper now uses `space-y-4` instead of `space-y-6`).

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/styles/global.css packages/dashboard/src/components/layout/page-shell.tsx
git commit -m "feat(dashboard): add dashed ruling divider to PageShell header (editorial accent)"
```

---

## Task 6: Mobile Navigation — Horizontal Pill Row

Below `lg` (1024px), the sidebar stacks above the main content. The three nav items form a tall
vertical list before any content appears. Convert to a horizontal scrollable row on mobile.

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Update nav container and NavLink in `app-layout.tsx`**

Replace the `<nav>` element and its `<NavLink>` wrapper:

```tsx
// before
<nav className="space-y-5">
  {navItems.map((item) => (
    <NavLink key={item.to} to={item.to} className="block">

// after
<nav className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:space-y-5 lg:overflow-visible lg:pb-0">
  {navItems.map((item) => (
    <NavLink key={item.to} to={item.to} className="block shrink-0 min-w-[8.5rem] lg:min-w-0">
```

- [ ] **Step 2: Hide the candy-thumb indicator on mobile (it uses absolute positioning relative to the nav column)**

The `.nav-candy-thumb` indicator is positioned with `absolute -left-[22px]` — this only makes sense
in the vertical sidebar column. Wrap it with a `lg:block hidden` guard:

```tsx
// before
{
  isActive ? (
    <motion.div
      className="nav-candy-thumb absolute -left-[22px] top-1/2 h-[86%]"
      layoutId="nav-indicator"
      style={{ y: '-50%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    />
  ) : null
}

// after
{
  isActive ? (
    <motion.div
      className="nav-candy-thumb absolute -left-[22px] top-1/2 h-[86%] hidden lg:block"
      layoutId="nav-indicator"
      style={{ y: '-50%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    />
  ) : null
}
```

- [ ] **Step 3: Run tests**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass. The `app-layout.test.tsx` renders a route and checks for nav classes — if it
checks for `space-y-5` on `<nav>`, update expected to match the new class string.

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): horizontal mobile nav below lg breakpoint"
```

---

## Task 7: Expressive Page Transition

Replace the generic `x: 20` slide with a neubrutalism "card placed on desk" motion:
slight Y lift + microscale + subtle rotation settle.

**Files:**

- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Update `motion.main` transition props**

Find the `<motion.main>` element (around line 102) and update its initial/animate/transition:

```tsx
// before
<motion.main
  key={location.pathname}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className="relative"
>

// after
<motion.main
  key={location.pathname}
  initial={{ opacity: 0, y: 10, scale: 0.99, rotate: -0.4 }}
  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
  className="relative"
>
```

- [ ] **Step 2: Run tests**

```bash
cd packages/dashboard && bun test
```

Expected: all tests pass (this is a prop change on a `motion.main` element; tests use `renderToStaticMarkup` which strips framer-motion to a plain `<main>` so no snapshot impact).

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): expressive page transition — rotate settle + custom easing"
```

---

## Task 8: Delete Modal Spring Animation

Replace the generic `scale(0.95)` pop-in with a spring-overshoot animation matching the rest of the app.

**Files:**

- Modify: `packages/dashboard/src/styles/global.css`

- [ ] **Step 1: Update `delete-modal-shell` animation duration and `delete-modal-pop-in` keyframe**

Find the `.delete-modal-shell` rule (around line 514) and update the animation property:

```css
/* before */
.delete-modal-shell {
  /* ... other props unchanged ... */
  animation: delete-modal-pop-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* after — same cubic-bezier spring, longer to let the overshoot breathe */
.delete-modal-shell {
  /* ... other props unchanged ... */
  animation: delete-modal-pop-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Then update the keyframe itself (around line 595):

```css
/* before */
@keyframes delete-modal-pop-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* after */
@keyframes delete-modal-pop-in {
  from {
    opacity: 0;
    transform: scale(0.92) rotate(-1.2deg) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg) translateY(0);
  }
}
```

- [ ] **Step 2: Run full test suite and checks**

```bash
cd packages/dashboard && bun test && bun run typecheck && bun run lint
```

Expected: all pass. This is CSS-only. Typecheck and lint are unaffected.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/styles/global.css
git commit -m "fix(dashboard): delete modal uses spring pop-in with rotation (matching app motion language)"
```

---

## Final Verification

- [ ] **Run complete definition-of-done check from project root**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: zero errors, zero warnings in lint.

- [ ] **Manual visual smoke-check checklist**

```
[ ] Typing in BrutalInput → text renders in Zen Maru Gothic (rounded, not handwriting)
[ ] Room Detail webhook URL → monospace font
[ ] Error state on any BrutalInput → warm red border (#c0392b), not hot pink
[ ] Error toast → warm red
[ ] Delete confirmation button → still hot pink (#d44470) — unchanged, correct
[ ] Dashboard with 3+ rooms → each room card has stable color (refresh doesn't change it)
[ ] Add a room → existing rooms keep their colors
[ ] Page navigation → subtle rotate-settle transition on each page
[ ] Delete room modal opens → springs in with rotation overshoot
[ ] PageShell (Dashboard, New Room, Room Detail) → dashed ruling below description
[ ] Background → 5 soft atmospheric orbs visible as gentle color blobs
[ ] Mobile (< 1024px) → nav items in horizontal scroll row, not tall vertical list
[ ] Desktop (≥ 1024px) → nav unchanged, candy-thumb indicator still visible
```

---

## Self-Review

**Spec coverage check:**

- ✅ Typography fix (`.brutal-input` font, webhook URL code) → Task 2
- ✅ Error color semantic separation → Task 1
- ✅ Stable room card colors → Task 3
- ✅ Enhanced ambient atmosphere → Task 4
- ✅ Layout editorial accent (ruling divider) → Task 5
- ✅ Mobile navigation → Task 6
- ✅ Expressive page transition → Task 7
- ✅ Modal spring animation → Task 8

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N". All code blocks are complete.

**Type consistency:** `getRoomCardIndex` is named consistently across Task 3 steps 1, 3, 4, and test file. `cardThemeByIndex` and `tiltByIndex` arrays are referenced in step 4 after being defined in step 3 — consistent.
