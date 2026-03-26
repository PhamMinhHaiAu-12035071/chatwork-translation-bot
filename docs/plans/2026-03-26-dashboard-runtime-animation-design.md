# Dashboard Runtime Animation Design

## Goal

Apply the approved motion language from the brainstorm previews into the real dashboard UI:

- `Pixel Scatter` for changing status and action labels
- `Slide Stack` for stat numbers
- number motion must move forward on increment and reverse on decrement

## Scope

Primary scope:

- `packages/dashboard/src/pages/room-list.tsx`
- room status pill text: `Live` / `Paused`
- room action button text: `Pause` / `Enable`
- dashboard stat values: `Total Rooms`, `Active`, `Awaiting Webhook`

Secondary scope:

- `packages/dashboard/src/pages/room-detail.tsx`
- apply the same `Pixel Scatter` treatment to status labels that actually change there

## Chosen Translation From Preview To App

### Pixel Scatter

Use a reusable React component that:

- splits a label into characters
- animates outgoing characters with offset, blur, rotation, and opacity loss
- animates incoming characters from a tighter reverse offset
- keeps layout stable with a fixed inline-grid stage and parent footprint constraints

Important implementation choice:

- offsets must be deterministic, not random, to avoid SSR or hydration mismatches

### Slide Stack

Use a reusable stat number component that:

- remembers the previous value
- derives direction from `next - previous`
- slides the old value out and the new value in on the same footprint
- uses upward travel for increment and downward travel for decrement

Important implementation choice:

- animate the displayed whole value, not per-digit odometer logic, to keep the dashboard readable and the implementation low-risk

## UX Constraints

- no card height jump when labels change
- status pills and buttons keep their existing footprint
- respect reduced-motion preference with immediate text/value swap
- do not add GSAP; use the already-installed `framer-motion`

## Testing Strategy

Because the dashboard package currently uses Bun + static/source-oriented tests instead of DOM interaction tests:

- add helper-level tests for motion direction and deterministic character scatter data
- add source/markup contract tests to ensure room list and room detail wire in the new animated components
- preserve existing page tests and update them only where the rendered structure changes
