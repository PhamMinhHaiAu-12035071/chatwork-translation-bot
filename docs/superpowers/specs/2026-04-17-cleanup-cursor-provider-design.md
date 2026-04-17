# Cleanup Cursor Provider — Design

**Date:** 2026-04-17
**Status:** Approved (pending spec review)
**Scope:** Remove `cursor` provider entirely. Keep only `gemini` and `openai`.

## Context

`@chatwork-bot/provider-cursor` was a LOCAL-DEV-ONLY provider backed by the
`cursor-api-proxy` binary (from `github:anyrobert/cursor-api-proxy`). It is no
longer needed. This design removes the package, all registrations,
infrastructure glue (Docker, scripts, root deps), and cursor-specific
documentation. Test fixtures that hard-code `provider: 'cursor'` are
re-targeted to `openai` so the underlying multi-provider assertions remain
meaningful.

No production room is currently configured with `provider: cursor` (confirmed
by the user), so no runtime migration / fallback is required.

## Goals

- Remove every first-class reference to the cursor provider from source, tests,
  infra, and docs.
- Preserve existing test coverage: fixtures that exercised multi-provider
  behavior keep doing so with `openai` instead of `cursor`.
- Keep the PR reviewable: one PR, four atomic commits, each green under the
  Definition of Done (`bun test && bun run typecheck && bun run lint`).

## Non-Goals

- No migration / fallback logic for rooms configured with cursor (confirmed
  absent).
- No refactor of the provider registry API, startup-guards shape, or env var
  naming (`AI_PROVIDER` keeps its current contract).
- No changes to dashboard UI (dashboard never surfaced cursor — the API
  already filtered it).

## Impacted Surface

### Packages to delete

- `packages/provider-cursor/` (entire directory)

### Files to modify

| File                                                               | Change                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `packages/translator/package.json`                                 | Remove workspace dep `@chatwork-bot/provider-cursor`                                             |
| `packages/translator/src/bootstrap/register-providers.ts`          | Remove import + `registerProviderPlugin(cursorPlugin)`                                           |
| `packages/translator/src/bootstrap/startup-guards.ts`              | Remove `hasCursor` branch + proxy reachability check + `CURSOR_API_URL` read                     |
| `packages/translator/src/bootstrap/startup-guards.test.ts`         | Remove 2 cursor tests (lines ~79, ~97)                                                           |
| `packages/translator/src/bootstrap/providers.test.ts`              | Remove "registers cursor provider" test                                                          |
| `packages/translator/src/routes/providers.ts`                      | Remove `.filter(id !== 'cursor')` (dead code after removal)                                      |
| `packages/translator/src/routes/providers.test.ts`                 | Rename test to drop "excludes cursor" language; assert list contains only gemini + openai        |
| `packages/translator/src/services/translator-status-store.test.ts` | Replace `provider: 'cursor'` fixtures → `'openai'`                                               |
| `packages/translator/src/services/phase-observer.test.ts`          | Same fixture swap                                                                                |
| `packages/translator/src/types/trace.ts`                           | Remove `'cursor'` from the comment enumerating providers                                         |
| `packages/core/src/services/provider-registry.test.ts`             | Replace `getProviderPlugin('cursor')` error test with another unregistered id (e.g. `'unknown'`) |
| `packages/core/src/types/ai.test.ts`                               | Remove the `toAIProvider('cursor')` assertion line                                               |
| `packages/dataset-runner/src/services/queue-runner.test.ts`        | Generalize error fixture message ("Cursor API call failed" → provider-neutral wording)           |

### Infra

- `docker-compose.dev.yml` — remove env `CURSOR_API_URL` line
- `Dockerfile` — remove 2 `COPY packages/provider-cursor/...` lines
- `scripts/dev.sh` — remove cursor-proxy self-heal logic (port detection, PID
  cleanup, `concurrently` cursor-proxy branch). Keep docker lifecycle
  (`up`/`down`/`logs`) intact.

### Root config

- `package.json` — remove `"cursor-proxy"` script + `cursor-api-proxy` devDep
- `bun.lock` — regenerate via `bun install`

### Docs to delete

- `docs/operations/cursor-api-proxy-risk.md`
- `docs/2026-03-06-cursor-cli-provider-performance-analysis.md`
- `docs/archive/2026-03-11-cursor-retry.md`
- `docs/superpowers/specs/2026-03-11-cursor-retry-design.md`

Historical specs/plans that _mention_ cursor but are about broader pipeline
work (e.g. `2026-03-11-fail-fast-unified`, `2026-03-10-enhanced-translation-pipeline`)
are left untouched to preserve context.

