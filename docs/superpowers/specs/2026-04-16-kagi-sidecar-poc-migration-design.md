# Design Spec — Kagi Sidecar PoC Migration

**Date:** 2026-04-16
**Status:** Approved (via interview rounds 1–7)
**Target packages:** `@chatwork-bot/kagi-sidecar`, `@chatwork-bot/provider-kagi`
**Source PoC:** `nghien_cuu_cua_toi/` (commit `f0f4603` and earlier)

## 1. Problem & Goal

The PoC under `nghien_cuu_cua_toi/` has been validated in production-like conditions:

- Migrated browser automation from `puppeteer-real-browser` to `patchright` (patched Playwright + Chromium).
- Added pre-translate **login verification** (`verifyLoginSuccess()`) that runs once per browser lifetime to fail fast on expired sessions.
- Added **`openNewTab()`** lifecycle for batch translation — the browser is launched once, item[0] reuses the initial tab, and item[i>0] opens a fresh tab while closing the previous one, keeping memory bounded and state isolated per message.
- Added DOM-based Cloudflare readiness (`waitForCloudflareReady`) instead of fixed post-navigation sleeps.
- Added session-cookie injection from a file (`KAGI_SESSION_FILE` → `visitKagiOriginAndInjectSessionCookies`).

The production sidecar in `packages/kagi-sidecar/` still uses `puppeteer-real-browser`, launches and tears down a browser per HTTP request (commit `42e4c87` — isolated `userDataDir` per request to prevent translation drift), and has no explicit login verification pre-check or batch-friendly lifecycle.

**Goal:** Port the successful PoC patterns into `packages/kagi-sidecar` and adjust `packages/provider-kagi` only where required so that:

- The sidecar migrates to `patchright`.
- A single browser instance is launched on boot and reused across HTTP requests, with a new tab per request.
- Login is verified eagerly at boot; any browser/context/login failure exits the process so the orchestrator can restart it.
- The public HTTP contract of `/translate` and the types in `@chatwork-bot/provider-kagi` stay stable so nothing else in the monorepo has to change.

## 2. Decisions (locked via interview)

| ID      | Decision                                                                                                                                                                                        | Notes                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001 | Port the PoC architecture comprehensively into `kagi-sidecar`, not a minimal swap.                                                                                                              | Replace `puppeteer-real-browser` with `patchright`; refactor toward PoC's `IBrowserService` + `HumanInteractionService` + `runBatchTranslation`.                       |
| DEC-002 | Browser pool = singleton, one tab active per request, `openNewTab()` closes the previous tab.                                                                                                   | Login verified once at boot (`isLoginVerified` flag). Matches the user's "keep Chrome alive, just open new tabs" requirement.                                          |
| DEC-003 | Persistent `USER_DATA_DIR` + inject session cookies from `KAGI_SESSION_FILE` at boot.                                                                                                           | Tab isolation via `openNewTab()` replaces commit `42e4c87`'s per-request tempdir, which was only needed because of missing tab hygiene under `puppeteer-real-browser`. |
| DEC-004 | Keep `/translate` single-item HTTP endpoint. `runBatchTranslation()` is an internal helper, not exposed.                                                                                        | No change to `KagiClient.translate()` contract or any caller.                                                                                                          |
| DEC-005 | Fail-fast: eager login verify at boot; any browser/context crash or session-expiry exits with `process.exit(1)`. **No** silent auto-relaunch.                                                   | Orchestrator (docker-compose / K8s) handles restart. User's stated preference: surface failures clearly.                                                               |
| DEC-006 | Serial 1 tab at a time. Keep current queue env (`KAGI_MIN_INTERVAL_MS`, `KAGI_MAX_QUEUE_DEPTH`, `KAGI_MAX_QUEUE_WAIT_MS`, `KAGI_MAX_RETRIES`, `KAGI_RETRY_BASE_MS`, `KAGI_REQUEST_TIMEOUT_MS`). | Parallel tabs break the "close old tab on openNewTab" invariant and make Cloudflare/UI racing worse. Current translator is already serial-per-room.                    |

## 3. Scope

### 3.1 In scope

