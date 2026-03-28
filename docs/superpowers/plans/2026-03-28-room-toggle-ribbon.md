# Room Toggle + Ribbon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `StatusPill` + `Pause/Enable` button in each room card with a clay iOS toggle and a tilting ribbon sticker.

**Architecture:** Two new pure presentational atoms (`StatusRibbon`, `RoomStatusToggle`) with CSS classes in `global.css`. `room-list.tsx` swaps out the old elements and wires the existing `handleToggle` logic to the new toggle's `onToggle` prop. No changes to the store, API layer, or toast logic.

**Tech Stack:** React 18 (renderToStaticMarkup for tests), Bun test, TypeScript strict, Tailwind CSS, global.css custom classes.

---

## File Map

| File                                                                  | Action | Responsibility                                                                                       |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/styles/global.css`                            | Modify | Add 2 CSS tokens + 9 new classes for toggle track/thumb + ribbon                                     |
| `packages/dashboard/src/components/atoms/status-ribbon.tsx`           | Create | Pure presentational ribbon sticker, receives `enabled`                                               |
| `packages/dashboard/src/components/atoms/status-ribbon.test.tsx`      | Create | 6 tests for ribbon rendering                                                                         |
| `packages/dashboard/src/components/atoms/room-status-toggle.tsx`      | Create | Pure presentational clay toggle, receives `enabled`, `loading`, `onToggle`                           |
| `packages/dashboard/src/components/atoms/room-status-toggle.test.tsx` | Create | 6 tests for toggle rendering + source-scan for click wiring                                          |
| `packages/dashboard/src/pages/room-list.tsx`                          | Modify | Swap StatusPill → StatusRibbon; swap Pause button → RoomStatusToggle; remove PixelScatterText import |
| `packages/dashboard/src/pages/room-list.test.tsx`                     | Modify | Drop stale assertions about removed elements; add assertions for new ones                            |

---

## Task 1 — CSS tokens and component classes

**Files:**

- Modify: `packages/dashboard/src/styles/global.css` (`:root` block at line 3, append after line 575)

- [ ] **Step 1: Add the two new CSS tokens to `:root`**

  Open `packages/dashboard/src/styles/global.css`. Inside the `:root { ... }` block (currently ends around line 33), add these two lines after `--organic-circle-3: #e5f0d8;`:

  ```css
  --toggle-on: #4ade80;
  --toggle-on-shadow: #16a34a;
  ```

- [ ] **Step 2: Append toggle + ribbon CSS classes at the end of the file**

  Add the following block at the very end of `global.css`, after the existing `@media (prefers-reduced-motion: reduce)` block (currently lines 570–575):

  ```css
  /* ── Room Status Toggle ── */
  .tog-track {
    position: relative;
    width: 54px;
    height: 28px;
    border-radius: 999px;
    border: 3px solid var(--border);
    background: #d1d5db;
    box-shadow:
      3px 3px 0 var(--border),
      inset 0 2px 6px rgba(255, 255, 255, 0.6);
    transition:
      background 260ms ease,
      box-shadow 240ms ease;
    cursor: pointer;
  }

  .tog-track-on {
    background: var(--toggle-on);
    box-shadow:
      3px 3px 0 var(--toggle-on-shadow),
      inset 0 2px 6px rgba(255, 255, 255, 0.45);
  }

  .tog-thumb {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    border: 2.5px solid var(--border);
    box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.08);
    transition: left 230ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tog-thumb-on {
    left: 30px;
  }

  /* ── Status Ribbon ── */
  .ribbon-base {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 2.5px solid var(--border);
    border-radius: 999px;
    font-family: 'Shantell Sans', cursive;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow:
      2px 2px 0 var(--border),
      inset 0 2px 4px rgba(255, 255, 255, 0.55);
    transform-origin: left center;
    transition:
      background 260ms ease,
      box-shadow 240ms ease,
      color 200ms ease,
      transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1);
    align-self: flex-start;
  }

  .ribbon-live {
    background: #bbf7d0;
    color: #14532d;
    border-color: #16a34a;
    box-shadow:
      2px 2px 0 #16a34a,
      inset 0 2px 4px rgba(255, 255, 255, 0.5);
    transform: rotate(-4deg);
  }

  .ribbon-paused {
    background: #f3f4f6;
    color: #4b5563;
    box-shadow:
      2px 2px 0 var(--border),
      inset 0 2px 4px rgba(255, 255, 255, 0.5);
    transform: rotate(2deg);
  }

  .ribbon-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2px solid currentColor;
    transition:
      background 260ms ease,
      border-color 260ms ease;
  }

  .ribbon-live .ribbon-dot {
    background: #22c55e;
    border-color: #15803d;
  }

  .ribbon-paused .ribbon-dot {
    background: #d1d5db;
    border-color: #9ca3af;
  }

  @media (prefers-reduced-motion: reduce) {
    .ribbon-base {
      transition:
        background 200ms ease,
        color 200ms ease,
        box-shadow 200ms ease;
    }

    .ribbon-live,
    .ribbon-paused {
      transform: none;
    }
  }
  ```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

  ```bash
  bun test && bun run typecheck && bun run lint
  ```

  Expected: `550 pass, 0 fail`. (CSS changes carry no test surface on their own.)

