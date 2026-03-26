# Dashboard Animation Preview Pack Design

**Version:** 1.0
**Date:** 2026-03-26
**Prepared by (AI-assisted):** Codex
**Status:** Approved for implementation

## Objective

Create a standalone preview pack under `.superpowers/brainstorm` that lets the user compare ten
animation directions for the Phase 3 room dashboard before choosing what to ship into the real app.

## Scope

### In scope

- Build a self-contained brainstorm preview pack in `.superpowers/brainstorm`
- Recreate the core dashboard interaction surface for comparison:
  - one room card with `Live/Paused` status pill
  - one action button that swaps `Pause/Enable`
  - three stats for `Total Rooms`, `Active`, and `Awaiting Webhook`
- Provide ten visual directions, ordered from basic to advanced
- Make each preview interactive so the user can repeatedly toggle state and number changes
- Keep the previews visually aligned with the current kawaii-neubrutalism direction

### Out of scope

- Integrating any animation into `packages/dashboard/src`
- Updating the `Room Detail` page
- Adding GSAP, Splitting.js, or any new runtime dependency to the real app
- Creating production-ready React components in this phase
- Performance benchmarking the real dashboard implementation

## Done

The preview pack is complete when:

- a new brainstorm directory exists with a preview index page
- all ten options can be opened independently
- each option demonstrates text change for `Live/Paused`
- each option demonstrates text change for `Pause/Enable`
- each option demonstrates number increment/decrement for the three stat cards
- the visual style stays recognizably consistent across all options so the motion is the main
  comparison axis

## Constraints

- Use plain HTML/CSS/JS standalone previews for fast iteration and easy sharing
- Avoid external animation libraries in the preview pack unless absolutely necessary
- Prefer motion patterns that can later be translated into Framer Motion and Tailwind-friendly app
  code
- Keep the previews deterministic and clickable without needing the app dev server
- Do not disturb existing dirty changes in the primary workspace; implement in a dedicated worktree

## Design Principles

- Compare motion, not layout drift: all previews should reuse the same card proportions, spacing,
  and typography
- Show the same state transition in every option so subjective preference is easier to judge
- Preserve legibility first: even the most expressive option should keep `Live`, `Paused`,
  `Pause`, and `Enable` readable within a short interaction loop
- Scale theatrics gradually from option 1 to option 10
- Keep the candy-neubrutal border, shadow, sticker, and hand-drawn type language intact

## Preview Surface

Each preview will contain:

- a page header describing the motion direction
- a compact explanation of what the interaction is trying to convey
- a dashboard stat row with interactive number changes
- a single room card using a seeded room name and provider metadata
- controls to trigger:
  - `status` change (`Live` <-> `Paused`)
  - `button` label change (`Pause` <-> `Enable`)
  - `stats` increment/decrement

## Motion Catalog

### 1. Soft Fade Swap

- Low-risk baseline
- Uses opacity, blur, and tiny scale drift
- Number cards use a restrained spring count-up/count-down

### 2. Slide Stack

- Text exits vertically and new text slides in from the opposite side
- Number cards use a compact odometer-like vertical roll

### 3. Sticker Pop

- Text squashes and stretches with shadow bounce
- Number cards pop with a playful elastic landing

### 4. Flip Pill

- Pill and button labels change on a hinged flip
- Number cards use card-flip style digit replacement

### 5. Scramble Relay

- Text briefly scrambles before resolving to the next label
- Number cards use a fast digital relay feel

### 6. Dust Swap

- Closest to the requested “Thanos snap”
- Outgoing text dissolves into soft particles and incoming text reforms from scattered glyphs
- Number cards use fade-and-reassemble digit changes

### 7. Pixel Scatter

- Text breaks into chunky pixel blocks before reassembling
- Number cards animate with block-based digit replacement

### 8. Ink Smear

- Text stretches into a liquid ink streak before reforming
- Number cards smear across the baseline before settling

### 9. Ribbon Peel

- Label behaves like a sticker or ribbon being peeled away and replaced
- Number cards use peel-and-drop panels

### 10. Comet Burst

- Most theatrical option
- Label change includes a short streak, glow pulse, and trailing particles
- Number cards accent change with a brief comet sweep

## Technical Approach

### File strategy

Create one deterministic brainstorm directory:

```text
.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/
```

Inside it:

- `index.html` overview page linking to all options
- `shared.css` common layout, theme, and control styling
- `shared.js` shared helpers for toggle state, stat mutation, and navigation
- `option-01-soft-fade-swap.html` through `option-10-comet-burst.html`

### Implementation strategy

- Use CSS variables and `data-*` attributes to keep the ten variants easy to compare
- Use minimal vanilla JS per option to trigger swaps and number changes
- Use SVG/CSS blur, transforms, clipping, masks, and staggered spans where needed
- Keep each option self-documenting with a short note about likely real-app translation into
  Framer Motion

### Real-app translation intent

This preview pack is not production code, but it should point clearly to future implementation:

- text swap directions should map to `AnimatePresence` and keyed motion children
- number transitions should map to `motionValue`, `animate`, and spring-driven counters
- theatrical previews should be evaluated not only for style, but for whether they can be trimmed
  into production-safe motion for the actual dashboard

## Risks

- The most advanced variants may look strong in isolation but feel too busy in the actual app
- Browser-only prototype effects can over-promise motion that would be expensive or noisy in React
- Overly different visual treatments can make comparison less fair

## Mitigations

- Keep layout and color palette nearly identical across options
- Include one line in every preview describing the “ship risk” level
- Order the options from conservative to theatrical so review has a clear progression

## Recommendation

Build all ten previews now, but expect the likely production candidates to come from:

- `Slide Stack`
- `Sticker Pop`
- `Dust Swap`
- `Ink Smear`

These cover the spread from practical to expressive without collapsing into ten near-duplicates.