- `packages/kagi-sidecar/src/browser-service.ts` — rewritten around `patchright` singleton + `openNewTab()`.
- `packages/kagi-sidecar/src/services/human-interaction.service.ts` — ported from PoC, using patchright `Page` signatures.
- `packages/kagi-sidecar/src/services/batch-translation.service.ts` — new internal helper.
- `packages/kagi-sidecar/src/utils/{bezier,humanizer-config,kagi-session-cookies}.ts` — ported from PoC.
- `packages/kagi-sidecar/src/constants/{kagi-ui,delay-config,humanizer-config}.ts` — extended to cover missing PoC keys (Cloudflare timeouts, login-check selectors, humanizer constants, `KAGI_ORIGIN_URL`, `KAGI_SESSION_FILE_ENV`).
- `packages/kagi-sidecar/src/types/{browser.interface,human-interaction.interface}.ts` — typed against patchright `Page`, with `openNewTab?()` added.
- `packages/kagi-sidecar/src/runtime-config.ts` — new envs: `USER_DATA_DIR`, `KAGI_SESSION_FILE`, `KAGI_HEADLESS`.
- `packages/kagi-sidecar/src/index.ts` — eager launch + login verify before Elysia `listen`, `process.exit(1)` on any boot failure, `SIGTERM`/`SIGINT` graceful shutdown.
- `packages/kagi-sidecar/src/server.ts` — `/health` reports ready only after boot verify; `/translate` handler signature unchanged.
- `packages/kagi-sidecar/package.json` — add `patchright ^1.59.0`; remove `puppeteer-real-browser`, `@forad/puppeteer-humanize`, `ghost-cursor`.
- `packages/kagi-sidecar/Dockerfile` — patchright-compatible Chromium launch deps (mirror `nghien_cuu_cua_toi/Dockerfile`).
- `docker-compose.yml` — mount `./secrets:/app/secrets:ro` and `./user-data:/app/user-data`; set `KAGI_SESSION_FILE` env.
- Tests ported or adapted from PoC: `browser.service.test.ts`, `browser.service.openNewTab.test.ts`, `human-interaction.service.test.ts`, `batch-translation.service.test.ts`, plus utils tests.

### 3.2 Out of scope (non-goals)

- Any change to `@chatwork-bot/provider-kagi` beyond what is incidental — `types.ts`, `kagi-client.ts`, `url-builder.ts`, `index.ts` stay the same.
- Other providers: `provider-gemini`, `provider-openai`, `provider-cursor`.
- `dataset-runner`, `dashboard`, `webhook-logger`, `chatwork`, `core`, `message-queue`.
- `translator` routing, queue, and dual-lane logic.
- Ports of PoC research-only tooling: `reading-level-sweep.service.ts`, `src/index.ts` batch entrypoint, `readInputFile`, `inputs/*.json`.
- HTTP contract of `/translate` — still `{text, style, context?}` in, `{translated}` out.
- Exposing `/translate/batch` over HTTP.
- Background session-refresh probes or cookie auto-refresh.
- New metrics / tracing beyond the existing JSON logs.

## 4. Architecture

### 4.1 Topology

```
┌─────────────────────┐     HTTP      ┌───────────────────────────────┐
│  @chatwork-bot/     │──────────────▶│  @chatwork-bot/kagi-sidecar   │
│  provider-kagi      │  /translate   │  (Elysia server, long-run)    │
│  (KagiClient)       │   {text,      │                               │
│                     │    style,     │   ┌────────────────────────┐  │
│  HTTP contract      │    context}   │   │ KagiBrowserService     │  │
│  unchanged          │               │   │   • singleton browser  │  │
│                     │               │   │   • openNewTab()       │  │
│                     │               │   │     per request        │  │
│                     │               │   │   • login verified 1×  │  │
│                     │               │   └─────────┬──────────────┘  │
│                     │               │             │                 │
│                     │               │   ┌─────────▼──────────────┐  │
│                     │               │   │ HumanInteractionService│  │
│                     │               │   │   bezier mouse, typing │  │
│                     │               │   │   bursts, chunk paste, │  │
│                     │               │   │   slider drag          │  │
│                     │               │   └─────────┬──────────────┘  │
│                     │               │             │                 │
│                     │               │    ┌────────▼────────┐        │
│                     │               │    │ patchright      │        │
│                     │               │    │ Chromium        │        │
│                     │               │    │ persistentContext│       │
│                     │               │    └─────────────────┘        │
│                     │               │                               │
│                     │               │   reads  secrets/*.json       │
│                     │               │   persists user-data/         │
└─────────────────────┘               └───────────────────────────────┘
```

### 4.2 File map (PoC → sidecar)

