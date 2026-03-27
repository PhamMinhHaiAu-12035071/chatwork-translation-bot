# Dashboard Room Spotlight Variant Atlas Design

**Date:** 2026-03-27

## Goal

Create a standalone preview playground in `.superpowers/brainstorm` so the room-list return animation can be compared across multiple create/update motion variants before choosing a final dashboard implementation.

## Current Behavior

- `RoomCreatePage` and `RoomDetailPage` both navigate back to the room list with `spotlightRoomId`.
- `RoomListPage` applies the same spotlight treatment to both flows.
- The current spotlight animates `backgroundColor` and `boxShadow` over a relatively long duration, which reads as a stretched glow instead of a sharp neubrutalist confirmation.

## Approved UX Direction

The preview must compare multiple concepts side-by-side, but with a single large playback stage so the user can feel the return flow clearly.

Approved structure:

- Static HTML/CSS/JS playground in `.superpowers/brainstorm`
- Full mini-flow from save action to list return
- Hybrid atlas layout:
  - one large stage for replaying the active variant
  - one variant grid for selecting from many ideas
- Eight curated variants

Approved motion ideas:

1. `Drop-In Classic`
2. `Drop-In + Brutal Spark`
3. `Stamp Slap`
4. `Stamp + Foil Sweep`
5. `Shared Return`
6. `Spotlight Lane`
7. `Spotlight Lane + Spark Accent`
8. `Halo Slab Wildcard`

Approved evaluation rules:

- Prefer semantic clarity over abstract decoration.
- `Create` and `Update` do not need to share the same effect.
- Motion should preserve the repo's neubrutalist 3D character.
- Favor `transform`/`opacity`-driven motion and avoid long paint-heavy glow treatments.
- Include a reduced-motion mode.

## Scope

In scope:

- A static brainstorm playground outside the production dashboard bundle
- Full mini-flow preview for both `Create` and `Update`
- Eight selectable motion variants
- Controls for replay, reduced motion, and playback speed
- A README that explains the variants and selection criteria

Out of scope:

- Shipping any of these variants into the real dashboard
- Refactoring `RoomListPage`
- Figma production assets
- A final implementation decision

## Design

### Preview Architecture

Use four files in `.superpowers/brainstorm`:

- `room-spotlight-variants.html`
- `room-spotlight-variants.css`
- `room-spotlight-variants.js`
- `README.md`

The preview stays dependency-free so it can be opened directly without booting the Bun/Vite app.

### Layout

The HTML playground should have two main areas:

1. `Top Stage`
   - left: mini editor panel with `Create` and `Update` trigger buttons
   - center: return lane for shared-element and motion-path style variants
   - right: room-list grid with one target card and surrounding context cards
2. `Variant Atlas`
   - selectable tile per variant
   - variant tags such as `Create-heavy`, `Update-heavy`, and `Wildcard`

### Variant Semantics

- `Create` variants should emphasize arrival, insertion, and “new item” energy.
- `Update` variants should emphasize confirmation, ownership, and “this exact card changed”.
- `Shared Return` should explicitly show a cause-and-effect bridge from the save action to the list card.
- `Spotlight Lane` variants should reduce surrounding-card presence instead of relying on a glowing target.
- `Spark` and `Foil` accents should stay graphic and chunky, not particle-heavy or soft/fairy-like.

### Controls

The preview should expose:

- `Replay Create`
- `Replay Update`
- `Auto Cycle`
- `Reduced Motion`
- `Speed` toggle: `0.75x`, `1x`, `1.25x`
- `Show Guides`

### Selection Criteria

Each variant should be understandable through:

- how quickly the user reads `new` vs `updated`
- whether the card still feels brutal, tactile, and dimensional
- whether the surrounding list supports the target instead of competing with it
- whether the motion looks plausible to reproduce in React + Motion

## Rationale

This approach separates exploration from production code. The preview can go wide on ideas without destabilizing the dashboard, and the final choice can be made from an explicit, replayable motion atlas instead of from abstract discussion alone.
