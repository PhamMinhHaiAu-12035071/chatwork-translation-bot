# Cleanup Cursor Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `cursor` provider entirely from the monorepo (package, registrations, tests, Docker/scripts glue, root deps, and cursor-specific docs), keeping only `gemini` + `openai`.

**Architecture:** Four-commit linear cleanup on one PR. Delete the package and its registrations first, then update shared tests, then strip infra + root-dep plumbing, then purge cursor-specific docs. Each commit ends green under `bun test && bun run typecheck && bun run lint`.

**Tech Stack:** Bun 1.3, TypeScript 5.4, Elysia, Zod, Docker Compose, husky + lint-staged, commitlint.

**Spec:** [docs/superpowers/specs/2026-04-17-cleanup-cursor-provider-design.md](../specs/2026-04-17-cleanup-cursor-provider-design.md)

---

## Execution order (important)

Tasks 1 and 2 are **paired**: the source deletion in Task 1 makes the shared-test fixtures in Task 2 invalid. If you commit Task 1 alone while Task 2 edits are still un-made on disk, the pre-commit hook's `bun test` step runs against the working tree and fails.

**Recommended flow:**

1. Execute all file edits in Task 1 (steps 1–7) — do NOT commit yet.
2. Execute all file edits in Task 2 (steps 1–8) — do NOT commit yet.
3. At this point the full working tree is consistent: cursor is gone, tests are updated.
4. `git add` only the Task 1 file list and commit (hook runs against the full working tree → passes).
5. `git add` only the Task 2 file list and commit (same).
6. Proceed to Task 3 and Task 4 normally — each is internally consistent on its own.

`lint-staged` temporarily stashes unstaged changes to lint only what you staged, then restores. `bun run typecheck` and `bun run test` then run against the fully restored working tree, so both commits see a green suite.

---

## File Structure (what changes per task)

| Task | Type   | Path                                                               |
| ---- | ------ | ------------------------------------------------------------------ |
| 1    | delete | `packages/provider-cursor/` (entire directory)                     |
| 1    | modify | `packages/translator/package.json`                                 |
| 1    | modify | `packages/translator/src/bootstrap/register-providers.ts`          |
| 1    | modify | `packages/translator/src/bootstrap/startup-guards.ts`              |
| 1    | modify | `packages/translator/src/routes/providers.ts`                      |
| 1    | modify | `packages/translator/src/types/trace.ts`                           |
| 2    | modify | `packages/translator/src/bootstrap/startup-guards.test.ts`         |
| 2    | modify | `packages/translator/src/bootstrap/providers.test.ts`              |
| 2    | modify | `packages/translator/src/routes/providers.test.ts`                 |
| 2    | modify | `packages/translator/src/services/translator-status-store.test.ts` |
| 2    | modify | `packages/translator/src/services/phase-observer.test.ts`          |
| 2    | modify | `packages/core/src/services/provider-registry.test.ts`             |
| 2    | modify | `packages/core/src/types/ai.test.ts`                               |
| 2    | modify | `packages/dataset-runner/src/services/queue-runner.test.ts`        |
| 3    | modify | `docker-compose.dev.yml`                                           |
| 3    | modify | `Dockerfile`                                                       |
| 3    | modify | `scripts/dev.sh`                                                   |
| 3    | modify | `package.json` (root)                                              |
| 3    | modify | `bun.lock` (regenerated)                                           |
| 4    | delete | `docs/operations/cursor-api-proxy-risk.md`                         |
| 4    | delete | `docs/2026-03-06-cursor-cli-provider-performance-analysis.md`      |
| 4    | delete | `docs/archive/2026-03-11-cursor-retry.md`                          |
| 4    | delete | `docs/superpowers/specs/2026-03-11-cursor-retry-design.md`         |
| 4    | modify | `ai_rules/security.md`                                             |
| 4    | modify | `ai_rules/architecture-patterns.md`                                |
| 4    | modify | `ai_rules/project-structure.md`                                    |
| 4    | modify | `ai_rules/commands.md`                                             |
| 4    | modify | `CLAUDE.md`                                                        |
| 4    | modify | `README.md`                                                        |

---

## Task 1: Remove cursor provider package and registrations

**Files:**

