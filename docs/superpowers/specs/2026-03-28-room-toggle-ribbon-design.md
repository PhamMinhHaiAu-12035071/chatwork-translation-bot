# Room Toggle + Ribbon — Design Spec

**Version:** 1.0
**Date:** 2026-03-28
**Prepared by:** AI-assisted (Claude Sonnet 4.6)
**Status:** Approved — ready for implementation

---

## Objective

Replace the redundant pair of `StatusPill` (read-only status) + `Pause/Enable` button (action) on each room card in the Dashboard room list with a single **toggle + ribbon** unit that conveys state _and_ acts as the interactive control. Reduces visual clutter from 3 footer buttons → 2, and removes duplicate status info from the card header.

## Scope

**In scope:**

- `packages/dashboard/src/pages/room-list.tsx` — room card layout
- New atom: `packages/dashboard/src/components/atoms/room-status-toggle.tsx`
- New atom: `packages/dashboard/src/components/atoms/status-ribbon.tsx`
- `packages/dashboard/src/styles/global.css` — 2 new CSS tokens

**Out of scope:**

- API layer, Zustand store, toast messages — no changes
- `BrutalCard`, `StickerLabel`, `PixelScatterText` — not modified
- Any page other than `room-list.tsx`
- Spotlight animation — unchanged

## Non-Goals

- Ripple / background color transition on toggle — **not included**
- Optimistic UI — toggle waits for API confirmation (current behaviour preserved)
- Changes to room create/edit forms

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

All existing `room-list` tests pass. New atoms have their own test files co-located.

---

## UI/UX Design

### Card Layout — Before vs After

**Before:**

```
┌─────────────────────────────────────────┐
│  Room Name              [Live / Paused] │  ← StatusPill (read-only)
│  Room ID: 123                           │
│  Provider / Style info                  │
│  [Edit]  [Pause / Enable]  [Delete]     │  ← 3 buttons
└─────────────────────────────────────────┘
```

**After:**

```
┌─────────────────────────────────────────┐
│  ╭─Live─╮                   [●────]     │  ← StatusRibbon + Toggle
│  Room Name                              │    (ribbon tilts per state)
│  Room ID: 123                           │
│  Provider / Style info                  │
│  [Edit]                    [Delete]     │  ← 2 buttons
└─────────────────────────────────────────┘
```

### Component: `RoomStatusToggle`

**Visual spec (Option 11 — Hybrid Clay):**

| Property          | Enabled                                          | Disabled                                 |
| ----------------- | ------------------------------------------------ | ---------------------------------------- |
| Track background  | `#4ADE80`                                        | `#D1D5DB`                                |
| Track border      | `3px solid #1a1a2e`                              | `3px solid #1a1a2e`                      |
| Track shadow      | `3px 3px 0 #16a34a`                              | `3px 3px 0 #1a1a2e`                      |
| Track inner shine | `inset 0 2px 6px rgba(255,255,255,0.45)`         | `inset 0 2px 6px rgba(255,255,255,0.60)` |
| Thumb             | White clay circle, `border: 2.5px solid #1a1a2e` | same                                     |
| Thumb position    | `left: 30px`                                     | `left: 2px`                              |
| Thumb transition  | `left 230ms cubic-bezier(0.16, 1, 0.3, 1)`       | —                                        |
| Track size        | `54px × 28px`                                    | —                                        |
| Thumb size        | `18px × 18px`                                    | —                                        |

**Loading state:**

- `opacity: 0.5` on the toggle wrap
- `pointer-events: none` / `disabled` attribute
- No spinner — keep it simple

**Accessibility:**

- `<button role="switch" aria-checked={enabled} aria-label={enabled ? 'Pause room' : 'Enable room'}>`
- Keyboard: `Space` / `Enter` triggers toggle

**Interface:**

```typescript
interface RoomStatusToggleProps {
  enabled: boolean
  loading: boolean
  onToggle: () => void
}
```

### Component: `StatusRibbon`

**Visual spec (sticker pill with state-based tilt):**

| Property        | Live                                     | Paused                           |
| --------------- | ---------------------------------------- | -------------------------------- |
| Background      | `#bbf7d0`                                | `#f3f4f6`                        |
| Text color      | `#14532d`                                | `#4b5563`                        |
| Border          | `2.5px solid #16a34a`                    | `2.5px solid #1a1a2e`            |
| Shadow          | `2px 2px 0 #16a34a` + clay shine         | `2px 2px 0 #1a1a2e` + clay shine |
| Clay shine      | `inset 0 2px 4px rgba(255,255,255,0.55)` | same                             |
| Dot background  | `#22c55e`                                | `#d1d5db`                        |
| Dot border      | `#15803d`                                | `#9ca3af`                        |
| Tilt angle      | `rotate(-4deg)`                          | `rotate(2deg)`                   |
| Tilt transition | `320ms cubic-bezier(0.34, 1.4, 0.64, 1)` | —                                |
| Text            | `"Live"`                                 | `"Paused"`                       |
| Text animation  | fade + scale on change (`190ms`)         | —                                |
| Dot             | 7×7px circle, static (no glow)           | —                                |

**`prefers-reduced-motion`:** tilt transition becomes instant (no spring). Color transitions kept.

**Interface:**

```typescript
interface StatusRibbonProps {
  enabled: boolean
  className?: string
}
```

### New CSS Tokens

Add to `packages/dashboard/src/styles/global.css` `:root`:

```css
--toggle-on: #4ade80;
--toggle-on-shadow: #16a34a;
```

---

## Technical Approach

### 1. New atom — `room-status-toggle.tsx`

```
packages/dashboard/src/components/atoms/
  room-status-toggle.tsx
  room-status-toggle.test.tsx
```

