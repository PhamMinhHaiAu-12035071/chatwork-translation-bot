# Dashboard Room Spotlight Preview Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone static preview pack in `.superpowers/brainstorm` that previews ten room-list return animation variants for create and update flows.

**Architecture:** Keep the work outside the production dashboard bundle. Create one dependency-free HTML/CSS/JS preview pack that owns its own catalog page, shared interaction state, and motion playback helpers. Match the repo's existing preview-pack structure with one option page per concept.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript

---

### Task 1: Create the preview-pack shell

**Files:**

- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/index.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.css`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.js`

**Step 1: Build the catalog page**

Create `index.html` with a hero card and ten option cards, each linking to its own standalone preview page.

**Step 2: Build the shared CSS**

Add the shared neubrutalist styling system:

- hero shell
- catalog cards
- editor panel
- return lane
- room grid
- target-card accents for stamps, spark pieces, ticket seams, foil sweeps, halo plates, and comet impact
- responsive behavior for desktop and mobile previewing

**Step 3: Build the shared JavaScript controller**

Add:

- variant metadata for all ten options
- a single preview controller that replays `Create` and `Update`
- shared render helpers for the editor panel, lane, and room list
- reduced-motion and speed controls
- variant-specific toggles for spark, foil, halo, ticket, lane dimming, and comet impact

### Task 2: Add ten standalone option pages

**Files:**

- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-01-drop-in-classic.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-02-drop-in-brutal-spark.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-03-stamp-slap.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-04-stamp-foil-sweep.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-05-shared-return.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-06-spotlight-lane.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-07-spotlight-lane-spark.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-08-halo-slab-wildcard.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-09-ticket-tear-reveal.html`
- Create: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/option-10-comet-rail-return.html`

Each page should:

- load the shared fonts and `shared.css`
- define `window.DASHBOARD_ROOM_SPOTLIGHT_PREVIEW`
- declare title, summary, intensity, ship risk, and variant ID
- load `shared.js`

### Task 3: Keep the semantics consistent across all ten options

**Files:**

- Modify: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.css`
- Modify: `.superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.js`

**Step 1: Create-focused options**

Ensure these read as insertion and arrival first:

- `drop-in-classic`
- `drop-in-brutal-spark`
- `shared-return`
- `ticket-tear-reveal`
- `comet-rail-return`

**Step 2: Update-focused options**

Ensure these read as confirmation and impact first:

- `stamp-slap`
- `stamp-foil-sweep`
- `spotlight-lane`
- `spotlight-lane-spark`
- `halo-slab-wildcard`

### Task 4: Run lightweight verification

**Files:**

- Modify: none

**Step 1: Validate the shared script parses**

Run:

```bash
node --check .superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27/shared.js
```

Expected: exit code 0

**Step 2: Verify the pack contents**

Run:

```bash
find .superpowers/brainstorm/dashboard-room-spotlight-preview-pack-2026-03-27 -maxdepth 1 -type f | sort
```

Expected: `index.html`, `shared.css`, `shared.js`, and all ten option pages are present.

**Step 3: Manual preview verification**

Open `index.html` in a browser and verify:

- all 10 options are listed
- each option page loads the same preview shell
- `Create` and `Update` produce different semantics
- reduced motion shortens or suppresses flourish layers
- speed controls do not break sequencing
