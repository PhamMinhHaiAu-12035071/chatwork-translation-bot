# Webhook Guide SVG Illustrations

**Version:** 1.0
**Date:** 2026-03-28
**Prepared by (AI-assisted):** Claude Sonnet 4.6
**Status:** Approved

---

## Objective

Add per-step SVG illustrations to the `/guide` webhook setup page so that each step shows a visual evidence fragment of the relevant Chatwork Admin UI. The user can see exactly where to click/type without having to guess.

---

## Scope

- Add 5 SVG React components (one per step) representing faithful recreations of the Chatwork Admin webhook UI.
- Modify `webhook-stepper.tsx` minimally: wrap the existing title/body block in a 2-column grid, add an SVG slot on the right.
- Preserve 100% of the existing Neubrutalism 3D design (BrutalCard, StickerLabel, brutal-button, theme classes, tilt, animations).

---

## Non-Goals

- No redesign of the step card layout beyond the grid wrapper.
- No lightbox, modal, or interactive SVG behaviour.
- No screenshot-to-SVG automation pipeline; SVGs are handcrafted React components.
- No changes to routing, auth, data model, or backend.

---

## Definition of Done

- 5 SVG components exist and render correctly for each step.
- Each step card shows instruction (left) + SVG fragment (right) on ≥ sm screens; stacks vertically on mobile.
- Existing tests pass (`bun test && bun run typecheck && bun run lint`).
- New SVG components have co-located tests (smoke render test, no snapshot).

---

## Constraints

- Stack: React 19, TypeScript 5.4+ strict, Tailwind CSS v4, Vite, Bun.
- SVG components: pure JSX, zero external dependencies.
- Must follow existing co-location test pattern (`ai_rules/test-colocation.md`).
- Must use `~/` alias for intra-package imports (no `../`).
- Naming convention: kebab-case files, PascalCase exports.

---

## UX / UI

### Placement: Side-by-Side

Inside `BrutalCard`, the `space-y-2` block (title + body) becomes a 2-column grid:

```
┌─────────────────────────────────────────────────┐
│ [StickerLabel "Step 03"]  [StatusPill "3 of 5"] │  ← unchanged
├───────────────────────┬─────────────────────────┤
│ h2: Paste Webhook URL │  SVG: Webhook URL field  │  ← NEW grid
│ p: Copy the URL…      │  with red highlight box  │
│                       │  + pill label            │
├───────────────────────┴─────────────────────────┤
│ [Copy URL button]                                │  ← unchanged
└─────────────────────────────────────────────────┘
```

- **Desktop (sm+):** `grid-cols-2`, SVG right-aligned.
- **Mobile:** `grid-cols-1`, SVG stacks below text.
- BrutalCard theme, tilt, StickerLabel, StatusPill, brutal-button: **unchanged**.

### SVG Style Convention

Each SVG component:

- Faithfully recreates the relevant Chatwork Admin UI section (recognisable, not schematic).
- Crops to only the form rows / buttons relevant to that step (no full-page render).
- Adds a **red highlight overlay** (`stroke: #e84040`, `fill: rgba(232,64,64,0.08)`) around the target element.
- Adds a **pill label** (small rounded rect, `fill: #e84040`, white text) indicating the action (e.g. "Paste URL here", "Click here").
- Uses `#1a1a2e` for all borders/text to match `--border` design token.
- Fixed width `260` in viewBox; height varies per SVG content (each step crops a different number of form rows).

---

## Data / Business Rules

### Step Interface Change

```typescript
interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
  svgFragment: React.ReactNode // NEW — required for all steps
}
```

### SVG Fragment Mapping

| Step | Component          | Chatwork UI Section Shown                                                 | Highlighted Element           |
| ---- | ------------------ | ------------------------------------------------------------------------- | ----------------------------- |
| 01   | `WebhookStep01Svg` | Left sidebar: Integrations → API → **Webhook** (active)                   | "Webhook" menu item           |
| 02   | `WebhookStep02Svg` | Webhook list page with **Add webhook** button                             | Add webhook button            |
| 03   | `WebhookStep03Svg` | Edit Webhook form — **Webhook URL** field row                             | Webhook URL input             |
| 04   | `WebhookStep04Svg` | Edit Webhook form — **Event** section (Room Event + checkboxes + Room ID) | Room Event radio + checkboxes |
| 05   | `WebhookStep05Svg` | Edit Webhook form bottom — **Save** button                                | Save button                   |

> **Note for Step 02:** The provided screenshot shows the "Edit Webhook" page, not the list page. The `WebhookStep02Svg` component recreates the webhook list page (table of existing webhooks + "Add webhook" button) based on Chatwork Admin UI knowledge.

---

## Technical Approach

### File Structure

```
packages/dashboard/src/components/atoms/
└── webhook-svgs/
    ├── index.ts                    ← barrel export
    ├── webhook-step-01-svg.tsx
    ├── webhook-step-01-svg.test.tsx
    ├── webhook-step-02-svg.tsx
    ├── webhook-step-02-svg.test.tsx
    ├── webhook-step-03-svg.tsx
    ├── webhook-step-03-svg.test.tsx
    ├── webhook-step-04-svg.tsx
    ├── webhook-step-04-svg.test.tsx
    ├── webhook-step-05-svg.tsx
    └── webhook-step-05-svg.test.tsx
```

### `webhook-stepper.tsx` Changes