Pure presentational component. Receives `enabled`, `loading`, `onToggle`. No store access.

Uses Tailwind for layout, `global.css` classes for toggle track/thumb styling (new `.tog-track`, `.tog-thumb` classes added to global.css OR inline Tailwind with arbitrary values).

### 2. New atom — `status-ribbon.tsx`

```
packages/dashboard/src/components/atoms/
  status-ribbon.tsx
  status-ribbon.test.tsx
```

Pure presentational. Receives `enabled`. Tilt via CSS `transform: rotate()` — two fixed classes `.ribbon-live` (rotate -4deg) and `.ribbon-paused` (rotate +2deg) with the spring `transition` defined in global CSS. Text animation: brief `@keyframes ribbon-text-out` (opacity 1→0, scale 1→0.85, 190ms) triggered by adding `.ribbon-change` class on `enabled` change via React `useEffect` + `setTimeout` to remove the class after 190ms. No Framer Motion dependency for these atoms.

### 3. Update `room-list.tsx`

- **Remove** `<StatusPill>` import and usage in room card header
- **Remove** the `Pause/Enable` `<button>` from the card footer
- **Add** `<StatusRibbon enabled={room.enabled} />` in the card header (left of room name row)
- **Add** `<RoomStatusToggle enabled={room.enabled} loading={roomToggleAction.loading} onToggle={() => handleToggle(...)} />` in the card header (right side, replacing StatusPill)
- Footer becomes: `[Edit]` + `[Delete]` only

### 4. Loading state

`roomToggleAction.loading` is already computed per-toggle via `useAsyncAction`. Pass it as `loading` prop. The toggle wraps itself in `disabled` + `opacity-50 pointer-events-none` when loading.

---

## State / Data Flow

No changes to state or data model. All existing logic in `handleToggle`, `enableRoom`, `disableRoom`, `roomToggleAction` is preserved unchanged.

```
User clicks toggle
  → handleToggle(room.id, room.destinationRoomName, room.enabled)
  → roomToggleAction.execute(...)          ← existing
    → disableRoom(id) / enableRoom(id)    ← existing store actions
  → toast(message, 'info')               ← existing
  → store updates room.enabled           ← existing
  → React re-renders card                ← new: toggle + ribbon reflect new state
```

---

## Business Rules

- Toggle click while `loading = true` → no-op (button disabled)
- Toggle click triggers existing `handleToggle` — identical API call, toast, error handling
- Room with `enabled: true` → toggle ON (mint), ribbon "Live" tilted -4°
- Room with `enabled: false` → toggle OFF (gray), ribbon "Paused" tilted +2°

---

## Error Handling

No change from current. If API fails:

- `toast(result.error, 'error')` fires (existing)
- Store state reverts to pre-toggle value (existing)
- Toggle and ribbon snap back to previous state automatically via store re-render

---

## Accessibility

| Element        | Requirement                                                     |
| -------------- | --------------------------------------------------------------- |
| Toggle         | `role="switch"`, `aria-checked`, `aria-label` dynamic           |
| Ribbon         | `aria-hidden="true"` (decorative — toggle carries the semantic) |
| Loading        | `aria-disabled="true"` on toggle when loading                   |
| Reduced motion | Tilt spring disabled; color transitions kept                    |

---

## Testing

### `room-status-toggle.test.tsx`

- Renders in enabled state (mint background)
- Renders in disabled state (gray background)
- Calls `onToggle` on click
- Does NOT call `onToggle` when `loading=true`
- Has correct `aria-checked` values

### `status-ribbon.test.tsx`

- Renders "Live" when `enabled=true`
- Renders "Paused" when `enabled=false`
- Has correct tilt class per state

### `room-list.tsx` — existing tests

- `getRoomToggleToastMessage` tests unchanged
- `getDeleteRoomToastMessage` tests unchanged
- Snapshot / render tests: update to reflect removed StatusPill + Pause button

---

## Acceptance Criteria

1. Room card shows toggle (top-right) + ribbon sticker (top-left of name row) — no StatusPill, no Pause/Enable button
2. Toggle ON = mint `#4ADE80` track + white clay thumb right-aligned
3. Toggle OFF = gray `#D1D5DB` track + white clay thumb left-aligned
4. Ribbon tilts -4° when Live, +2° when Paused, spring transition
5. Clicking toggle calls existing `handleToggle` logic — toast + store update identical to current
6. While API in-flight: toggle is disabled (opacity + pointer-events), ribbon unchanged
7. `prefers-reduced-motion`: no tilt spring, color transitions still apply
8. `bun test && bun run typecheck && bun run lint` all pass

---

## Open Risks

None — this is a pure UI refactor. No API changes, no data model changes, no auth changes.

---

## Out of Scope (Future Backlog)

- Ripple / card background color transition on toggle
- Optimistic UI (immediate toggle + revert on error)
- Animated dot glow on ribbon
- Toggle on other pages / forms

---

## Explicit Decisions Made

| Decision                                          | Source         | Notes                                      |
| ------------------------------------------------- | -------------- | ------------------------------------------ |
| Toggle style = Clay iOS (Option 01)               | user-confirmed | After previewing 11 options                |
| Ribbon = StickerLabel pill + tilt (Option 11)     | user-confirmed | Hybrid of 01 + 10                          |
| No ripple animation                               | user-confirmed | "không cần vụ background color transition" |
| Toggle ON color = `#4ADE80` Electric Mint         | user-confirmed | "Electric Mint Green (Recommended)"        |
| Card keeps 6 theme colors                         | user-confirmed | Ripple feedback only → removed entirely    |
| Dot static (no glow)                              | user-confirmed | "reverse đi thấy apply vô xấu quá"         |
| Loading = freeze + pulse (simplified to disabled) | user-confirmed | —                                          |
