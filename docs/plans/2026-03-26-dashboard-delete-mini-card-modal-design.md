# Dashboard Delete Mini Card Modal Design

## Goal

Replace the browser-native delete confirmation in the dashboard room list with a custom modal that:

- matches the existing neubrutalism 3D visual system
- clearly shows which room is being deleted
- keeps the interaction simple: `Cancel` and `Confirm Delete`

## Current Problem

`packages/dashboard/src/pages/room-list.tsx` still uses `window.confirm(...)` for room deletion.

That breaks the dashboard experience in four ways:

- it ignores the established typography and color system
- it feels visually detached from the room cards
- it does not reinforce which room is being deleted beyond the browser string
- it lowers perceived quality at the highest-risk action on the page

## Chosen Direction

Use a `Mini Card Confirm` modal.

This is a contextual destructive modal with three layers:

1. a branded modal shell
2. short warning copy
3. a mini room preview card showing the exact room being deleted

The modal does not introduce extra friction such as typing the room name, dragging a slider, or holding a button. The user already initiates deletion from a specific room card, so the right UX move is strong contextual confirmation rather than theatrical confirmation mechanics.

## Structure

When the user clicks `Delete` on a room card:

- the room list page opens a custom modal instead of calling `window.confirm`
- the modal renders as a centered card over a warm dimmed overlay
- the top section shows:
  - a small sticker label such as `Delete Check`
  - a large title: `Delete Sakura Desk JP?`
  - a short warning line: `This removes the room from your dashboard immediately. This action cannot be undone.`
- the middle section shows a mini room preview card with:
  - room name
  - status pill
  - room id
  - provider
  - style
- the bottom section shows exactly two actions:
  - `Cancel`
  - `Confirm Delete`

The mini card is informational only. It does not contain edit or toggle controls.

## Visual Direction

The modal should feel like part of the existing dashboard, not a separate component library.

### Shell

- use the current border language: thick dark border with offset shadow
- keep rounded corners consistent with existing cards and buttons
- use a cream base with gentle lilac or blush tint
- avoid turning the whole modal red; reserve stronger danger color for the destructive CTA and warning emphasis

### Typography

- sticker and title: `Shantell Sans`
- body copy and metadata: `Zen Maru Gothic`
- optional compact numeric emphasis: `Fredoka` only if needed, but this modal should not depend on metrics

### Mini Card Preview

- visually derived from the existing room card
- flatter and calmer than the full card so the modal title and CTAs remain the main focal points
- no tilt
- no action buttons

## Motion

The modal should animate with restraint.

- overlay fades in quickly
- modal scales from slightly smaller to full size with a soft pop
- no bounce-heavy or playful destructive animation
- on reduced-motion systems, fall back to a near-instant fade

The room card preview inside the modal should remain static.

## CTA Design

Two buttons only:

- `Cancel`
  - lighter visual weight
  - cream or white background
  - same neubrutal border and shadow language
- `Confirm Delete`
  - stronger visual weight
  - pink-red danger gradient derived from the current dashboard danger button colors
  - white or near-white text

This keeps visual balance while making the destructive action unambiguous.

## Interaction Rules

- clicking a room card’s `Delete` button opens the modal with that room’s data
- initial focus lands on `Cancel`
- `Esc` closes the modal
- clicking the backdrop closes the modal
- clicking `Cancel` closes the modal
- clicking `Confirm Delete` triggers the existing room deletion flow and success toast
- after canceling, focus returns to the originating room’s `Delete` button
- after successful deletion, focus should land on the next sensible control in the list

## Accessibility

The modal must behave like a real dialog:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` wired to the title
- `aria-describedby` wired to the warning copy
- focus is trapped inside the modal while open
- keyboard navigation works with `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Esc`

The mini room preview is static information, not an interactive nested card.

## Technical Direction

Use a dedicated React component for the modal rather than spreading dialog markup across the page.

Recommended component:

- `packages/dashboard/src/components/ui/delete-room-confirm-modal.tsx`

Recommended integration point:

- `packages/dashboard/src/pages/room-list.tsx`

Recommended approach:

- room list holds the selected room in local state
- modal receives the selected room and close/confirm handlers
- existing store deletion and toast behavior remain the source of truth

No portal is required initially. A fixed-position overlay rendered from the room list page is sufficient for this dashboard surface.

## Testing Strategy

The dashboard test suite currently leans on Bun source and static-markup checks rather than full browser interaction tests, so the implementation should be validated with pragmatic coverage:

- add a co-located modal component test that renders the modal to static markup and verifies:
  - title
  - warning copy
  - room preview fields
  - `Cancel` and `Confirm Delete`
  - dialog accessibility attributes
- update the room list page test to verify:
  - the custom modal component is wired in
  - the native `window.confirm` call is removed
  - selected-room deletion state is managed in component source
- preserve full package verification:
  - `bun test packages/dashboard/src`
  - `bun run --cwd packages/dashboard typecheck`
  - `bun run --cwd packages/dashboard lint`

## Non-Goals

This design does not include:

- room-name re-entry confirmation
- lever, hold, slider, stamp, or other theatrical confirm mechanics
- a shared modal framework for unrelated dashboard flows
- backend deletion changes

The scope is intentionally narrow: ship a better delete confirmation that feels native to the dashboard.