- [ ] **Step 4: Commit**

  ```bash
  git add packages/dashboard/src/styles/global.css
  git commit -m "feat(dashboard): add toggle + ribbon CSS tokens and classes"
  ```

---

## Task 2 — `StatusRibbon` atom (TDD)

**Files:**

- Create: `packages/dashboard/src/components/atoms/status-ribbon.test.tsx`
- Create: `packages/dashboard/src/components/atoms/status-ribbon.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `packages/dashboard/src/components/atoms/status-ribbon.test.tsx`:

  ```tsx
  import { describe, expect, it } from 'bun:test'
  import { createElement } from 'react'
  import { renderToStaticMarkup } from 'react-dom/server'
  import { StatusRibbon } from '~/components/atoms/status-ribbon'

  describe('StatusRibbon', () => {
    it('renders "Live" when enabled', () => {
      const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
      expect(html).toContain('Live')
    })

    it('renders "Paused" when not enabled', () => {
      const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: false }))
      expect(html).toContain('Paused')
    })

    it('applies ribbon-live class and not ribbon-paused when enabled', () => {
      const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
      expect(html).toContain('ribbon-live')
      expect(html).not.toContain('ribbon-paused')
    })

    it('applies ribbon-paused class and not ribbon-live when not enabled', () => {
      const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: false }))
      expect(html).toContain('ribbon-paused')
      expect(html).not.toContain('ribbon-live')
    })

    it('is aria-hidden so the toggle carries the semantic meaning', () => {
      const html = renderToStaticMarkup(createElement(StatusRibbon, { enabled: true }))
      expect(html).toContain('aria-hidden="true"')
    })

    it('forwards optional className onto the wrapper', () => {
      const html = renderToStaticMarkup(
        createElement(StatusRibbon, { enabled: true, className: 'custom-cls' }),
      )
      expect(html).toContain('custom-cls')
    })
  })
  ```

- [ ] **Step 2: Run to verify all 6 tests fail**

  ```bash
  bun test packages/dashboard/src/components/atoms/status-ribbon.test.tsx
  ```

  Expected: `0 pass, 6 fail` with `Cannot find module '~/components/atoms/status-ribbon'`.

- [ ] **Step 3: Implement the component**

  Create `packages/dashboard/src/components/atoms/status-ribbon.tsx`:

  ```tsx
  interface StatusRibbonProps {
    enabled: boolean
    className?: string
  }

  export function StatusRibbon({ enabled, className }: StatusRibbonProps) {
    return (
      <span
        aria-hidden="true"
        className={['ribbon-base', enabled ? 'ribbon-live' : 'ribbon-paused', className ?? '']
          .join(' ')
          .trim()}
      >
        <span className="ribbon-dot" />
        {enabled ? 'Live' : 'Paused'}
      </span>
    )
  }
  ```

- [ ] **Step 4: Run to verify all 6 tests pass**

  ```bash
  bun test packages/dashboard/src/components/atoms/status-ribbon.test.tsx
  ```

  Expected: `6 pass, 0 fail`.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/dashboard/src/components/atoms/status-ribbon.tsx \
          packages/dashboard/src/components/atoms/status-ribbon.test.tsx
  git commit -m "feat(dashboard): add StatusRibbon atom"
  ```

