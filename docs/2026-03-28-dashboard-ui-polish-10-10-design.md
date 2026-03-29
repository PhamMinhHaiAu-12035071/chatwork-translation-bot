# Dashboard UI Polish — Design Document

### From 7.9/10 → 10/10 (Neo-Kawaii Brutalism 3D)

**Date:** 2026-03-28
**Author:** UI/UX Review Session
**Scope:** `packages/dashboard/` visual layer only — no backend, no API, no schema

---

## 1. Context

The dashboard was reviewed against the "Neubrutalism 3D tươi sáng bắt mắt" aesthetic goal and scored **7.9/10** overall. The foundation is genuinely strong — the clay shadow system, candy-stripe scrollbar, and spring-animated nav indicator are production-quality design details that most teams never achieve. These must be preserved unconditionally.

This document identifies the **gap areas** and prescribes exact design decisions to close each one.

---

## 2. Current Scores vs Target

| Dimension                    | Current | Target |
| ---------------------------- | ------- | ------ |
| Typography                   | 7.5     | 10     |
| Color & Palette              | 8.0     | 10     |
| Layout & Composition         | 6.5     | 10     |
| Spacing & Rhythm             | 8.0     | 10     |
| 3D Effect & Shadow System    | 9.0     | 10     |
| Animation & Motion           | 8.5     | 10     |
| Micro-interactions & Details | 9.0     | 10     |
| Neubrutalism Authenticity    | 7.5     | 10     |
| System Cohesion              | 8.0     | 10     |
| UX Practicality              | 7.0     | 10     |

---

## 3. Design Issues & Decisions

### 3.1 Typography — Fix Semantic Font Usage

**Problem A:** `.brutal-input` in `global.css` sets `font-family: 'Shantell Sans', cursive`. This applies the
handwriting font to every `<input>`, `<textarea>`, and the custom `BrutalSelect` trigger. When a user
types data into a form field, the handwriting font makes the text harder to scan and visually unprofessional.
The form fields should use the rounded body font.

**Decision:** Change `.brutal-input` `font-family` to `'Zen Maru Gothic', sans-serif`.

**Problem B:** The webhook URL code block in `room-detail.tsx` uses `font-['Shantell_Sans',cursive]`.
A URL is technical content — it should be rendered in monospace for scanability (users need to spot
typos, compare characters).

**Decision:** Replace with Tailwind's `font-mono` class.

**What stays:** `.brutal-dropdown-option` and all heading/label contexts keep `Shantell Sans`. The issue
is strictly about user-entered data and technical identifiers.

---

### 3.2 Color Semantics — Separate Error from Decorative Pink

**Problem:** `--error: #d44470` and `--pink-accent: #d44470` share the same hex value. When a user
sees the Delete button (pink-gradient) next to an error toast or error border (also pink), they receive
mixed signals. "Is this red because it's dangerous, or is this just the button style?"

**Decision:** Change `--error` to `#c0392b` — a warm, unambiguous red. This is distinct from the
decorative `#d44470` hot-pink without being harsh or alarming. Downstream effects:

- `brutal-input-error` border and shadow color → now warm red
- Error message text → now warm red
- `BrutalToast` error variant uses `var(--error)` → now warm red
- `theme-button-pink` / `delete-modal-confirm` stay on `#d44470` — decorative only

No changes needed to component files — only the CSS variable.

---

### 3.3 Layout & Composition — Break the Rectangle

**Problem:** Every page is a clean rectangular grid: sidebar on left, main content on right, cards in
uniform grid. This is functionally sound but misses the "deliberate editorial tension" that defines
great Neubrutalism. Every element sits politely in its box.

**Design decision:** Add a `PageShell` header accent — a dashed ruling band between the page
description and the content area. This is a horizontal divider built with a `repeating-linear-gradient`
that creates a visual "torn newspaper" separator. It costs zero layout change but transforms the page
header from a plain stack of text into an editorial composition.

Visual spec:

```
[Eyebrow sticker]
[H1 Title              ]  [Actions]
[Description paragraph ]
━━━━━━━━━━━━━━━━━━━━━ (dashed ruling: 3px, --border, gap 6px)
[Content grid]
```

**Additional decision:** Add two more `AmbientOrbs` positioned at center-left and bottom-center, and
increase the blur significantly (`blur-[24px]` and `blur-[32px]`). The current 1–2px blur makes them
look like rendering artifacts rather than atmospheric depth elements. They should be soft, dreamy, and
clearly intentional.

---

### 3.4 Room Card Color — Stable, Not Index-Based

**Problem:** Room cards cycle through 6 themes by `index % 6`. If you have 6 rooms and add a new one,
every room shifts to the next color. The 5th room that was always "peach" is now "blush". Colors feel
unstable and arbitrary.