- Delete: `packages/provider-cursor/`
- Modify: `packages/translator/package.json`
- Modify: `packages/translator/src/bootstrap/register-providers.ts`
- Modify: `packages/translator/src/bootstrap/startup-guards.ts`
- Modify: `packages/translator/src/routes/providers.ts`
- Modify: `packages/translator/src/types/trace.ts`

**Note (TDD exception):** This task deletes code. Tests that exercise the deleted code live in Task 2 and will fail after Task 1. That is expected and documented — Task 2 immediately closes the gap. Do not try to keep the test suite green between Task 1 and Task 2.

### Step 1: Delete the `provider-cursor` package directory

- [ ] Run from repo root:

```bash
rm -rf packages/provider-cursor
```

Verify it's gone:

```bash
ls packages/ | grep -i cursor || echo "OK: cursor package deleted"
```

Expected: `OK: cursor package deleted`

### Step 2: Remove the workspace dependency from translator

- [ ] Open `packages/translator/package.json`. In the `dependencies` block, remove the line `"@chatwork-bot/provider-cursor": "workspace:*",`. Leave the rest untouched (line range is ~line 20; confirm with `grep -n provider-cursor packages/translator/package.json`).

- [ ] Verify:

```bash
grep -n "provider-cursor" packages/translator/package.json || echo "OK: translator no longer depends on provider-cursor"
```

Expected: `OK: translator no longer depends on provider-cursor`

### Step 3: Drop cursor from the provider registration bootstrap

- [ ] Replace the full contents of `packages/translator/src/bootstrap/register-providers.ts` with:

```ts
import { registerProviderPlugin } from '@chatwork-bot/core'
import { geminiPlugin } from '@chatwork-bot/provider-gemini'
import { openaiPlugin } from '@chatwork-bot/provider-openai'

export function registerAllProviders(): void {
  registerProviderPlugin(geminiPlugin)
  registerProviderPlugin(openaiPlugin)
}
```

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/bootstrap/register-providers.ts || echo "OK"
```

Expected: `OK`

### Step 4: Simplify startup guards — no cursor reachability probe

- [ ] Replace the full contents of `packages/translator/src/bootstrap/startup-guards.ts` with:

```ts
import { listProviderPlugins } from '@chatwork-bot/core'

export async function runStartupGuards(): Promise<void> {
  const plugins = listProviderPlugins()

  if (plugins.length === 0) {
    throw new Error('[startup] No providers registered. Did registerAllProviders() run?')
  }
}
```

Rationale: the cursor-proxy fetch probe + `CURSOR_API_URL` read existed solely to warn about the cursor provider. With cursor gone, only the "no providers registered" guard remains.

- [ ] Verify:

```bash
grep -n -i "cursor\|CURSOR_API_URL" packages/translator/src/bootstrap/startup-guards.ts || echo "OK"
```

Expected: `OK`

### Step 5: Drop the dashboard-exposed cursor filter

- [ ] Open `packages/translator/src/routes/providers.ts`. Replace the full file contents with:

```ts
import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

export const providersRoute = new Elysia({ name: 'translator:providers' }).get(
  '/api/providers',
  () => {
    const providers = listProviderPlugins().map((plugin) => ({
      id: plugin.manifest.id,
      name: PROVIDER_LABELS[plugin.manifest.id] ?? plugin.manifest.id,
      models: [...plugin.manifest.supportedModels],
      defaultModel: plugin.manifest.defaultModel,
    }))

    return { success: true, data: providers }
  },
)
```

Rationale: the `.filter(id !== 'cursor')` line became dead code the moment cursor was unregistered.

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/routes/providers.ts || echo "OK"
```

Expected: `OK`

### Step 6: Remove cursor from the trace type comment

- [ ] Open `packages/translator/src/types/trace.ts`. Find the comment on what is currently around line 43:

```ts
provider: string // 'gemini' | 'openai' | 'cursor'
```

Replace with:

```ts
provider: string // 'gemini' | 'openai'
```

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/types/trace.ts || echo "OK"
```

Expected: `OK`

### Step 7: Partial typecheck — translator package only

- [ ] Run from repo root:

```bash
bun run --cwd packages/translator typecheck
```

Expected: PASS. The `provider: string` field in `trace.ts` never required the literal `'cursor'`, and runtime-only test failures are invisible to `tsc`.

> Do NOT run `bun test` or the root `bun run typecheck` yet — those will fail until Task 2 fixture swaps are also on disk. That's expected; see "Execution order" at the top of this plan.

### Step 8: (Deferred) Commit — AFTER Task 2 edits are on disk

Do not commit yet. Move to Task 2 and complete its steps 1–8. Once Task 2 edits are on disk, return here and execute:

- [ ] Stage only the source-layer files:

```bash
git add packages/provider-cursor \
        packages/translator/package.json \
        packages/translator/src/bootstrap/register-providers.ts \
        packages/translator/src/bootstrap/startup-guards.ts \
        packages/translator/src/routes/providers.ts \
        packages/translator/src/types/trace.ts
```

- [ ] Commit:

```bash
git commit -m "refactor(translator): remove cursor provider package and registration"
```

The pre-commit hook will run `bun run test` against the full working tree. Because Task 2 edits are already on disk, the test suite is green.

- [ ] Confirm:

```bash
git log --oneline -1
```

Expected: shows the `refactor(translator): ...` commit.

---

## Task 2: Update tests that reference cursor

**Files:**

- Modify: `packages/translator/src/bootstrap/startup-guards.test.ts`
- Modify: `packages/translator/src/bootstrap/providers.test.ts`
- Modify: `packages/translator/src/routes/providers.test.ts`
- Modify: `packages/translator/src/services/translator-status-store.test.ts`
- Modify: `packages/translator/src/services/phase-observer.test.ts`
- Modify: `packages/core/src/services/provider-registry.test.ts`
- Modify: `packages/core/src/types/ai.test.ts`
- Modify: `packages/dataset-runner/src/services/queue-runner.test.ts`

### Step 1: Strip cursor tests from startup-guards.test.ts

- [ ] Replace the full contents of `packages/translator/src/bootstrap/startup-guards.test.ts` with:

```ts
import { beforeEach, describe, expect, it, mock } from 'bun:test'

// Module-level registry — closed over by mock functions so reassignment is visible
let _plugins: {
  manifest: {
    id: string
    supportedModels: readonly string[]
    defaultModel: string
    capabilities: { readonly streaming: boolean }
  }
  create: () => { translate: () => Promise<never> }
}[] = []

class ProviderRegistryBootError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRegistryBootError'
  }
}

// Use mock.module at top level so startup-guards.ts static imports resolve to this mock.
// Without this, router.test.ts / handler.test.ts mocks pollute the shared module cache
// and cause instanceof checks + registry state to use different instances.
void mock.module('@chatwork-bot/core', () => ({
  listProviderPlugins: () => _plugins,
  getProviderPlugin: (id: string) => {
    const plugin = _plugins.find((p) => p.manifest.id === id)
    if (!plugin) throw new ProviderRegistryBootError(`Provider '${id}' not found`)
    return plugin
  },
  registerProviderPlugin: (plugin: (typeof _plugins)[number]) => {
    _plugins.push(plugin)
  },
  resetProviderRegistryForTest: () => {
    _plugins = []
  },
  ProviderRegistryBootError,
}))

describe('runStartupGuards', () => {
  beforeEach(() => {
    _plugins = []
  })

  it('passes without error when at least one provider is registered', async () => {
    _plugins.push({
      manifest: {
        id: 'gemini',
        supportedModels: ['m'],
        defaultModel: 'm',
        capabilities: { streaming: false },
      },
      create: () => ({ translate: () => Promise.reject(new Error('noop')) }),
    })

    const { runStartupGuards } = await import('./startup-guards')
    await runStartupGuards()
  })

  it('throws when no providers are registered', async () => {
    // _plugins is empty after beforeEach reset
    const { runStartupGuards } = await import('./startup-guards')

    try {
      await runStartupGuards()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('No providers registered')
    }
  })
})
```

What was removed: the two cursor-specific tests (`checks cursor proxy reachability…`, `warns when cursor proxy is unreachable`), the global `fetch` mock, and the `mockFetch.mockReset()` call in `beforeEach`. The general "passes" and "no providers" guards stay.

- [ ] Verify:

```bash
grep -n -i cursor packages/translator/src/bootstrap/startup-guards.test.ts || echo "OK"
```

Expected: `OK`

### Step 2: Update providers.test.ts (bootstrap) — expect 2 providers, no cursor test

- [ ] Replace the full contents of `packages/translator/src/bootstrap/providers.test.ts` with:

```ts
import { beforeAll, describe, expect, it } from 'bun:test'
import { listProviderPlugins, resetProviderRegistryForTest } from '@chatwork-bot/core'