---

## Task 3 — `RoomStatusToggle` atom (TDD)

**Files:**

- Create: `packages/dashboard/src/components/atoms/room-status-toggle.test.tsx`
- Create: `packages/dashboard/src/components/atoms/room-status-toggle.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `packages/dashboard/src/components/atoms/room-status-toggle.test.tsx`:

  ```tsx
  import { describe, expect, it } from 'bun:test'
  import { createElement } from 'react'
  import { renderToStaticMarkup } from 'react-dom/server'
  import { RoomStatusToggle } from '~/components/atoms/room-status-toggle'

  describe('RoomStatusToggle', () => {
    it('renders tog-track-on and tog-thumb-on when enabled', () => {
      const html = renderToStaticMarkup(
        createElement(RoomStatusToggle, { enabled: true, loading: false, onToggle: () => {} }),
      )
      expect(html).toContain('tog-track-on')
      expect(html).toContain('tog-thumb-on')
    })

    it('does not render tog-track-on or tog-thumb-on when not enabled', () => {
      const html = renderToStaticMarkup(
        createElement(RoomStatusToggle, { enabled: false, loading: false, onToggle: () => {} }),
      )
      expect(html).not.toContain('tog-track-on')
      expect(html).not.toContain('tog-thumb-on')
    })

    it('sets aria-checked="true" when enabled', () => {
      const html = renderToStaticMarkup(
        createElement(RoomStatusToggle, { enabled: true, loading: false, onToggle: () => {} }),
      )
      expect(html).toContain('aria-checked="true"')
    })

    it('sets aria-checked="false" when not enabled', () => {
      const html = renderToStaticMarkup(
        createElement(RoomStatusToggle, { enabled: false, loading: false, onToggle: () => {} }),
      )
      expect(html).toContain('aria-checked="false"')
    })

    it('renders as disabled with opacity-50 and aria-disabled when loading', () => {
      const html = renderToStaticMarkup(
        createElement(RoomStatusToggle, { enabled: false, loading: true, onToggle: () => {} }),
      )
      expect(html).toContain('disabled')
      expect(html).toContain('opacity-50')
      expect(html).toContain('aria-disabled="true"')
    })

    it('wires onToggle to the button click and uses role="switch"', async () => {
      const source = await Bun.file(new URL('./room-status-toggle.tsx', import.meta.url)).text()
      expect(source).toContain('onClick={onToggle}')
      expect(source).toContain('disabled={loading}')
      expect(source).toContain('role="switch"')
    })
  })
  ```

- [ ] **Step 2: Run to verify all 6 tests fail**

  ```bash
  bun test packages/dashboard/src/components/atoms/room-status-toggle.test.tsx
  ```

  Expected: `0 pass, 6 fail` with `Cannot find module '~/components/atoms/room-status-toggle'`.

- [ ] **Step 3: Implement the component**

  Create `packages/dashboard/src/components/atoms/room-status-toggle.tsx`:

  ```tsx
  interface RoomStatusToggleProps {
    enabled: boolean
    loading: boolean
    onToggle: () => void
  }

  export function RoomStatusToggle({ enabled, loading, onToggle }: RoomStatusToggleProps) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Pause room' : 'Enable room'}
        aria-disabled={loading ? true : undefined}
        disabled={loading}
        onClick={onToggle}
        className={['cursor-pointer border-none bg-transparent p-0', loading ? 'opacity-50' : '']
          .join(' ')
          .trim()}
      >
        <div className={['tog-track', enabled ? 'tog-track-on' : ''].join(' ').trim()}>
          <div className={['tog-thumb', enabled ? 'tog-thumb-on' : ''].join(' ').trim()} />
        </div>
      </button>
    )
  }
  ```

- [ ] **Step 4: Run to verify all 6 tests pass**

  ```bash
  bun test packages/dashboard/src/components/atoms/room-status-toggle.test.tsx
  ```

  Expected: `6 pass, 0 fail`.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/dashboard/src/components/atoms/room-status-toggle.tsx \
          packages/dashboard/src/components/atoms/room-status-toggle.test.tsx
  git commit -m "feat(dashboard): add RoomStatusToggle atom"
  ```