**Design decision:** Hash the `room.id` string to a deterministic index. Same room ID → same color,
always, regardless of its position in the list. The hash is a simple polynomial that runs in O(n) on
the ID string.

```typescript
// Exported for testability
export function getRoomCardIndex(roomId: string): number {
  let h = 0
  for (let i = 0; i < roomId.length; i++) {
    h = (h * 31 + roomId.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 6
}
```

This change has zero visual impact — rooms will look the same on first load, but colors won't
shuffle when rooms are added or removed.

---

### 3.5 Animation — Expressive Page Transition

**Problem:** `initial={{ opacity: 0, x: 20 }}` is the most generic page transition in React. It
communicates nothing about the design style.

**Decision:** Change to `initial={{ opacity: 0, y: 10, scale: 0.99, rotate: -0.4 }}`. The subtle
negative rotation (like a card dropped on a desk) matches the "physical objects" metaphor of the
clay-shadow system. Combined with easing `[0.22, 1, 0.36, 1]` (quick start, smooth settle), the
transition feels like placing a card down rather than sliding a window.

---

### 3.6 Modal Animation — Use the Spring

**Problem:** `delete-modal-pop-in` uses a basic `scale(0.95)` → `scale(1)` which looks like a generic
ShadCN dialog. The app's button interactions and dropdown already use `cubic-bezier(0.34, 1.56, 0.64, 1)`
(the "overshoot spring"). The modal should match.

**Decision:** Add slight rotation to pop-in (`rotate(-1deg)` → `rotate(0)`) and use the spring curve.
This gives the modal the same "physically tossed onto the screen" feel as the BrutalCard entrance animations.

---

### 3.7 Mobile Navigation — Horizontal Pill Row

**Problem:** Below `lg` (1024px), the sidebar stacks vertically above main content. The three nav
items form a vertical list taking up significant vertical space before the user sees any content.

**Decision:** Below `lg`, convert the nav to a horizontal scrollable row of compact pills. The brand
card stays above. Each nav item shows as a narrower card (reduced padding, icon-optional). On `lg+`,
layout is unchanged — vertical sidebar with full cards.

Implementation: add `flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:space-y-5 lg:overflow-visible` to
`<nav>`. Each NavLink gets `shrink-0 min-w-[9rem] lg:min-w-0`.

---

## 4. What NOT to Change

The following must be preserved exactly as-is:

1. **Candy-stripe animated scrollbar** — the most distinctive detail
2. **`nav-candy-thumb` with spring layoutId** — signature active indicator
3. **`--border: #1a1a2e`** — perfect ink tone, don't soften
4. **Hard shadow system** (5px 5px 0 + inset clay shine) — the core 3D effect
5. **`clay-bounce` + `shine-sweep` icon hover** — polished micro-interaction
6. **`BrutalCard` tilt system** — subtle but meaningful personality
7. **`StickerLabel` and `StatusRibbon` tilts** — charm that would be lost if removed

---

## 5. File Impact Summary

| File                                                        | Change Type                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/styles/global.css`                  | `.brutal-input` font, `--error` token, `delete-modal-pop-in` animation, new `.page-divider-brutal` class |
| `packages/dashboard/src/components/layout/ambient-orbs.tsx` | Add 2 orbs, increase blur via Tailwind classes                                                           |
| `packages/dashboard/src/components/layout/page-shell.tsx`   | Add `<div className="page-divider-brutal">` between description and children                             |
| `packages/dashboard/src/layouts/app-layout.tsx`             | Page transition props, mobile nav classes on `<nav>` and `<NavLink>`                                     |
| `packages/dashboard/src/pages/room-list.tsx`                | Replace index-based card theme with `getRoomCardIndex(room.id)`                                          |
| `packages/dashboard/src/pages/room-detail.tsx`              | Fix webhook URL `font-mono`                                                                              |

No new files are created. No backend files are touched.

---

## 6. Success Criteria

After all changes:

- [ ] Typing in any input field shows text in `Zen Maru Gothic` (rounded, readable)
- [ ] Webhook URL renders in monospace
- [ ] Error borders/toasts are clearly red, not hot-pink
- [ ] Deleting a room and re-adding it: room card color stays the same
- [ ] On mobile (< 1024px): nav items are horizontal, not a tall vertical stack
- [ ] Page transition has a subtle tilt on entry
- [ ] Delete modal pops in with spring overshoot
- [ ] PageShell pages have a bold dashed ruling between header and content
- [ ] Background orbs are soft atmospheric blobs, not barely-visible dots
- [ ] `bun test && bun run typecheck && bun run lint` all pass