describe('registerAllProviders', () => {
  beforeAll(async () => {
    resetProviderRegistryForTest()
    const { registerAllProviders } = await import('./register-providers')
    registerAllProviders()
  })

  it('registers exactly 2 providers', () => {
    expect(listProviderPlugins()).toHaveLength(2)
  })

  it('registers gemini provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('gemini')
  })

  it('registers openai provider', () => {
    const ids = listProviderPlugins().map((p) => p.manifest.id)
    expect(ids).toContain('openai')
  })
})
```

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/bootstrap/providers.test.ts || echo "OK"
```

Expected: `OK`

### Step 3: Update providers.test.ts (routes) — drop "excludes cursor" assertion

- [ ] Replace the full contents of `packages/translator/src/routes/providers.test.ts` with:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { resetProviderRegistryForTest } from '@chatwork-bot/core'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { providersRoute } from './providers'

describe('GET /api/providers', () => {
  beforeAll(() => {
    resetProviderRegistryForTest()
    registerAllProviders()
  })

  afterAll(() => {
    resetProviderRegistryForTest()
  })

  it('returns gemini and openai with models', async () => {
    const app = new Elysia().use(providersRoute)
    const response = await app.handle(new Request('http://localhost/api/providers'))

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      success?: boolean
      data?: {
        id: string
        name: string
        models: string[]
        defaultModel: string
      }[]
    }

    const providers = body.data
    if (providers === undefined) {
      throw new Error('Expected providers envelope')
    }

    expect(body.success).toBe(true)
    expect(providers).toHaveLength(2)
    expect(providers.map((provider) => provider.id)).toContain('openai')
    expect(providers.map((provider) => provider.id)).toContain('gemini')
  })
})
```

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/routes/providers.test.ts || echo "OK"
```

Expected: `OK`

### Step 4: Swap cursor fixture → openai in translator-status-store.test.ts

- [ ] Open `packages/translator/src/services/translator-status-store.test.ts`. Find both occurrences of:

```ts
      provider: 'cursor',
      model: 'gemini-3.1-pro',
```

and replace each with:

```ts
      provider: 'openai',
      model: 'gpt-5.4',
```

There are two occurrences (currently around lines 17 and 64). Use sed-safe replacement or edit each manually. Don't touch the third block (`provider: 'openai'`, `model: 'gpt-5.4'`) — it's already correct.

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/services/translator-status-store.test.ts || echo "OK"
```

Expected: `OK`

### Step 5: Swap cursor fixture → openai in phase-observer.test.ts

- [ ] Open `packages/translator/src/services/phase-observer.test.ts`. Find both occurrences of:

```ts
        provider: 'cursor',
        model: 'gemini-3.1-pro',
```

and replace each with:

```ts
        provider: 'openai',
        model: 'gpt-5.4',