---

## Task 4 — Update `room-list.test.tsx` to reflect new structure

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.test.tsx`

The existing test file has two tests that assert on elements being removed. Update them before touching the source so they drive the implementation.

- [ ] **Step 1: Replace the "keeps a stable room-card header footprint" test**

  Find and replace the entire test block (lines 92–97):

  **Old:**

  ```tsx
  it('keeps a stable room-card header footprint when the status label changes', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('flex-1 min-w-0')
    expect(source).toContain('min-w-24 justify-center shrink-0')
  })
  ```

  **New:**

  ```tsx
  it('uses StatusRibbon and RoomStatusToggle in the card header, not StatusPill', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('StatusRibbon')
    expect(source).toContain('RoomStatusToggle')
    expect(source).toContain('roomToggleAction.loading')
    expect(source).not.toContain('min-w-24 justify-center shrink-0')
  })
  ```

- [ ] **Step 2: Update the "wires the approved runtime motion primitives" test**

  Find and replace lines 99–107:

  **Old:**

  ```tsx
  it('wires the approved runtime motion primitives into the dashboard list surface', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('PixelScatterText')
    expect(source).toContain('SlideStackNumber')
    expect(source).toContain('reserveText="Paused"')
    expect(source).toContain('reserveText="Enable"')
    expect(source).toContain('minimumDigits={2}')
  })
  ```

  **New:**

  ```tsx
  it('keeps SlideStackNumber for stat metrics and removes PixelScatterText from room cards', async () => {
    const source = await Bun.file(new URL('./room-list.tsx', import.meta.url)).text()

    expect(source).toContain('SlideStackNumber')
    expect(source).toContain('minimumDigits={2}')
    expect(source).not.toContain('reserveText="Paused"')
    expect(source).not.toContain('reserveText="Enable"')
  })
  ```

- [ ] **Step 3: Run tests to verify the two updated tests now fail (source hasn't changed yet)**

  ```bash
  bun test packages/dashboard/src/pages/room-list.test.tsx
  ```

  Expected: `6 pass, 2 fail`. The two newly updated tests fail because `room-list.tsx` still has the old structure. All other 6 tests still pass.

- [ ] **Step 4: Commit the test changes**

  ```bash
  git add packages/dashboard/src/pages/room-list.test.tsx
  git commit -m "test(dashboard): update room-list tests for toggle+ribbon refactor"
  ```

---

## Task 5 — Update `room-list.tsx`

**Files:**

- Modify: `packages/dashboard/src/pages/room-list.tsx`

- [ ] **Step 1: Swap imports — remove PixelScatterText, add the two new atoms**

  Find:

  ```tsx
  import { PixelScatterText } from '~/components/animation/pixel-scatter-text'
  ```

  Replace with:

  ```tsx
  import { RoomStatusToggle } from '~/components/atoms/room-status-toggle'
  import { StatusRibbon } from '~/components/atoms/status-ribbon'
  ```

  (The `StatusPill` import on line 10 stays — it is still used in the empty-state card at line 238.)

- [ ] **Step 2: Replace the card header section**

  Find the entire `<div className="flex items-start justify-between gap-2">` block (the one inside the room card, roughly lines 312–335), which currently looks like:

  ```tsx
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0 space-y-1">
      {isSpotlighted ? (
        <StickerLabel tone="warning" tilt="right">
          New
        </StickerLabel>
      ) : null}
      <div className="font-heading text-lg font-bold leading-tight">{room.destinationRoomName}</div>
      <div className="font-ui-body text-xs text-[var(--text-secondary)]">
        {`Room ID: ${String(room.originalRoomId)}`}
      </div>
    </div>
    <StatusPill
      tone={room.enabled ? 'success' : 'neutral'}
      className="min-w-24 justify-center shrink-0"
    >
      <PixelScatterText value={room.enabled ? 'Live' : 'Paused'} reserveText="Paused" />
    </StatusPill>
  </div>
  ```

  Replace with:

  ```tsx
  <div className="space-y-2">
    <div className="flex items-start justify-between gap-2">
      <StatusRibbon enabled={room.enabled} />
      <RoomStatusToggle
        enabled={room.enabled}
        loading={roomToggleAction.loading}
        onToggle={() => {
          void handleToggle(room.id, room.destinationRoomName, room.enabled)
        }}
      />
    </div>
    <div className="min-w-0 space-y-1">
      {isSpotlighted ? (
        <StickerLabel tone="warning" tilt="right">
          New
        </StickerLabel>
      ) : null}
      <div className="font-heading text-lg font-bold leading-tight">{room.destinationRoomName}</div>
      <div className="font-ui-body text-xs text-[var(--text-secondary)]">
        {`Room ID: ${String(room.originalRoomId)}`}
      </div>
    </div>
  </div>
  ```

- [ ] **Step 3: Replace the card footer — remove the Pause/Enable button**

  Find the `<div className="flex flex-wrap gap-2 pt-1">` section (roughly lines 349–385), which currently has Edit + Pause/Enable + Delete:

  ```tsx
  <div className="flex flex-wrap gap-2 pt-1">
    <button
      type="button"
      onClick={() => {
        void navigate(`/rooms/${room.id}`)
      }}
      className="brutal-button theme-button-sky px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
    >
      Edit
    </button>
    <button
      type="button"
      onClick={() => {
        void handleToggle(room.id, room.destinationRoomName, room.enabled)
      }}
      className={[
        'brutal-button px-4 py-1.5 font-heading text-xs font-bold',
        room.enabled ? 'theme-button-gold text-[var(--border)]' : 'theme-button-violet text-white',
      ].join(' ')}
    >
      <PixelScatterText value={room.enabled ? 'Pause' : 'Enable'} reserveText="Enable" />
    </button>
    <button
      type="button"
      onClick={() => {
        setSelectedRoom(room)
      }}
      className="brutal-button theme-button-pink px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
    >
      Delete
    </button>
  </div>
  ```

  Replace with:

  ```tsx
  <div className="flex flex-wrap gap-2 pt-1">
    <button
      type="button"
      onClick={() => {
        void navigate(`/rooms/${room.id}`)
      }}
      className="brutal-button theme-button-sky px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
    >
      Edit
    </button>
    <button
      type="button"
      onClick={() => {
        setSelectedRoom(room)
      }}
      className="brutal-button theme-button-pink px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
    >
      Delete
    </button>
  </div>
  ```

- [ ] **Step 4: Run the room-list tests to confirm all 9 pass**

  ```bash
  bun test packages/dashboard/src/pages/room-list.test.tsx
  ```

  Expected: `9 pass, 0 fail`.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/dashboard/src/pages/room-list.tsx
  git commit -m "feat(dashboard): replace StatusPill+Pause button with toggle+ribbon in room cards"
  ```

