# Dashboard Animation Preview Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone brainstorm preview pack with ten room-dashboard animation directions
so the user can compare text-swap and stat-number motion before choosing what to integrate into the
real dashboard.

**Architecture:** The preview pack lives entirely under `.superpowers/brainstorm` in a dedicated
worktree. A shared HTML/CSS/JS base provides the common dashboard shell, state toggles, and stat
controls, while ten standalone option pages layer on different motion systems from conservative to
theatrical.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing brainstorm directory workflow

---

### Task 1: Create the Preview Pack Directory and Shared Shell

**Files:**

- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/shared.css`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/shared.js`

**Step 1: Write the failing test**

For this preview-only prototype, use a manual structure check instead of Bun tests.

Target expectation:

- the preview directory exists
- `index.html`, `shared.css`, and `shared.js` all exist

**Step 2: Run the structure check to verify it fails**

Run:

```bash
test -f .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html
```

Expected: non-zero exit because the preview pack does not exist yet.

**Step 3: Write minimal implementation**

- create the preview directory
- create the shared shell files
- implement the shared page chrome, card layout, buttons, stat cards, and helper functions for:
  - toggling `Live/Paused`
  - toggling `Pause/Enable`
  - increasing/decreasing stats

**Step 4: Run the structure check again**

Run:

```bash
find .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26 -maxdepth 1 -type f | sort
```

Expected: shows `index.html`, `shared.css`, and `shared.js`.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26
git commit -m "feat(repo): scaffold dashboard animation preview pack"
```

### Task 2: Build the Preview Index Page

**Files:**

- Modify: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html`

**Step 1: Write the failing test**

Target expectation:

- index page links to all ten options
- each card shows name, intensity, and short rationale

**Step 2: Run a focused check to verify it fails**

Run:

```bash
rg -n "option-0[1-9]|option-10" .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html
```

Expected: missing or incomplete results before the index is finished.

**Step 3: Write minimal implementation**

- add a card grid for all ten options
- add short descriptions
- add direct links to every standalone preview page

**Step 4: Run the focused check again**

Run:

```bash
rg -n "option-0[1-9]|option-10" .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html
```

Expected: ten linked option filenames appear.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html
git commit -m "feat(repo): add dashboard animation preview index"
```

### Task 3: Implement Options 01-03 (Conservative Range)

**Files:**

- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-01-soft-fade-swap.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-02-slide-stack.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-03-sticker-pop.html`

**Step 1: Write the failing test**

Target expectation:

- all three option files exist
- each contains its motion title and shared interactive controls

**Step 2: Run the existence check to verify it fails**

Run:

```bash
find .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26 -maxdepth 1 -name 'option-0[1-3]*.html' | sort
```

Expected: empty output before creation.

**Step 3: Write minimal implementation**

- implement `Soft Fade Swap`
- implement `Slide Stack`
- implement `Sticker Pop`
- wire each page to the shared helpers and local motion classes

**Step 4: Run the existence check again**

Run:

```bash
find .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26 -maxdepth 1 -name 'option-0[1-3]*.html' | sort
```

Expected: three files listed.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-0{1,2,3}*.html
git commit -m "feat(repo): add conservative dashboard animation previews"
```

### Task 4: Implement Options 04-06 (Mid Range)

**Files:**

- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-04-flip-pill.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-05-scramble-relay.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-06-dust-swap.html`

**Step 1: Write the failing test**

Target expectation:

- the three mid-range option files exist
- option 06 explicitly labels itself as the closest “Thanos” direction

**Step 2: Run the focused checks to verify they fail**

Run:

```bash
find .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26 -maxdepth 1 -name 'option-0[4-6]*.html' | sort
rg -n "Thanos|dust|dissolve" .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-06-dust-swap.html
```

Expected: file check is empty and content check fails before implementation.

**Step 3: Write minimal implementation**

- implement flip-driven label replacement
- implement scramble relay
- implement dust dissolve/reform with staggered spans and blur/particle hints

**Step 4: Run the focused checks again**

Run the same commands and confirm file creation plus the option 06 note.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-0{4,5,6}*.html
git commit -m "feat(repo): add mid-range dashboard animation previews"
```

### Task 5: Implement Options 07-10 (Expressive Range)

**Files:**

- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-07-pixel-scatter.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-08-ink-smear.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-09-ribbon-peel.html`
- Create: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-10-comet-burst.html`

**Step 1: Write the failing test**

Target expectation:

- the final four option files exist
- each marks a ship-risk or intensity note so the user can compare style vs practicality

**Step 2: Run the focused checks to verify they fail**

Run:

```bash
find .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26 -maxdepth 1 -name 'option-0[7-9]*.html' -o -name 'option-10*.html' | sort
```

Expected: empty output before creation.

**Step 3: Write minimal implementation**

- implement pixel scatter
- implement ink smear
- implement ribbon peel
- implement comet burst
- add consistent “ship risk” labels

**Step 4: Run the focused checks again**

Run the same command and confirm all four files exist.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-0{7,8,9}*.html \
        .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/option-10*.html
git commit -m "feat(repo): add expressive dashboard animation previews"
```

### Task 6: Verify Navigation and Preview Integrity

**Files:**

- Modify: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/index.html`
- Modify: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/shared.css`
- Modify: `.superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26/shared.js`
- Modify: all ten option HTML files as needed

**Step 1: Write the failing test**

Target expectation:

- every option links back to the index
- every option exposes working controls for status swap and stat changes
- shared styles keep the dashboard layout consistent

**Step 2: Run manual verification to expose gaps**

Run:

```bash
python3 -m http.server 4174 --directory .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26
```

Expected: local preview is served; manual click-through may reveal missing links or broken controls.

**Step 3: Write minimal implementation**

- fix any navigation gaps
- normalize spacing, notes, labels, and control placement
- ensure each option clearly communicates its direction

**Step 4: Run manual verification again**

Open:

- `http://127.0.0.1:4174/`
- click all ten options
- trigger both label and stat animations on each page

Expected: all pages render and controls respond.

**Step 5: Commit**

```bash
git add .superpowers/brainstorm/dashboard-animation-preview-pack-2026-03-26
git commit -m "feat(repo): polish dashboard animation preview pack"
```
