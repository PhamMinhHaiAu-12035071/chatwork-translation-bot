# Kagi PoC Offscreen Docker Design

**Version:** 1
**Date:** 2026-03-29
**Prepared by (AI-assisted):** Codex
**Status:** Approved

## Objective

Run the Kagi Translate PoC offscreen without opening a visible browser window on the host machine by moving execution into a Linux Docker container that uses `headless: false` with Xvfb.

## Scope

- Add a Docker image for `experiments/kagi-poc`
- Add a standalone Compose file under `experiments/kagi-poc`
- Update the PoC runtime so Linux container execution uses Chromium on a virtual display instead of strict headless mode
- Keep the current CLI interface and stdout/stderr behavior

## Non-Goals

- No HTTP service in this phase
- No integration into the main app stack yet
- No attempt to make Kagi pass strict `headless: true`

## Done

- `docker compose -f experiments/kagi-poc/docker-compose.yaml run --rm kagi-poc bun index.ts "<text>"` runs without opening host UI
- The containerized run uses Xvfb-backed Chromium and keeps the current translation/stability logic
- Local unit tests cover the runtime decision logic

## Constraints

- Kagi verification fails in strict headless mode with the current browser automation stack
- Offscreen behavior must come from Linux + Xvfb, not from auto-falling back to headed mode on the host
- Changes should stay scoped to `experiments/kagi-poc`

## Technical Approach

- Refactor `experiments/kagi-poc/index.ts` to derive connect options from runtime context instead of hard-coding `disableXvfb: true`
- Default local development remains visible on macOS, while container execution forces Linux offscreen mode with `disableXvfb: false`
- Add a Dockerfile that installs Bun runtime dependencies, Chromium, Xvfb, and basic fonts
- Add a Compose file that builds the image and supports one-shot CLI execution

## Testing

- Add unit tests for the runtime-resolution helper
- Keep existing tests for translation state/stability
- Verify with `bun test`, `bunx tsc --noEmit`, `bunx eslint`, and one real containerized run

## Risks / Trade-Offs

- Containerized browser startup is heavier than native execution
- Kagi may still intermittently fail verification even in Xvfb-backed headed mode
- Docker networking on macOS may require explicit DNS/IPv6 settings similar to the main repo services