| PoC file                                                                           | Sidecar target                              | Decision                                                                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/services/browser.service.ts`                                                  | `src/browser-service.ts`                    | Replace fully                                                                                                               |
| `src/services/interfaces/browser.interface.ts`                                     | `src/types/browser.interface.ts`            | Port, add `openNewTab?()`                                                                                                   |
| `src/services/human-interaction.service.ts`                                        | `src/services/human-interaction.service.ts` | Replace body, adapt to patchright `Page`                                                                                    |
| `src/services/interfaces/human-interaction.interface.ts`                           | `src/types/human-interaction.interface.ts`  | Port, adapt to patchright `Page`                                                                                            |
| `src/services/batch-translation.service.ts`                                        | `src/services/batch-translation.service.ts` | Port as internal helper                                                                                                     |
| `src/utils/bezier.ts`                                                              | `src/utils/bezier.ts`                       | Port verbatim                                                                                                               |
| `src/utils/humanizer-config.ts`                                                    | `src/utils/humanizer-config.ts`             | Port verbatim                                                                                                               |
| `src/utils/kagi-session-cookies.ts`                                                | `src/utils/kagi-session-cookies.ts`         | Port verbatim                                                                                                               |
| `src/config/humanizer.config.ts`                                                   | `src/constants/humanizer-config.ts`         | Merge into sidecar naming                                                                                                   |
| `src/config/delay.config.ts`                                                       | `src/constants/delay-config.ts`             | Merge new keys in                                                                                                           |
| `src/config/translation.config.ts` (UI labels, selectors, origin URL, session env) | `src/constants/kagi-ui.ts`                  | Merge missing keys in                                                                                                       |
| `src/services/url-builder.service.ts`                                              | (not ported)                                | Sidecar builds `https://translate.kagi.com/?from=auto&to=vi` directly; style/formality/reading-level apply via UI, not URL. |
| `src/services/reading-level-sweep.service.ts`                                      | (not ported)                                | Research-only                                                                                                               |
| `src/errors/browser.error.ts` + `validation.error.ts`                              | (not ported)                                | `KagiSidecarError` is sufficient                                                                                            |
| `src/types/translation.types.ts`                                                   | (not ported)                                | `KagiStyle` / `KAGI_STYLE_PRESETS` already live in `@chatwork-bot/provider-kagi`                                            |
| `src/index.ts` (CLI batch entrypoint)                                              | (not ported)                                | Sidecar is an Elysia server, not a CLI                                                                                      |

### 4.3 Package boundary — what `provider-kagi` keeps

| File                 | Change                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/types.ts`       | None — `KagiStyle`, `KAGI_STYLE_PRESETS`, `KagiTranslateRequest/Response`, `KagiErrorPayload` stay stable. |
| `src/kagi-client.ts` | None — `KagiClient.translate()` still POSTs `{text, style, context}` and parses `{translated}`.            |
| `src/url-builder.ts` | None — still used by `dashboard` for preview and by `translator/free-room-config-store.ts`.                |
| `src/index.ts`       | None.                                                                                                      |

## 5. Runtime Flow

### 5.1 Boot (eager launch + login verify)

```
process start
    │
    ▼
resolveKagiRuntimeConfig(process.env)
    │
    ▼
new KagiBrowserService(config.browser)
    │     humanInteraction = new HumanInteractionService()
    │     options = { minIntervalMs, maxQueueDepth, maxQueueWaitMs,
    │                 maxRetries, retryBaseMs, requestTimeoutMs }
    │     connection = null
    ▼
await service.launch()                            ◄── NEW (was per-request)
    │     resolveChromiumExecutablePath()
    │     mkdir USER_DATA_DIR (recursive)
    │     chromium.launchPersistentContext(USER_DATA_DIR, launchOpts)
    │     page = existingPage or context.newPage()
    │     connection = new BrowserConnection(context, page)
    ▼
await service.verifyStartupSession()              ◄── NEW
    │     if KAGI_SESSION_FILE present and valid:
    │         visitKagiOriginAndInjectSessionCookies(page, context)
    │     verifyLoginSuccess(page):
    │         page.goto('https://kagi.com/settings', { waitUntil: 'domcontentloaded' })
    │         assert URL still starts with 'https://kagi.com/settings'
    │         assert DOM has a[href="/logout"]
    │         assert DOM does NOT have #signInEmailBox, #qr-code-auth
    │     isLoginVerified = true
    ▼
if any step throws:
    console.error(err)
    await service.close()  (best-effort)
    process.exit(1)                               ◄── FAIL-FAST (DEC-005)
    │
    ▼
createKagiServer({ service })
    │
    ▼