### Docs to inspect + possibly edit

- `ai_rules/architecture-patterns.md`
- `ai_rules/project-structure.md`
- `ai_rules/security.md`
- `ai_rules/commands.md`
- `CLAUDE.md`

Action: grep each for `cursor` and remove / adjust any cursor-specific
guidance. Keep generic provider-abstraction discussion.

## Commit Boundaries (one PR, four commits)

### Commit 1 — `refactor(providers): remove cursor provider package and registration`

- Delete `packages/provider-cursor/`
- Edit `packages/translator/package.json`
- Edit `packages/translator/src/bootstrap/register-providers.ts`
- Edit `packages/translator/src/bootstrap/startup-guards.ts`
- Edit `packages/translator/src/routes/providers.ts`
- Edit `packages/translator/src/types/trace.ts`

After this commit `bun run typecheck` will fail on tests that still reference
`cursor`. That is expected; Commit 2 fixes it. The commit itself is still
atomic — reverting it cleanly restores the provider.

### Commit 2 — `test: drop cursor fixtures and update provider tests`

- Edit `startup-guards.test.ts`, `providers.test.ts` (bootstrap)
- Edit `providers.test.ts` (routes)
- Edit `translator-status-store.test.ts`, `phase-observer.test.ts`
- Edit `provider-registry.test.ts`, `ai.test.ts`
- Edit `queue-runner.test.ts`

Gate: `bun test && bun run typecheck && bun run lint` green.

### Commit 3 — `chore(infra): remove cursor-proxy from docker, scripts and root deps`

- Edit `docker-compose.dev.yml`
- Edit `Dockerfile`
- Edit `scripts/dev.sh` (remove cursor-proxy logic; keep docker lifecycle)
- Edit `package.json` (root)
- Regenerate `bun.lock` via `bun install`

Gate: `bun run dev` starts successfully without `CURSOR_API_URL`; `bun run dev:down`
tears down cleanly.

### Commit 4 — `docs: remove cursor-specific documentation`

- Delete the four cursor-specific docs listed above
- Grep `ai_rules/*.md` + `CLAUDE.md` for `cursor` and remove / adjust
  guidance in-place

Gate: repo-wide grep `cursor-api-proxy | provider-cursor | CURSOR_API_URL`
returns zero matches outside `node_modules` / `.git` / CSS (`cursor: pointer`).

## Verification

After each commit:

- `bun run typecheck`
- `bun test`
- `bun run lint`

After Commit 3:

- `bun run dev` — inspect startup banner: only `gemini` + `openai` rows, no
  cursor reachability warning.
- `bun run dev:down` — clean teardown.

Final PR gate:

```bash
bun test && bun run typecheck && bun run lint
```

Grep check (outside `node_modules`, `.git`, and CSS):

```bash
grep -ri "cursor-api-proxy\|provider-cursor\|CURSOR_API_URL" \
  --exclude-dir=node_modules --exclude-dir=.git
```

Expected: zero matches.

## Risks & Mitigations

- **`scripts/dev.sh` entanglement.** Cursor-proxy logic is interleaved with
  docker lifecycle (~30 lines across 2–285). Mitigation: remove by named
  helper (`is_local_host`, port detection, `_health`, `_startup_proxy`,
  `_cleanup_proxy`), keep `concurrently` block reduced to docker only. Test
  `bun run dev` + `bun run dev:down` after editing.
- **`bun.lock` transitive deps.** Removing `cursor-api-proxy` leaves stale
  transitive entries. Mitigation: run `bun install` (not `--frozen-lockfile`)
  to regenerate.
- **Fixture semantics.** Tests that used `provider: 'cursor'` were asserting
  multi-provider behavior, not cursor-specific behavior. Mitigation: swap to
  `'openai'` so the assertion remains meaningful.
- **`ai_rules/*.md` drift.** Some rules may describe cursor. Mitigation:
  grep in Commit 4 and edit in place.

## Rollback

Each commit is atomic. `git revert <sha>` restores the specific layer:

- Revert Commit 1 → provider + registration back.
- Revert Commit 2 → tests back referencing cursor (requires 1 too).
- Revert Commit 3 → docker/scripts/root deps back.
- Revert Commit 4 → docs back.

For a full rollback, revert in reverse order (4 → 3 → 2 → 1).

## Out of Scope

- Migration / fallback for rooms configured with cursor (none exist).
- Renaming `AI_PROVIDER` env var or changing provider-registry API.
- Dashboard UI changes (dashboard never exposed cursor).
- Touching non-cursor-specific historical docs that happen to mention cursor.
