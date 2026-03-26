# Dashboard Delete Confirm Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone 10-option neubrutalism 3D delete-confirm preview pack in `.superpowers/brainstorm` so the user can choose a custom destructive modal before app integration.

**Architecture:** Reuse the previous preview-pack pattern: one catalog page, shared CSS and JS, and 10 standalone option pages. Keep the data and room-card context consistent across options so the only variable is the destructive-confirm interaction itself.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Google Fonts, local preview files

---

### Task 1: Create the preview pack scaffold

**Files:**

- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/index.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.css`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`

**Step 1: Write the failing verification**

- decide the exact preview-pack directory
- confirm it does not already contain the required files

**Step 2: Run verification to show the scaffold is missing**

Run: `find .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26 -maxdepth 1 -type f`

Expected: missing directory or missing files

**Step 3: Write minimal implementation**

- create the directory
- add the catalog page
- add shared stylesheet and script

**Step 4: Run verification to confirm the scaffold exists**

Run: `find .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26 -maxdepth 1 -type f | sort`

Expected: `index.html`, `shared.css`, `shared.js`

### Task 2: Add the 10 option pages

**Files:**

- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-01-safety-slider.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-02-sticker-lever.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-03-dual-lock-lever.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-04-hold-to-melt.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-05-trash-gate.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-06-fuse-pull.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-07-stamp-crush.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-08-card-shred.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-09-warning-dial.html`
- Create: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/option-10-slam-confirm.html`

**Step 1: Write the failing verification**

- require 10 option files
- require the catalog to link to each option

**Step 2: Run verification to show they are missing**

Run:

- `find .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26 -maxdepth 1 -name 'option-*.html' | wc -l`
- `rg "option-" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/index.html`

Expected: fewer than 10 options or missing links

**Step 3: Write minimal implementation**

- add the 10 standalone option pages
- wire the catalog links

**Step 4: Run verification to confirm the pages exist**

Run:

- `find .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26 -maxdepth 1 -name 'option-*.html' | wc -l`
- `rg "option-" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/index.html`

Expected: exactly 10 options and 10 linked entries

### Task 3: Implement shared delete-confirm interactions

**Files:**

- Modify: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.css`
- Modify: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`

**Step 1: Write the failing verification**

- require the script to support modal open/close behavior
- require per-variant confirm mechanics

**Step 2: Run verification to show the interaction code is incomplete**

Run:

- `rg "openModal|closeModal|variant" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`
- `node --check .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`

Expected: missing interaction markers or syntax gaps

**Step 3: Write minimal implementation**

- add reusable modal rendering
- add per-variant interaction handlers
- keep consistent fake room data across all previews

**Step 4: Run verification to confirm the script is valid**

Run:

- `node --check .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`

Expected: pass

### Task 4: Polish the visual system for destructive neubrutalism

**Files:**

- Modify: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.css`

**Step 1: Write the failing verification**

- require modal shell, lever, hold, and stamp visual classes in the stylesheet

**Step 2: Run verification to show those classes are missing**

Run: `rg "modal|lever|hold|stamp|shred|dial" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.css`

Expected: incomplete class set

**Step 3: Write minimal implementation**

- add shared modal layout
- add tactile destructive controls
- add visual variants for lever, hold, and crush families

**Step 4: Run verification to confirm the style hooks exist**

Run: `rg "modal|lever|hold|stamp|shred|dial" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.css`

Expected: complete variant hook coverage

### Task 5: Final preview-pack verification

**Files:**

- Verify only: `.superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/**/*`

**Step 1: Run file-count verification**

Run: `find .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26 -maxdepth 1 -type f | wc -l`

Expected: 13 files

**Step 2: Run syntax verification**

Run: `node --check .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/shared.js`

Expected: pass

**Step 3: Run catalog verification**

Run: `rg "option-0[1-9]|option-10" .superpowers/brainstorm/dashboard-delete-confirm-preview-pack-2026-03-26/index.html`

Expected: all 10 options referenced