process.on('SIGTERM' | 'SIGINT', graceful shutdown)
    │
    ▼
app.listen(config.port)
    │
    ▼
log 'kagi_sidecar_started'
```

`/health` cannot return `ready=true` before `app.listen()` — the network is not accepting yet. Orchestrators can detect not-ready via connection-refused.

### 5.2 Handle one `POST /translate`

```
POST /translate {text, style, context?}
    │
    ▼
isKagiStyle(body.style)?           → 422 VALIDATION_ERROR if not
    │
    ▼
service.translate(request)
    │
    ▼
queueTail backpressure             (unchanged from today)
    │     queuedCount < maxQueueDepth  else 429 BACKPRESSURE
    │     await previous queueTail
    │     queueWaitMs ≤ maxQueueWaitMs else 429
    ▼
translateWithRetries(request)
    │
    ▼
applyMinInterval()                 (unchanged)
    │
    ▼
executeTranslation(request)
    │
    │  NO connect() call here. NO mkdir/rmdir profile dir.
    │
    ├─ if this.hasServedFirstRequest === false:
    │       // First HTTP request after boot — reuse the tab that launch() left open.
    │       // That tab is currently on kagi.com/settings (from verifyLoginSuccess);
    │       // page.goto below navigates it to translate.kagi.com.
    │       page = connection.getPage()
    │       this.hasServedFirstRequest = true
    │  else:
    │       await service.openNewTab()
    │       // newPage = context.newPage()
    │       // connection = BrowserConnection(context, newPage)
    │       // oldPage.close()
    │       page = connection.getPage()
    │
    ├─ preset = KAGI_STYLE_PRESETS[request.style]
    ├─ clampedText = clampInputText(request.text)
    │
    ├─ humanDelayBeforeNavigate(navUrl)
    ├─ page.goto('https://translate.kagi.com/?from=auto&to=vi',
    │            { waitUntil: 'networkidle', timeout })
    ├─ waitForCloudflareReady(page)               // DOM-based, not sleep
    │
    ├─ clearSourceTextInput(page)
    ├─ fillSourceTextInput(page, clampedText, charCount)
    │       ≤ HUMAN_INPUT_THRESHOLD → typeIntoContentEditable
    │       > threshold             → chunkPaste
    │
    ├─ clickTranslationSettingsButton(page)
    │
    ├─ PHASE 1 (baseline reset + URL verify):
    │       clearTranslationContext
    │       clickSpeakerGenderOption("Unknown")
    │       clickAddresseeGenderOption("Unknown")
    │       setReadingLevel("standard")
    │       clickTranslationStyleOption("Natural")
    │       verifyUrlNotContains: context=, speaker_gender=, addressee_gender=,
    │                             style=, language_complexity=, formality=, formality_context=
    │
    ├─ PHASE 2 (apply target settings + URL verify):
    │       if request.context: fillTranslationContext
    │       if preset.readingLevel !== 'standard': setReadingLevel + verify
    │       if preset.translationType !== 'natural': clickTranslationStyleOption + verify
    │       if preset.formality !== 'standard': clickFormalityOption + waitForFormalityUrlUpdate
    │
    ├─ waitForTranslationOutputStable(page, charCount)
    ├─ finalUrl = page.url()
    └─ translated = scrapeTranslatedText(page)
    │
    ▼
return { translated, attempts, queueWaitMs, transportLatencyMs }
    │
    ▼