```

There are two occurrences (currently around lines 29 and 87). The third block (`provider: 'openai'`, `model: 'gpt-5.4'`) is already correct and should stay.

- [ ] Verify:

```bash
grep -n cursor packages/translator/src/services/phase-observer.test.ts || echo "OK"
```

Expected: `OK`

### Step 6: Replace cursor with a neutral unknown id in provider-registry.test.ts

- [ ] Open `packages/core/src/services/provider-registry.test.ts`. Find the block (currently lines 54–58):

```ts
it('throws ProviderRegistryBootError when provider not found', () => {
  registerProviderPlugin(makePlugin('gemini'))
  expect(() => getProviderPlugin('cursor')).toThrow(ProviderRegistryBootError)
  expect(() => getProviderPlugin('cursor')).toThrow(/cursor/)
})
```

Replace with:

```ts
it('throws ProviderRegistryBootError when provider not found', () => {
  registerProviderPlugin(makePlugin('gemini'))
  expect(() => getProviderPlugin('unknown')).toThrow(ProviderRegistryBootError)
  expect(() => getProviderPlugin('unknown')).toThrow(/unknown/)
})
```

- [ ] Verify:

```bash
grep -n cursor packages/core/src/services/provider-registry.test.ts || echo "OK"
```

Expected: `OK`

### Step 7: Drop cursor from ai.test.ts

- [ ] Open `packages/core/src/types/ai.test.ts`. Find line 12:

```ts
expect(toAIProvider('cursor') as string).toBe('cursor')
```

Delete that entire line. The `groq` and `openai` assertions above/below stay — they cover the "accepts any string" contract without naming cursor.

- [ ] Verify:

```bash
grep -n cursor packages/core/src/types/ai.test.ts || echo "OK"
```

Expected: `OK`

### Step 8: Generalize queue-runner.test.ts error fixture

- [ ] Open `packages/dataset-runner/src/services/queue-runner.test.ts`. Find the line (currently line 74):

```ts
        errorMessage: 'Cursor API call failed: The operation was aborted.',
```

Replace with:

```ts
        errorMessage: 'Translation API call failed: The operation was aborted.',
```

Rationale: the test asserts the dataset runner's behavior when a translation fails — the provider name in the message is irrelevant.

- [ ] Verify:

```bash
grep -n -i cursor packages/dataset-runner/src/services/queue-runner.test.ts || echo "OK"
```

Expected: `OK`

### Step 9: Run full test suite

- [ ] From repo root:

```bash
bun run typecheck && bun test
```

Expected: both pass. No test should reference `cursor` anywhere.

### Step 10: Run lint

- [ ] From repo root:

```bash
bun run lint
```

Expected: no new errors. Warnings about "Unused eslint-disable directive" may appear for `startup-guards.test.ts` (line 110) because the `@typescript-eslint/no-empty-function` eslint-disable comment was removed with the `warnSpy` block. If the lint step already flagged that pre-existing warning, it should disappear now. If a new warning appears, fix it by removing the now-orphan directive.

### Step 11: Commit

- [ ] Stage and commit only the test file changes:

```bash
git add packages/translator/src/bootstrap/startup-guards.test.ts \
        packages/translator/src/bootstrap/providers.test.ts \
        packages/translator/src/routes/providers.test.ts \
        packages/translator/src/services/translator-status-store.test.ts \
        packages/translator/src/services/phase-observer.test.ts \
        packages/core/src/services/provider-registry.test.ts \
        packages/core/src/types/ai.test.ts \
        packages/dataset-runner/src/services/queue-runner.test.ts
git commit -m "test: drop cursor fixtures and assertions from shared tests"
```

Confirm:

```bash
git log --oneline -2
```

Expected: last two commits are `test: drop cursor fixtures…` then `refactor(translator): remove cursor provider…`.

---

## Task 3: Remove cursor-proxy from Docker, scripts, and root deps

**Files:**

- Modify: `docker-compose.dev.yml`
- Modify: `Dockerfile`
- Modify: `scripts/dev.sh`
- Modify: `package.json` (root)
- Modify: `bun.lock` (regenerated via `bun install`)

### Step 1: Remove CURSOR_API_URL from docker-compose.dev.yml

- [ ] Open `docker-compose.dev.yml`. Delete the two lines currently at ~25–26:

```yaml
# host.docker.internal resolves to macOS host on Docker Desktop
- CURSOR_API_URL=http://host.docker.internal:8765/v1
```

The next line (`- KAGI_TRANSLATOR_URL=…`) stays — keep the `environment:` list well-formed.

- [ ] Verify:

```bash
grep -n -i cursor docker-compose.dev.yml || echo "OK"
```

Expected: `OK`

### Step 2: Remove cursor COPY lines from Dockerfile

- [ ] Open `Dockerfile`. Delete these two lines:

Line 30:

```dockerfile
COPY packages/provider-cursor/package.json packages/provider-cursor/
```

Line 52:

```dockerfile
COPY packages/provider-cursor/src packages/provider-cursor/src
```

- [ ] Verify:

```bash
grep -n cursor Dockerfile || echo "OK"
```

Expected: `OK`

### Step 3: Strip cursor-proxy logic from scripts/dev.sh

- [ ] Replace the full contents of `scripts/dev.sh` with:

```sh
#!/bin/sh
# Runs the local dev Docker stack.
# Usage: sh scripts/dev.sh [up|down|logs -f|...]