---

## Task 6 — Final verification

- [ ] **Step 1: Run the full Definition of Done command**

  ```bash
  bun test && bun run typecheck && bun run lint
  ```

  Expected output:

  ```
  562 pass   ← 550 existing + 6 StatusRibbon + 6 RoomStatusToggle
  0 fail
  [✓] typecheck
  [✓] lint
  ```

- [ ] **Step 2: Commit if not already clean**

  If any auto-fixes were applied by the pre-commit hook, stage and commit:

  ```bash
  git status   # should be clean — all commits were made per task
  ```

---

## Acceptance Checklist

Map from spec acceptance criteria to plan coverage:

| Criterion                                                       | Covered by                                |
| --------------------------------------------------------------- | ----------------------------------------- |
| Toggle top-right + ribbon top-left — no StatusPill/Pause button | Task 5                                    |
| Toggle ON = mint `#4ADE80` track                                | Task 1 (`.tog-track-on`)                  |
| Toggle OFF = gray `#D1D5DB` track + thumb left                  | Task 1 (`.tog-track`, `.tog-thumb`)       |
| Ribbon tilts −4° Live, +2° Paused, spring                       | Task 1 (`.ribbon-live`, `.ribbon-paused`) |
| Toggle click calls existing `handleToggle`                      | Task 5 step 2 (`onToggle` prop)           |
| Loading: toggle disabled + opacity                              | Task 3 (component) + Task 5 (wired)       |
| `prefers-reduced-motion`: no tilt spring                        | Task 1 (reduced-motion block)             |
| All tests pass                                                  | Task 6                                    |
