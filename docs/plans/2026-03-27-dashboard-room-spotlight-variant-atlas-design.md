# Dashboard Room Spotlight Preview Pack Design

**Date:** 2026-03-27

## Goal

Create a standalone preview pack in `.superpowers/brainstorm` so the room-list return animation can be compared across multiple create and update motion variants before choosing a final dashboard implementation.

## Current Behavior

- `RoomCreatePage` and `RoomDetailPage` both navigate back to the room list with `spotlightRoomId`.
- `RoomListPage` applies the same spotlight treatment to both flows.
- The current spotlight animates `backgroundColor` and `boxShadow` over a relatively long duration, which reads as a stretched glow instead of a sharp neubrutalist confirmation.

## Approved UX Direction

The preview must follow the existing brainstorm preview-pack pattern already used in this repo.

Approved structure:

- Static HTML/CSS/JS preview pack in `.superpowers/brainstorm`
- One dated folder containing:
  - `index.html` catalog
  - `shared.css`
  - `shared.js`
  - one standalone `option-xx-*.html` page per concept
- Each option page reuses the same mini-flow from save action to list return
- Ten options instead of eight so the pack is broad enough for selection

Approved motion ideas:

1. `Drop-In Classic`
2. `Drop-In Brutal Spark`
3. `Stamp Slap`
4. `Stamp Foil Sweep`
5. `Shared Return`
6. `Spotlight Lane`
7. `Spotlight Lane Spark`
8. `Halo Slab Wildcard`
9. `Ticket Tear Reveal`
10. `Comet Rail Return`

Approved evaluation rules:

- Prefer semantic clarity over abstract decoration.
- `Create` and `Update` do not need to share the same effect.
- Motion should preserve the repo's neubrutalist 3D character.
- Favor `transform`/`opacity`-driven motion and avoid long paint-heavy glow treatments.
- Include a reduced-motion mode.

## Scope

In scope:

- A static brainstorm preview pack outside the production dashboard bundle
- Full mini-flow preview for both `Create` and `Update`
- Ten selectable motion variants
- Controls for replay, reduced motion, and playback speed
- A catalog page that makes all options scannable at a glance

Out of scope:

- Shipping any of these variants into the real dashboard
- Refactoring `RoomListPage`
- Figma production assets
- A final implementation decision
- A formal automated test harness for the preview pack

## Design

### Preview Architecture

Use a dedicated preview-pack folder:

- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/index.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.css`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.js`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-01-drop-in-classic.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-02-drop-in-brutal-spark.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-03-stamp-slap.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-04-stamp-foil-sweep.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-05-shared-return.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-06-spotlight-lane.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-07-spotlight-lane-spark.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-08-halo-slab-wildcard.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-09-ticket-tear-reveal.html`
- `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-10-comet-rail-return.html`

The preview stays dependency-free so it can be opened directly without booting the Bun/Vite app.

### Layout

Each option page should have:

1. `Hero shell`
   - option title
   - intensity and ship-risk badges
   - short note about what the option is trying to prove
2. `Shared preview stage`
   - left: mini editor panel
   - center: return lane
   - right: room-list grid with one target card and surrounding context cards
3. `Result area`
   - what the option proves for create and update
   - lightweight controls for replay, reduced motion, and speed

The catalog page should list all ten options with one-paragraph summaries and direct links to open each preview.

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
- `Reset`
- `Reduced Motion`
- `Speed` toggle: `0.75x`, `1x`, `1.25x`

### Selection Criteria

Each variant should be understandable through:

- how quickly the user reads `new` vs `updated`
- whether the card still feels brutal, tactile, and dimensional
- whether the surrounding list supports the target instead of competing with it
- whether the motion looks plausible to reproduce in React + Motion

## Rationale

This approach separates exploration from production code while matching the repo's existing preview-pack convention. The preview can go wide on ideas without destabilizing the dashboard, and the final choice can be made from explicit, replayable option pages instead of from abstract discussion alone.
