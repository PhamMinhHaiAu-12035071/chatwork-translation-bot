# Dashboard Tour Card V2 Design Document

**Date:** 2026-04-02  
**Status:** Approved  
**Prepared by:** AI-assisted  
**Selected Approach:** **Approach 2: Adapt the approved `tour-card-v2.html` visual language to `nextstepjs`**

---

## Executive Summary

Polish the dashboard onboarding card so it looks like a real neubrutalism 3D speech bubble instead of a lightly customized library tooltip.

The approved direction is to adapt the spirit of [tour-card-v2.html](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/.superpowers/brainstorm/40371-1775128422/content/tour-card-v2.html) to the existing `nextstepjs` runtime. The final card should preserve the dashboard's playful Neubrutalism 3D identity, keep each tour step on a single unique solid color, and remain stable inside the current React Router + NextStep integration.

---

## Background

### Current State

- `packages/dashboard/src/components/organisms/neub-tour-card.tsx` renders a basic custom card with the default library arrow injected via the `arrow` prop.
- The current result works functionally, but it still reads as a third-party tooltip with custom colors rather than a bespoke dashboard component.
- The tour copy and per-step color system are already in place through `packages/dashboard/src/lib/tour-steps.ts`.

### User Feedback

- The current card is "chưa đúng" compared with the desired reference.
- The preferred reference is the `tour-card-v2.html` mock.
- The goal is not a pixel-perfect clone. The goal is to adapt that visual direction so the live component still behaves correctly in `nextstepjs`.

---

## Requirements

| Requirement           | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Visual target         | Speech-bubble neubrutalism 3D card                                   |
| Fidelity              | Match the spirit of `tour-card-v2.html`, not an exact port           |
| Card fill             | Single solid color from `step.color`                                 |
| Color uniqueness      | Preserve one distinct solid color per step                           |
| Typography            | `Shantell Sans` for title, badge, buttons; `Be Vietnam Pro` for body |
| Arrow treatment       | Replace library-looking arrow with bubble tail silhouette            |
| Runtime compatibility | Must still work inside `nextstepjs` card rendering                   |
| Completion state      | Special treatment, but same component family                         |
| Quality bar           | Typecheck + lint + focused tests pass                                |

---

## Rejected Approaches

### Approach 1: Port the HTML mock almost verbatim

This would match the reference most closely, but it would be brittle inside `nextstepjs` because the real component receives dynamic placement, dynamic content length, and library-provided control props. It would likely overfit the mock and underfit the runtime.

### Approach 3: Only polish the current card

This would be the fastest option, but it would still preserve the "customized tooltip" silhouette. The missing speech-bubble shape is the main issue, so small polish alone would not solve the user's complaint.

---

## Selected Design

### 1. Overall Shape

The card becomes a compact speech bubble:

- width around `272px` to `284px`
- `3px` dark border
- `18px` radius
- hard `5px 5px 0 #1a1a2e` shadow
- solid background from `step.color`
- dedicated bubble tail attached to the shell

The library arrow should no longer define the visual identity of the tooltip.

### 2. Bubble Tail

The tail is part of the card silhouette, built with two small stacked triangles:

- outer triangle in the dark border color
- inner triangle in the step's solid fill color

This reproduces the mock's speech-bubble feel while keeping implementation simple and stable. The tail does not need smart geometric targeting. It only needs to look intentional and consistent.

### 3. Information Hierarchy

The card content stack should be:

1. top meta row
2. optional progress dots or compact step badge
3. title
4. body copy
5. action row

The meta row should support:

- a compact `Bước x / y` badge for most steps
- a `Bỏ qua` action for non-final steps

The first step may emphasize progress dots more strongly to make the experience feel like a guided tour, while middle steps can stay more compact.

### 4. Typography

- Title, badge, and buttons use `Shantell Sans`
- Body copy uses `Be Vietnam Pro`
- The card should feel playful and handcrafted, not corporate or system-default

### 5. Buttons

Buttons should follow the same neubrutalist 3D language as the HTML mock:

- `Prev`: light semi-transparent surface with dark border and hard shadow
- `Next`: dark fill with colored text derived from the step color
- `Done`: dark fill with a brighter celebratory text treatment
- `Skip`: small, understated, inline in the header row

### 6. Completion Card

The final step remains part of the same family, but gets a distinct finish:

- higher-contrast text
- stronger celebratory tone
- `Hoàn thành` button label
- still no gradients on the body card itself

---

## Technical Design

### Component Structure

The live component should be organized into three visual layers:

1. `bubble shell`
2. `bubble tail`
3. `content stack`

This is preferable to mixing all layout logic into one anonymous wrapper because the shape and the content evolve for different step states.

### `nextstepjs` Adaptation Rules

- Keep using the existing `CardComponentProps` contract.
- Do not depend on the default `arrow` prop for the final silhouette.
- Do not hardcode fixed height; use a compact min-height so longer body text does not break the layout.
- Keep the logic branch simple:
  - first step: no `Prev`
  - middle steps: `Prev` + `Next`
  - last step: `Prev` + `Done`
- Preserve the existing `showSkip` behavior.

### Styling Placement

Most styling should remain local to `neub-tour-card.tsx` because the card is highly self-contained. Shared font loading already happens through dashboard HTML/CSS setup, so no new global font setup is needed for this refinement.

---

## Testing Strategy

### Unit Coverage

Add a focused `neub-tour-card.test.tsx` that proves:

- the card renders the supplied title and body
- the card uses the step color as a solid background
- the component emits the speech-bubble tail DOM hooks or identifying class names
- first, middle, and last step button states render correctly
- skip is hidden on the final step

### Verification

Required verification after implementation:

- `bun test packages/dashboard/src/components/organisms/neub-tour-card.test.tsx`
- `bun run typecheck`
- `bun run lint`

Optional but recommended:

- manual browser check for first, middle, and completion steps

---

## Acceptance Criteria

- The tour card reads visually as a speech-bubble neubrutalism 3D component.
- The default library tooltip look is no longer the dominant impression.
- Each step still uses a single solid unique color.
- The final step feels like a completion state without breaking the shared card family.
- The component remains stable inside the existing NextStep integration.