check_duplicate_env_keys() {
  if [ ! -f .env ]; then
    return 0
  fi

  duplicates="$(
    awk '
      /^[[:space:]]*#/ { next }
      /^[[:space:]]*$/ { next }
      {
        line=$0
        sub(/^[[:space:]]+/, "", line)
        if (line !~ /^[A-Za-z_][A-Za-z0-9_]*=/) next
        key=line
        sub(/=.*/, "", key)

        if (key ~ /^(AI_|CHATWORK_|DATASET_)/) {
          count[key]++
          if (lines[key] == "") {
            lines[key] = NR
          } else {
            lines[key] = lines[key] "," NR
          }
        }
      }
      END {
        for (k in count) {
          if (count[k] > 1) print k ":" lines[k]
        }
      }
    ' .env | sort
  )"

  if [ -n "$duplicates" ]; then
    echo "[dev] ERROR: duplicate keys detected in .env for AI_/CHATWORK_/DATASET_:" >&2
    echo "$duplicates" | while IFS=: read -r key line_numbers; do
      echo "[dev] - ${key} (lines: ${line_numbers})" >&2
    done
    echo "[dev] Please keep only one definition per key before running dev." >&2
    return 1
  fi

  return 0
}

ACTION="${1:-up}"
COMPOSE_FILE="docker-compose.dev.yml"

DEV_FAIL_SERVICE=""
DEV_FAIL_REASON=""
_CLEANUP_DONE=0

trap_cleanup() {
  [ "$_CLEANUP_DONE" -eq 1 ] && return
  _CLEANUP_DONE=1
  echo "[dev] shutting down stack..." >&2
  docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
  if [ -n "$DEV_FAIL_SERVICE" ]; then
    echo "" >&2
    echo "=============================================" >&2
    echo " FAIL-FAST TRIGGERED" >&2
    echo " Service : $DEV_FAIL_SERVICE" >&2
    echo " Reason  : $DEV_FAIL_REASON" >&2
    echo " Time    : $(date '+%Y-%m-%d %H:%M:%S')" >&2
    echo " Next steps:" >&2
    echo "   docker compose -f $COMPOSE_FILE logs $DEV_FAIL_SERVICE" >&2
    echo "   bun run dev" >&2
    echo "=============================================" >&2
  fi
}
trap trap_cleanup EXIT INT TERM
# Ctrl-Z (SIGTSTP) suspends the shell but leaves Docker containers running via the daemon.
# Intercept it: run cleanup first, then exit so the EXIT trap does not double-fire.
trap 'trap_cleanup; exit 130' TSTP

if [ "$ACTION" = "up" ]; then
  check_duplicate_env_keys || exit 1
  exec docker compose -f "$COMPOSE_FILE" up --remove-orphans --abort-on-container-exit
elif [ "$ACTION" = "down" ]; then
  exec docker compose -f "$COMPOSE_FILE" down --remove-orphans
else
  # Pass-through: logs, ps, pull, config, etc.
  exec docker compose -f "$COMPOSE_FILE" "$@"
fi
```

What was removed: every cursor-proxy helper (`extract_authority`, `extract_host`, `extract_port`, `is_local_host`, `get_listener_pid`, `is_pid_alive`, `wait_for_pid_exit`, `terminate_pid`, `probe_proxy_health`, `cleanup_local_proxy`, `start_proxy_and_docker`, `start_docker_only`), the `AI_PROVIDER` / `CURSOR_API_URL` detection, and the `build_dashboard` comment-only helper (dead code). Kept: env duplicate-key guard, cleanup trap, docker compose lifecycle commands.

- [ ] Verify:

```bash
grep -n -i "cursor\|CURSOR_API" scripts/dev.sh || echo "OK"
```

Expected: `OK`

- [ ] Smoke test (if Docker is available in the dev environment):

```bash
sh scripts/dev.sh config >/dev/null && echo "OK: compose config parses"
```

Expected: `OK: compose config parses`. Skip if Docker is not reachable.

### Step 4: Remove cursor-proxy script + devDep from root package.json

- [ ] Open `package.json`. In the `scripts` block, delete the line:

```json
    "cursor-proxy": "node \"$(realpath node_modules/cursor-api-proxy/dist/cli.js)\"",