HTTP 200 { translated }
```

### 5.3 Tab lifecycle invariant

```
Request 1 (reuse):            Request 2:                       Request 3:
┌──────────────────┐          ┌──────────────────┐             ┌──────────────────┐
│ Browser (alive)  │          │ Browser (alive)  │             │ Browser (alive)  │
│ ┌──────────────┐ │          │ ┌──────────────┐ │             │ ┌──────────────┐ │
│ │  Tab A       │ │  close   │ │  Tab B (new) │ │  close      │ │  Tab C (new) │ │
│ │              │ │◄─────────│ │              │ │◄────────────│ │              │ │
│ └──────────────┘ │          │ └──────────────┘ │             │ └──────────────┘ │
└──────────────────┘          └──────────────────┘             └──────────────────┘
```

**Invariant:** exactly one active tab at all times. `openNewTab()` only closes the old tab **after** the new one is ready. State isolation:

- Gone per tab: DOM, `localStorage`, `sessionStorage`, event listeners, CodeMirror state, settings-dialog state.
- Shared across tabs (on purpose): origin cookies for `kagi.com` (auth token), patchright anti-detect patches, `USER_DATA_DIR/Default/Preferences`.

This is the replacement for commit `42e4c87`'s per-request tempdir. The drift seen under `puppeteer-real-browser` came from tabs carrying state forward. Closing the tab erases what mattered; keeping the auth cookie is intentional.

### 5.4 Error classes and actions

| Situation                                                                                                                              | Detected as                                                                                                                                                                            | Action                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Boot — `KAGI_SESSION_FILE` invalid **and** login verify fails                                                                          | `BrowserAutomationError('login-verification-failed')`                                                                                                                                  | `service.close()` best-effort → `process.exit(1)` before `listen`.                                                  |
| Boot — patchright `launchPersistentContext` fails                                                                                      | Native error                                                                                                                                                                           | Log → `process.exit(1)`.                                                                                            |
| Runtime — `openNewTab` called with `connection === null`                                                                               | `BrowserAutomationError('open-new-tab')`                                                                                                                                               | `service.close()` → `process.exit(1)`.                                                                              |
| Runtime — `page.goto` or subsequent interaction throws with cause message containing `Target page, context or browser has been closed` | Caught in `executeTranslation`                                                                                                                                                         | Log → `process.exit(1)`. Browser died mid-flight; no useful state remains.                                          |
| Runtime — anti-abuse text detected (`Verify you are human`, `rate limit`, etc.)                                                        | `KagiSidecarError('ANTI_ABUSE', 429)`                                                                                                                                                  | HTTP 429 to caller. **Do not exit.** Business-logic failure.                                                        |
| Runtime — session expired mid-process                                                                                                  | Surfaces as `KagiSidecarError('UI_INTERACTION', 502)` when Phase 1 settings selectors do not render (Kagi redirected to login). We do **not** re-run `verifyLoginSuccess` per request. | HTTP 502. Operator watches for a spike of 502s and rotates the cookie file; the container does not exit on its own. |
| Runtime — per-request timeout (`KAGI_REQUEST_TIMEOUT_MS`, default 120 000 ms)                                                          | `KagiSidecarError('TIMEOUT', retryable=true)`                                                                                                                                          | Retry ≤ `maxRetries`; else HTTP 504. **Do not exit.**                                                               |
| Runtime — UI-interaction fail (selector timeout, URL verify fail)                                                                      | `KagiSidecarError('UI_INTERACTION', 502)`                                                                                                                                              | HTTP 502. Do not exit unless browser is dead.                                                                       |
| Runtime — HTTP client closes prematurely                                                                                               | Elysia abort                                                                                                                                                                           | Existing handling.                                                                                                  |

Rule: **system-level failures** (dead browser, closed context, expired login) exit the process. **Business failures** (rate limit, per-request timeout, bad input) return HTTP errors. The sidecar never auto-relaunches the browser silently.

### 5.5 Graceful shutdown

```
SIGTERM / SIGINT
    │
    ▼
Elysia stops accepting new connections (via app.stop or equivalent)
    │
    ▼
await currentInFlight  (queueTail chain reaches the end)
    │
    ▼
await service.close()  (context.close → Chromium exits)
    │
    ▼
process.exit(0)
```

`docker-compose.yml` already sets `stop_grace_period: 35s` on the translator (commit `06070cd`). The kagi-sidecar service needs its own `stop_grace_period` aligned with `KAGI_REQUEST_TIMEOUT_MS` (default 120 000 ms) — set `stop_grace_period: 125s` in step 17 so graceful shutdown can drain the longest single request.

## 6. Configuration

### 6.1 New environment variables

| Var                 | Default                                                                                 | Purpose                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `USER_DATA_DIR`     | `./user-data` (local), `/app/user-data` (Docker)                                        | Persistent Chrome profile. Mount as volume so cookies survive container restarts.         |
| `KAGI_SESSION_FILE` | (none; falls back to `./secrets/kagi-session.json` or `/app/secrets/kagi-session.json`) | Absolute path to exported Kagi cookies JSON.                                              |
| `KAGI_HEADLESS`     | `false`                                                                                 | `true` to run Chromium headless (non-default; Kagi + Cloudflare behave better with Xvfb). |

### 6.2 Kept environment variables (unchanged)

`KAGI_PORT` (default 3002), `KAGI_MIN_INTERVAL_MS` (1500), `KAGI_MAX_QUEUE_DEPTH` (10), `KAGI_MAX_QUEUE_WAIT_MS` (15000), `KAGI_MAX_RETRIES` (2), `KAGI_RETRY_BASE_MS` (1000), `KAGI_REQUEST_TIMEOUT_MS` (120000). Parsed in `runtime-config.ts`.

### 6.3 Docker volumes

```yaml
# docker-compose.yml — kagi-sidecar service
volumes:
  - ./secrets:/app/secrets:ro # kagi-session.json (read-only)
  - ./user-data:/app/user-data # persistent Chrome profile