1. Add `svgFragment: React.ReactNode` to `Step` interface.
2. Add import: `import { WebhookStep01Svg, ... } from '~/components/atoms/webhook-svgs'`
3. Update each entry in `STEPS` array with its `svgFragment`.
4. Replace the bare `<div className="space-y-2">` block with:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
  <div className="space-y-2">
    <h2 className="font-heading text-2xl font-bold">{activeConfig.title}</h2>
    <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
      {activeConfig.body}
    </p>
  </div>
  <div className="flex items-start justify-center">{activeConfig.svgFragment}</div>
</div>
```

All other `BrutalCard` children (StickerLabel row, action buttons, copy URL row) remain untouched.

> **Note on `min-h-[280px]`:** The AnimatePresence wrapper div in `webhook-stepper.tsx` has `min-h-[280px]`. Adding SVG fragments will make each step card taller. This value should be bumped (e.g. `min-h-[360px]`) during implementation to prevent layout shifts between step transitions. Exact value to be confirmed after SVG heights are known.

### SVG Component Shape

```typescript
// Example: webhook-step-03-svg.tsx
export function WebhookStep03Svg() {
  return (
    <svg
      viewBox="0 0 260 120"
      width="260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Chatwork webhook settings — Webhook URL field highlighted"
    >
      {/* Faithful Chatwork Admin UI recreation */}
      {/* Red highlight overlay rect */}
      {/* Pill label */}
    </svg>
  )
}
```

- `role="img"` + `aria-label` on each SVG for accessibility.
- No props needed (static illustrations).
- `width` attribute set so SVG renders at fixed size without CSS.

---

## Testing

Each SVG component gets a co-located smoke test:

```typescript
// webhook-step-03-svg.test.tsx
import { render } from '@testing-library/react'
import { WebhookStep03Svg } from './webhook-step-03-svg'

it('renders without crashing', () => {
  const { container } = render(<WebhookStep03Svg />)
  expect(container.querySelector('svg')).toBeTruthy()
})
```

`webhook-stepper.test.tsx` existing tests must continue to pass without modification.

---

## Rollout / Ops

- Pure frontend change, no deployment coordination needed.
- No env vars, no backend changes, no migrations.
- Ships as part of next regular dashboard build.

---

## Risks / Trade-offs

| Risk                                                   | Mitigation                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Chatwork Admin UI changes → SVGs look wrong            | SVGs are isolated components, easy to update per step                             |
| SVG file size bloat                                    | Each SVG is a small crop, not full page; inline JSX has no image loading overhead |
| Step 02 SVG not from screenshot                        | Clearly documented; can be updated when a list-page screenshot is available       |
| min-h-[280px] constraint may clip SVG on small screens | Grid collapses to 1 col on mobile; SVG renders below text, no clipping            |

---

## Acceptance Criteria

- [ ] Each of the 5 steps displays a side-by-side SVG fragment on desktop.
- [ ] SVG highlights the correct Chatwork UI element with red border + pill label.
- [ ] On mobile (`< sm`), SVG stacks below instruction text.
- [ ] `bun test` passes (including new SVG smoke tests).
- [ ] `bun run typecheck` passes (Step interface updated, no implicit `any`).
- [ ] `bun run lint` passes (no `../` imports, correct file naming).
- [ ] Existing webhook-stepper tests pass without modification.

---

## Happy Path

1. User opens `/guide`.
2. Sees Step 01 card: instruction left, SVG of Chatwork sidebar (Webhook menu highlighted) right.
3. Clicks "Next" → Step 02: SVG shows "Add webhook" button highlighted.
4. Clicks "Next" → Step 03: SVG shows Webhook URL field with red highlight + "Paste URL here" label. Copy URL button present.
5. Clicks "Next" → Step 04: SVG shows Event section, Room Event + checkboxes highlighted.
6. Clicks "Next" → Step 05: SVG shows Save button highlighted. "Completed" state appears.

---

## Edge Cases

- `webhookUrl` prop is `undefined` → Step 03 falls back to `https://your-server.example.com/webhook` (existing behaviour, unchanged).
- User navigates steps out of order via pill buttons → correct SVG renders per active step index (array lookup, no edge case).

---

## Failure Cases

- SVG component throws → React error boundary (if present) catches; otherwise step card renders without SVG (graceful degradation via `svgFragment` being `null` fallback is not needed — components are static, no async).

---

## Explicit Decisions Made

| Decision                                                   | Source                         |
| ---------------------------------------------------------- | ------------------------------ |
| SVG style: faithful Chatwork UI recreation (not schematic) | User-stated                    |
| Placement: side-by-side (left=instruction, right=SVG)      | User-stated                    |
| Annotation: red highlight border + pill label              | User-stated                    |
| Implementation: separate SVG React components (Approach B) | User-stated                    |
| Preserve existing Neubrutalism 3D design 100%              | User-stated                    |
| Grid wrapper only — no other layout changes                | User-stated                    |
| Step 02 SVG from knowledge (not screenshot)                | AI-recommended, noted in risks |

---

## Open Risks

- `[UNCONFIRMED]` Step 02 SVG accuracy depends on AI's knowledge of Chatwork webhook list page UI. If layout differs from reality, SVG will need manual correction after visual verification.

---

## Out of Scope

- Lightbox / modal for full-size SVG viewing.
- Automated screenshot-to-SVG pipeline.
- Animated SVG (hover effects, transitions within SVG).
- SVG for non-guide pages.
- Changes to backend, routing, or data model.

---

## Future Scope / Deferred Features

> The following items were confirmed as out of current scope, not estimated, and not committed.

- Animated SVG with step highlight transitions.
- Screenshot automation: capture Chatwork UI programmatically and convert to SVG on build.
- Lightbox expansion for users who want full-page reference.