```

In the `devDependencies` block, delete the line:

```json
    "cursor-api-proxy": "github:anyrobert/cursor-api-proxy",
```

Preserve trailing commas: if the deleted line was the last entry of its block, adjust the comma on the preceding line.

- [ ] Verify:

```bash
grep -n -i "cursor" package.json || echo "OK"
```

Expected: `OK`

### Step 5: Regenerate bun.lock

- [ ] From repo root:

```bash
bun install
```

Expected: completes without error and updates `bun.lock`.

- [ ] Verify all cursor entries are gone:

```bash
grep -n "cursor-api-proxy\|provider-cursor" bun.lock || echo "OK"
```

Expected: `OK`. (The unrelated `cli-cursor`, `restore-cursor`, `restore-cursor/onetime` entries come from `log-update` and must stay — they have nothing to do with the cursor provider.)

### Step 6: Full gate

- [ ] From repo root:

```bash
bun run typecheck && bun test && bun run lint
```

Expected: all pass.

### Step 7: Commit

- [ ] Stage and commit only the infra/config changes:

```bash
git add docker-compose.dev.yml Dockerfile scripts/dev.sh package.json bun.lock
git commit -m "chore(repo): remove cursor-proxy from docker, scripts and root deps"
```

Confirm:

```bash
git log --oneline -3
```

Expected: shows three cleanup commits ending with `chore(repo): remove cursor-proxy…`.

---

## Task 4: Remove cursor-specific documentation

**Files:**

- Delete: `docs/operations/cursor-api-proxy-risk.md`
- Delete: `docs/2026-03-06-cursor-cli-provider-performance-analysis.md`
- Delete: `docs/archive/2026-03-11-cursor-retry.md`
- Delete: `docs/superpowers/specs/2026-03-11-cursor-retry-design.md`
- Modify: `ai_rules/security.md`
- Modify: `ai_rules/architecture-patterns.md`
- Modify: `ai_rules/project-structure.md`
- Modify: `ai_rules/commands.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

### Step 1: Delete cursor-specific docs

- [ ] From repo root:

```bash
rm -f docs/operations/cursor-api-proxy-risk.md \
      docs/2026-03-06-cursor-cli-provider-performance-analysis.md \
      docs/archive/2026-03-11-cursor-retry.md \
      docs/superpowers/specs/2026-03-11-cursor-retry-design.md
```

Verify:

```bash
ls docs/operations/cursor-api-proxy-risk.md \
   docs/2026-03-06-cursor-cli-provider-performance-analysis.md \
   docs/archive/2026-03-11-cursor-retry.md \
   docs/superpowers/specs/2026-03-11-cursor-retry-design.md 2>&1 \
  | grep -c "No such file"
```

Expected: `4`

### Step 2: Clean `ai_rules/security.md`

- [ ] Open `ai_rules/security.md`. Do two edits:

1. Delete the entire bullet on line 19:

```md
- `CURSOR_API_URL` remains a local-only integration setting for the `cursor` provider.
```

2. Delete the entire section `## Cursor Provider — LOCAL DEV ONLY` (starts at line 62). Read the file and remove the heading plus all lines belonging to that section up to (but not including) the next `##` heading or EOF.

- [ ] Verify:

```bash
grep -n -i cursor ai_rules/security.md || echo "OK"
```

Expected: `OK`

### Step 3: Clean `ai_rules/architecture-patterns.md`

- [ ] Open `ai_rules/architecture-patterns.md`. Three edits:

1. Line 59 — replace:

```md
- `aiProvider`: gemini | openai | cursor (local dev)
```

with:

```md
- `aiProvider`: gemini | openai
```

2. Line 143 — delete the table row:

