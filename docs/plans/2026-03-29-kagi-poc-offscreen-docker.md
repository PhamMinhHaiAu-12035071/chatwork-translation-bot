# Kagi PoC Offscreen Docker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the Kagi Translate PoC inside Docker without opening a visible browser on the host by using Linux Chromium with Xvfb.

**Architecture:** The existing CLI PoC stays as the entrypoint. `index.ts` gains a small runtime-resolution helper that chooses whether to disable or enable Xvfb based on explicit env/config. A dedicated Docker image and standalone Compose file are added under `experiments/kagi-poc` so the PoC can run one-shot in isolation.

**Tech Stack:** Bun, TypeScript, bun:test, puppeteer-real-browser, Docker Compose, Chromium, Xvfb

---

### Task 1: Document the approved scope

**Files:**

- Create: `docs/plans/2026-03-29-kagi-poc-offscreen-docker-design.md`
- Create: `docs/plans/2026-03-29-kagi-poc-offscreen-docker.md`

**Step 1: Write the design document**

Capture the approved offscreen-Docker scope, constraints, non-goals, and verification approach.

**Step 2: Write the implementation plan**

Break the work into TDD-sized steps covering runtime helper changes, Docker assets, docs, and verification.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-29-kagi-poc-offscreen-docker-design.md docs/plans/2026-03-29-kagi-poc-offscreen-docker.md
git commit -m "docs: plan kagi poc offscreen docker flow"
```

### Task 2: Add failing tests for runtime resolution

**Files:**

- Modify: `experiments/kagi-poc/index.test.ts`
- Modify: `experiments/kagi-poc/index.ts`

**Step 1: Write the failing test**

Add tests for a new helper that resolves browser runtime behavior. Cover:

- default local mode keeps `headless: false` and `disableXvfb: true`
- explicit offscreen mode keeps `headless: false` and `disableXvfb: false`
- strict headless mode keeps `headless: true`

**Step 2: Run test to verify it fails**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: FAIL because the runtime helper does not exist yet.

**Step 3: Write minimal implementation**

Export a runtime helper from `experiments/kagi-poc/index.ts` that returns connect options from environment/runtime input.

**Step 4: Run test to verify it passes**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add experiments/kagi-poc/index.ts experiments/kagi-poc/index.test.ts
git commit -m "test: cover kagi poc runtime resolution"
```

### Task 3: Wire runtime resolution into the PoC

**Files:**

- Modify: `experiments/kagi-poc/index.ts`

**Step 1: Write the failing test**

Add or extend a test that asserts the strict-headless verification hint still appears only when strict headless is requested.

**Step 2: Run test to verify it fails**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: FAIL because `main` still derives runtime directly from `KAGI_HEADLESS`.

**Step 3: Write minimal implementation**

Use the new runtime helper inside the translation attempt path and keep verification messaging aligned with the resolved mode.

**Step 4: Run test to verify it passes**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add experiments/kagi-poc/index.ts experiments/kagi-poc/index.test.ts
git commit -m "feat: support offscreen runtime for kagi poc"
```

### Task 4: Add Docker image and Compose runner

**Files:**

- Create: `experiments/kagi-poc/Dockerfile`
- Create: `experiments/kagi-poc/docker-compose.yaml`
- Modify: `experiments/kagi-poc/README.md`

**Step 1: Write the failing test**

Add a small config test that asserts the Docker artifacts exist and include the required runtime markers:

- Dockerfile installs Chromium and Xvfb
- Compose file defines a `kagi-poc` service
- Compose env enables offscreen/Xvfb mode

**Step 2: Run test to verify it fails**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: FAIL because the Docker artifacts do not exist yet.

**Step 3: Write minimal implementation**

Create the Dockerfile, standalone Compose file, and README instructions for one-shot container execution.

**Step 4: Run test to verify it passes**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add experiments/kagi-poc/Dockerfile experiments/kagi-poc/docker-compose.yaml experiments/kagi-poc/README.md experiments/kagi-poc/index.test.ts
git commit -m "feat: add dockerized offscreen runner for kagi poc"
```

### Task 5: Verify the full flow

**Files:**

- Modify: none expected

**Step 1: Run targeted tests**

Run: `bun test experiments/kagi-poc/index.test.ts`
Expected: PASS

**Step 2: Run static verification**

Run: `bunx tsc --noEmit -p experiments/kagi-poc/tsconfig.json`
Expected: PASS

Run: `bunx eslint experiments/kagi-poc/index.ts experiments/kagi-poc/index.test.ts`
Expected: PASS

**Step 3: Run containerized translation**

Run: `docker compose -f experiments/kagi-poc/docker-compose.yaml run --rm kagi-poc bun index.ts "hello"`
Expected: PASS with translation output and no host-visible browser window

**Step 4: Commit**

```bash
git add experiments/kagi-poc
git commit -m "chore: verify kagi poc offscreen docker flow"
```