environment:
  KAGI_SESSION_FILE: /app/secrets/kagi-session.json
  USER_DATA_DIR: /app/user-data
restart: on-failure:3 # stop after 3 fails; alert ops
stop_grace_period: 35s # unchanged
```

### 6.4 Secrets hygiene

- Add `secrets/` to `.gitignore` (matching the existing `inputs/` pattern in the repo).
- Verify `.dockerignore` does **not** exclude `secrets/` during build — the container reads it at runtime via the mount, not from the image.
- `secrets/kagi-session.json` is provided manually by ops; there is no auto-refresh.

## 7. Testing Strategy

### 7.1 Unit tests (Bun test, colocated per `ai_rules/test-colocation.md`)

| Test file                                                                              | Validates                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/batch-translation.service.test.ts`                                       | item[0] does not call `openNewTab`; item[i>0] calls exactly once; fail-fast aborts remaining items; `browserService.close()` runs in `finally`.                                                                    |
| `src/services/human-interaction.service.test.ts`                                       | Bezier path has intermediate points; typing bursts insert mistakes + backspace; `chunkPaste` splits body by random chunk size with tail typed; `dragSlider` falls back to `.value` set when rect invalid.          |
| `src/browser-service.test.ts`                                                          | `launch()` creates a `BrowserConnection`; `translate()` runs the two-phase flow; `isLoginVerified` is set true after first success and skipped thereafter; HTTP-level errors are propagated as `KagiSidecarError`. |
| `src/browser-service.openNewTab.test.ts`                                               | `openNewTab()` opens the new page **before** closing the old one; connection reference is replaced; throws when called with `connection === null`.                                                                 |
| `src/utils/bezier.test.ts`, `humanizer-config.test.ts`, `kagi-session-cookies.test.ts` | Ported from PoC as-is.                                                                                                                                                                                             |
| `src/constants/*.test.ts`, `src/runtime-config.test.ts`, `src/types/errors.test.ts`    | Existing tests — kept.                                                                                                                                                                                             |

### 7.2 Integration tests

`src/server.test.ts` (existing) — extended to verify:

- `/health` does not respond before boot verify completes (handled by the fact that `listen` hasn't been called).
- `/translate` returns 422 on unknown style, 429 on backpressure, 502 on `UI_INTERACTION`, 200 on success with a mocked service.

### 7.3 E2E (gated)

- New `tests/e2e/kagi-sidecar.e2e.test.ts` — launches the real sidecar process, hits `/translate` with `{text: "Xin chào", style: "Clear"}`, expects a non-empty `translated` string.
- Gated by env `KAGI_E2E=true` and presence of a valid `KAGI_SESSION_FILE`. Not part of CI.
- Package script: `bun test tests/e2e` (runs only when the env is set).

### 7.4 Coverage target

- `browser-service.ts`, `batch-translation.service.ts`, `human-interaction.service.ts` ≥ 95 %, matching the PoC.
- Rest of `kagi-sidecar` ≥ current coverage (do not regress).

## 8. Migration Plan (step order so the tree stays buildable)

| #   | Step                                                                                                                                                                                                                                                                                                                                                               | Files                                                     | Verify                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Swap deps: add `patchright ^1.59.0`; remove `puppeteer-real-browser`, `@forad/puppeteer-humanize`, `ghost-cursor`.                                                                                                                                                                                                                                                 | `packages/kagi-sidecar/package.json`, `bun.lock`          | `bun install` passes.                                                       |
| 2   | Grep whole monorepo for the three removed deps.                                                                                                                                                                                                                                                                                                                    | `src/**/*.ts`                                             | After step 19: zero hits. Intermediate steps may have transient references. |
| 3   | Port `src/utils/bezier.ts` and `src/utils/humanizer-config.ts`.                                                                                                                                                                                                                                                                                                    | `packages/kagi-sidecar/src/utils/`                        | Colocated tests pass.                                                       |
| 4   | Port `src/utils/kagi-session-cookies.ts`.                                                                                                                                                                                                                                                                                                                          | `packages/kagi-sidecar/src/utils/kagi-session-cookies.ts` | Test passes.                                                                |
| 5   | Merge `humanizer.config.ts` into `src/constants/humanizer-config.ts`.                                                                                                                                                                                                                                                                                              | `packages/kagi-sidecar/src/constants/humanizer-config.ts` | Test passes.                                                                |
| 6   | Extend `src/constants/delay-config.ts` with keys PoC has (`CLOUDFLARE_VERIFICATION_TIMEOUT_MS`, `CLOUDFLARE_VERIFICATION_POLL_MS`, `POST_DISMISS_SETTINGS_MS`, `POST_STABLE_EXTRA_MS`, `TRANSLATION_OUTPUT_POLL_MS`, etc.).                                                                                                                                        | `packages/kagi-sidecar/src/constants/delay-config.ts`     | Test passes.                                                                |
| 7   | Extend `src/constants/kagi-ui.ts` with missing selectors (`LOGGED_IN_INDICATOR`, `SIGNIN_EMAIL_INPUT`, `SIGNIN_QR_AUTH`, `FORMALITY_OPTION_LABEL_SPAN`, `TRANSLATION_STYLE_OPTION_LABEL_SPAN`, `SPEAKER_GENDER_OPTION_LABEL_SPAN`, `ADDRESSEE_GENDER_OPTION_LABEL_SPAN`, etc.) and constants `KAGI_ORIGIN_URL`, `KAGI_SESSION_FILE_ENV`, `KAGI_SESSION_FILE_NAME`. | `packages/kagi-sidecar/src/constants/kagi-ui.ts`          | Test passes.                                                                |
| 8   | Create `src/types/browser.interface.ts` with `IBrowserService`, `IBrowserConnection`, `TranslateResult`, and optional `openNewTab?()`.                                                                                                                                                                                                                             | new file                                                  | `typecheck` passes.                                                         |
| 9   | Replace `src/types/human-interaction.interface.ts` to use patchright `Page`.                                                                                                                                                                                                                                                                                       | file                                                      | `typecheck` passes.                                                         |
| 10  | Replace `src/services/human-interaction.service.ts` with the PoC implementation, typed against patchright.                                                                                                                                                                                                                                                         | file                                                      | Ported tests pass.                                                          |
| 11  | Create `src/services/batch-translation.service.ts` (ported from PoC).                                                                                                                                                                                                                                                                                              | new file                                                  | Ported tests pass.                                                          |
| 12  | Rewrite `src/browser-service.ts` on patchright: class `KagiBrowserService` implements `IBrowserService`, exposes `launch / openNewTab / translate / close`, with `verifyLoginSuccess`, `waitForCloudflareReady`, session-cookie injection, two-phase URL verify, `isLoginVerified` flag. `close()` resets the flag.                                                | file                                                      | Ported + adapted tests pass.                                                |
| 13  | Update `src/runtime-config.ts` to add `USER_DATA_DIR`, `KAGI_SESSION_FILE`, `KAGI_HEADLESS`.                                                                                                                                                                                                                                                                       | file                                                      | Test passes.                                                                |
| 14  | Update `src/index.ts`: eagerly `await service.launch()` + `verifyStartupSession()` **before** `app.listen`; on any throw, `service.close()` best-effort and `process.exit(1)`. Register `SIGTERM`/`SIGINT` shutdown handler.                                                                                                                                       | file                                                      | Boot smoke: valid cookie → listens; missing cookie → `exit 1`.              |
| 15  | Update `src/server.ts`: no structural change beyond using the new service API.                                                                                                                                                                                                                                                                                     | file                                                      | `server.test.ts` passes.                                                    |
| 16  | Update `packages/kagi-sidecar/Dockerfile`: install Chromium/patchright system deps (fonts, libs) matching `nghien_cuu_cua_toi/Dockerfile`; drop puppeteer setup.                                                                                                                                                                                                   | `Dockerfile`                                              | `docker compose build` passes.                                              |
| 17  | Update `docker-compose.yml`: mount `./secrets:/app/secrets:ro`, `./user-data:/app/user-data`; set `KAGI_SESSION_FILE` and `USER_DATA_DIR` env; set `restart: on-failure:3`; set `stop_grace_period: 125s` on the kagi-sidecar service (align with default 120 s `KAGI_REQUEST_TIMEOUT_MS` + buffer).                                                               | `docker-compose.yml`                                      | `docker compose up` logs `kagi_sidecar_started`.                            |
| 18  | Add `secrets/` to `.gitignore` (if not already).                                                                                                                                                                                                                                                                                                                   | `.gitignore`                                              | `git status` shows no secrets leak.                                         |
| 19  | Grep verify: zero imports of the three removed deps across monorepo.                                                                                                                                                                                                                                                                                               | all                                                       | Grep returns empty.                                                         |
| 20  | Run `bun test && bun run typecheck && bun run lint` at repo root.                                                                                                                                                                                                                                                                                                  | all                                                       | Green.                                                                      |
| 21  | Manual e2e: `curl -X POST sidecar:PORT/translate -d '{"text":"Xin chào","style":"Clear"}'`.                                                                                                                                                                                                                                                                        | runtime                                                   | 200 with `translated`.                                                      |
| 22  | Manual integration: 5 sequential messages from translator hit sidecar; log trace shows one `launch` at boot, `openNewTab` on requests 2–5, one `close` at shutdown.                                                                                                                                                                                                | runtime                                                   | Clean log trace.                                                            |

## 9. Risks

| #   | Risk                                                                             | Likelihood         | Impact                  | Mitigation                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------- | ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `patchright` runs unstably on Bun (internal Playwright uses some Node APIs).     | Medium             | High (blocks migration) | Validate at step 1 with an install + import smoke. If unstable, escalate: try mainline `playwright` first, and only fall back to keeping `puppeteer-real-browser` if neither works. |
| R2  | Docker image deps differ between `puppeteer-real-browser` and patchright.        | Medium             | Medium                  | Mirror PoC `Dockerfile` (known-good) into `packages/kagi-sidecar/Dockerfile`.                                                                                                       |
| R3  | Session-cookie file leaks via git or image.                                      | Low                | High                    | `.gitignore` `secrets/` (step 18); never `COPY secrets/` in Dockerfile; volume-mount only at runtime.                                                                               |
| R4  | Cookies expire → sidecar restart loop.                                           | Medium             | Medium                  | `restart: on-failure:3` so the loop is bounded; operations runbook: rotate `kagi-session.json`.                                                                                     |
| R5  | Translator queues more than `maxQueueDepth` → 429s on the hot path.              | Low                | Medium                  | Already handled by translator retry on 429; no change required, but smoke test confirms.                                                                                            |
| R6  | Someone accidentally edits `provider-kagi/url-builder.ts` thinking it is unused. | Low                | Medium                  | Dashboard and `translator/free-room-config-store.ts` still import it; lint / code review catches this.                                                                              |
| R7  | Cloudflare verification stalls > timeout.                                        | Low                | Medium                  | `waitForCloudflareReady` is DOM-based with an explicit timeout; per-request retry already covers transient stalls.                                                                  |
| R8  | Kagi changes DOM selectors or label text.                                        | Medium (over time) | High                    | Smoke tests (step 21–22) catch it; selectors are centralised in `kagi-ui.ts`. This is ongoing maintenance, not migration scope.                                                     |
| R9  | Graceful shutdown cuts in-flight requests mid-translate.                         | Low                | Low                     | `stop_grace_period: 35s` already accommodates the 30 s `requestTimeoutMs`; handler `await`s the queue tail.                                                                         |

## 10. Assumptions

- **A1** Docker is the only supported deployment. No bare-metal Bun path needs parity.
- **A2** `secrets/kagi-session.json` is provided by ops manually; the sidecar never refreshes it.
- **A3** The translator already handles `KagiSidecarError` with `retryable: true` (status 429/504) correctly. Not re-validated as part of this work, only smoke-tested.
- **A4** JSON-log output is enough; no OpenTelemetry or Prometheus metrics are added here.
- **A5** `KAGI_STYLE_PRESETS` (the 12 presets) do not change. The presets are mapped to UI clicks; no new preset is introduced.

## 11. Definition of Done

- `bun test && bun run typecheck && bun run lint` pass at monorepo root.
- `docker compose up` starts `kagi-sidecar` with `KAGI_SESSION_FILE` set; the container logs `kagi_sidecar_started`; `/health` returns `{ ok: true, ready: true }`.
- A live `curl` against `/translate` with 5 sequential messages returns 5 successful translations; logs show one `launch` event, four `openNewTab` events, zero `relaunch` events.
- Translator is observed routing Chatwork traffic through the sidecar and receiving translated replies, end to end, in a manual smoke run.
- Zero imports of `puppeteer-real-browser`, `@forad/puppeteer-humanize`, `ghost-cursor` remain anywhere in the monorepo.