```md
| translator | cursor-proxy | `http://host.docker.internal:8765/v1` |
```

3. Line 148 — delete the paragraph beginning `For `cursor` provider:` and any surrounding explanatory lines that refer only to cursor. Read the surrounding context (±10 lines) and remove cursor-only content cleanly, preserving table formatting.

- [ ] Verify:

```bash
grep -n -i cursor ai_rules/architecture-patterns.md || echo "OK"
```

Expected: `OK`

### Step 4: Clean `ai_rules/project-structure.md`

- [ ] Open `ai_rules/project-structure.md`. Three edits:

1. Line 20 — delete the diagram line:

```md
@chatwork-bot/provider-cursor ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
```

2. Lines 77–79 — delete the entire `### `packages/provider-cursor` (`@chatwork-bot/provider-cursor`)` section, including its description paragraph. Stop before the next `###` heading.

3. Line 172 — delete the tree line:

```md
├── packages/provider-cursor/tsconfig.json
```

- [ ] Verify:

```bash
grep -n -i cursor ai_rules/project-structure.md || echo "OK"
```

Expected: `OK`

### Step 5: Clean `ai_rules/commands.md`

- [ ] Open `ai_rules/commands.md`. Two edits:

1. Delete the entire `### Cursor Provider (local dev)` section (currently starting at line 36). Read the surrounding context (±10 lines) and remove from the heading through the closing line of that section (next `###`/`##` heading or EOF).

2. Line 89 — replace:

```md
bun run dev # Start: translator + webhook-logger + zrok (+ cursor-proxy if AI_PROVIDER=cursor)
```

with:

```md
bun run dev # Start: translator + webhook-logger + zrok
```

- [ ] Verify:

```bash
grep -n -i cursor ai_rules/commands.md || echo "OK"
```

Expected: `OK`

### Step 6: Clean `CLAUDE.md`

- [ ] Open `CLAUDE.md`. One edit:

Line 25 — delete the diagram line:

```md
@chatwork-bot/provider-cursor ←── registered in ── @chatwork-bot/translator (LOCAL DEV ONLY)
```

Keep line 3 (`This file provides guidance to Claude Code (claude.ai/code) and Cursor.`) — that "Cursor" refers to the Cursor IDE, not our provider, and is still accurate.

- [ ] Verify:

```bash
grep -n "@chatwork-bot/provider-cursor" CLAUDE.md || echo "OK"
```

Expected: `OK`

### Step 7: Clean `README.md`

- [ ] Open `README.md`. Line 97 — delete the tree line:

```md
├── provider-cursor/ # @chatwork-bot/provider-cursor — Cursor provider (LOCAL DEV ONLY)
```

Preserve the surrounding tree characters on neighboring lines.

- [ ] Verify:

```bash
grep -n "provider-cursor" README.md || echo "OK"
```

Expected: `OK`

### Step 8: Final repo-wide grep

- [ ] From repo root:

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cursor \
  --exclude="*.css" \
  "cursor-api-proxy\|provider-cursor\|CURSOR_API_URL" . || echo "OK: no cursor-provider references remain"
```

Expected: `OK: no cursor-provider references remain`.

The `--exclude-dir=.cursor` drops Cursor IDE folders (unrelated). The `--exclude="*.css"` drops Tailwind `cursor: pointer` / `cursor-not-allowed` classes (also unrelated).

### Step 9: Final gate

- [ ] From repo root:

```bash
bun run typecheck && bun test && bun run lint
```

Expected: all pass.

### Step 10: Commit

- [ ] Stage and commit only the docs changes:

```bash
git add docs/ ai_rules/ CLAUDE.md README.md
git commit -m "docs(repo): remove cursor-specific documentation and references"
```

Confirm:

```bash
git log --oneline -4
```

Expected: four commits in order (oldest → newest):

```
refactor(translator): remove cursor provider package and registration
test: drop cursor fixtures and assertions from shared tests
chore(repo): remove cursor-proxy from docker, scripts and root deps
docs(repo): remove cursor-specific documentation and references
```

---

## Final PR Gate

After all four commits:

- [ ] Run the Definition of Done:

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass.

- [ ] Optional smoke test with Docker (if available):

```bash
sh scripts/dev.sh config >/dev/null && echo "OK: compose config parses"
```

- [ ] Create a PR with title:

```
chore: remove cursor provider
```

PR body should summarize the four commits and link to the spec doc.
