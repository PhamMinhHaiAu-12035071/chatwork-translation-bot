# Dashboard Room Spotlight Variant Atlas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone static playground in `.superpowers/brainstorm` that previews eight room-list return animation variants for create and update flows.

**Architecture:** Keep the work outside the production dashboard bundle. Create one dependency-free HTML/CSS/JS preview that owns its own variant catalog, interaction state, and motion playback helpers. Use a small Bun test file to lock the variant metadata contract and reduced-motion behavior before wiring the preview UI.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Bun test

---

### Task 1: Lock the variant atlas contract with failing tests

**Files:**

- Create: `.superpowers/brainstorm/room-spotlight-variants.test.ts`
- Create: `.superpowers/brainstorm/room-spotlight-variants.js`

**Step 1: Write the failing test**

Add a Bun test file that imports a small metadata surface from `room-spotlight-variants.js` and asserts:

```ts
expect(VARIANTS).toHaveLength(8)
expect(VARIANTS.map((variant) => variant.id)).toEqual([
  'drop-in-classic',
  'drop-in-brutal-spark',
  'stamp-slap',
  'stamp-foil-sweep',
  'shared-return',
  'spotlight-lane',
  'spotlight-lane-spark',
  'halo-slab-wildcard',
])
expect(getVariantById('shared-return')?.label).toBe('Shared Return')
expect(getVariantById('missing')).toBeNull()
```

Also add a reduced-motion assertion:

```ts
const playback = getPlaybackDurations({ mode: 'update', reducedMotion: true, speed: 1 })
expect(playback.totalMs).toBe(0)
```

**Step 2: Run test to verify it fails**

Run: `bun test .superpowers/brainstorm/room-spotlight-variants.test.ts`

Expected: FAIL because the variant catalog and playback helper do not exist yet.

### Task 2: Implement the minimal variant catalog and timing helpers

**Files:**

- Modify: `.superpowers/brainstorm/room-spotlight-variants.js`
- Modify: `.superpowers/brainstorm/room-spotlight-variants.test.ts`

**Step 1: Write minimal implementation**

Add:

```js
export const VARIANTS = [
  { id: 'drop-in-classic', label: 'Drop-In Classic', tags: ['Create-heavy'] },
  { id: 'drop-in-brutal-spark', label: 'Drop-In + Brutal Spark', tags: ['Create-heavy'] },
  { id: 'stamp-slap', label: 'Stamp Slap', tags: ['Update-heavy'] },
  { id: 'stamp-foil-sweep', label: 'Stamp + Foil Sweep', tags: ['Update-heavy'] },
  { id: 'shared-return', label: 'Shared Return', tags: ['Balanced'] },
  { id: 'spotlight-lane', label: 'Spotlight Lane', tags: ['Balanced'] },
  { id: 'spotlight-lane-spark', label: 'Spotlight Lane + Spark Accent', tags: ['Balanced'] },
  { id: 'halo-slab-wildcard', label: 'Halo Slab Wildcard', tags: ['Wildcard'] },
]

export function getVariantById(id) {
  return VARIANTS.find((variant) => variant.id === id) ?? null
}

export function getPlaybackDurations({ mode, reducedMotion, speed }) {
  if (reducedMotion) return { totalMs: 0, settleMs: 0, accentMs: 0 }
  // return per-mode timing scaled by speed
}
```

Keep the module browser-safe so the same file can drive both tests and the playground.

**Step 2: Run test to verify it passes**

Run: `bun test .superpowers/brainstorm/room-spotlight-variants.test.ts`

Expected: PASS

### Task 3: Build the static hybrid-atlas shell

**Files:**

- Create: `.superpowers/brainstorm/room-spotlight-variants.html`
- Create: `.superpowers/brainstorm/room-spotlight-variants.css`
- Modify: `.superpowers/brainstorm/room-spotlight-variants.js`

**Step 1: Write the HTML shell**

Create a shell with:

- top stage container
- mini editor panel
- return lane
- room list grid
- controls bar
- variant atlas grid

Include stable hooks such as:

```html
<main class="variant-atlas-app">
  <section class="variant-stage" data-stage></section>
  <section class="variant-controls" data-controls></section>
  <section class="variant-grid" data-variant-grid></section>
</main>
```

**Step 2: Write the CSS scaffold**

Add a neubrutalist visual system with:

- thick borders
- hard shadows
- tilted paper-card surfaces
- bold accent colors
- reusable classes for card shell, sticker labels, slab effects, spark fragments, and foil sheen

Keep animation classes separated by variant so each motion family can be toggled without rewriting the DOM.

**Step 3: Wire the JS render loop**

Render:

- the active variant tile state
- the stage controls
- a target card plus surrounding list cards
- create/update triggers

Use data attributes and class toggles to drive animations instead of introducing framework tooling.

### Task 4: Implement all eight motion variants

**Files:**

- Modify: `.superpowers/brainstorm/room-spotlight-variants.css`
- Modify: `.superpowers/brainstorm/room-spotlight-variants.js`

**Step 1: Implement create-focused variants**

Add create playback logic for:

- `drop-in-classic`
- `drop-in-brutal-spark`

These should use vertical insertion, slight overshoot, and hard shadow snapping. The spark version should add 3-5 chunky fragments that burst and disappear quickly.

**Step 2: Implement update-focused variants**

Add update playback logic for:

- `stamp-slap`
- `stamp-foil-sweep`

These should introduce a short-lived `UPDATED` sticker/slab and optionally a single sheen pass across the card header.

**Step 3: Implement balanced and wildcard variants**

Add playback logic for:

- `shared-return`
- `spotlight-lane`
- `spotlight-lane-spark`
- `halo-slab-wildcard`

`shared-return` should visibly bridge the editor area and destination card. `spotlight-lane` variants should push surrounding cards back. `halo-slab-wildcard` should use a hard graphic plate behind the card instead of a soft glow.

**Step 4: Verify the variant atlas still passes tests**

Run: `bun test .superpowers/brainstorm/room-spotlight-variants.test.ts`

Expected: PASS

### Task 5: Add README guidance and manual verification notes

**Files:**

- Create: `.superpowers/brainstorm/README.md`

**Step 1: Document usage**

Add:

- how to open the HTML preview
- what each control does
- what each of the eight variants is trying to prove
- which variants are strongest for `Create`, `Update`, and `Wildcard`

**Step 2: Add selection checklist**

Include explicit review prompts:

- “Do I understand new vs updated in under 1 second?”
- “Does the card still feel neubrutalist and tactile?”
- “Is the wow moment caused by position/shape, not only brightness?”

### Task 6: Run final verification and inspect the preview manually

**Files:**

- Modify: none

**Step 1: Run the brainstorm test**

Run: `bun test .superpowers/brainstorm/room-spotlight-variants.test.ts`

Expected: PASS

**Step 2: Re-run repo health checks**

Run: `bun run typecheck`

Expected: exit code 0

Run: `bun run lint`

Expected: exit code 0

**Step 3: Manual preview verification**

Open `.superpowers/brainstorm/room-spotlight-variants.html` in a browser and verify:

- all 8 variants replay
- `Create` and `Update` produce visibly different semantics
- reduced-motion disables the flourish layers
- speed controls do not break animation sequencing
- shared-return visibly connects save action and destination card
