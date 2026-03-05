# tsconfig Path Alias Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up inconsistent tsconfig path aliases across all packages, add explicit `@chatwork-bot/*` paths in base config, and update docs to match reality.

**Architecture:** Single source of truth in `tsconfig.base.json` with `baseUrl: "."` and workspace package paths. Each package overrides `baseUrl` to `"../.."` so paths resolve correctly from monorepo root. Source files are untouched — Bun workspace resolution handles runtime.

**Tech Stack:** Bun workspaces · TypeScript `paths` + `baseUrl` · tsconfig inheritance

---

## Context for the implementer

This is a **config-only refactor** — zero source file changes.

Current problems:

- `tsconfig.base.json` has `@core/*` and `@translator/*` paths that **nobody imports**
- No `baseUrl` in base config → paths resolve relative to base file, breaks when packages extend it
- Each package overrides `paths` differently (inconsistent)
- `@chatwork-bot/webhook-logger` missing from base paths
- Docs mention `@chatwork-bot/bot` (old name) instead of `@chatwork-bot/translator` and `@chatwork-bot/webhook-logger`

What Bun workspace resolution does automatically (no tsconfig needed for this):

- `import ... from '@chatwork-bot/core'` → resolves via `node_modules/@chatwork-bot/core` symlink → `packages/core/src/index.ts`

What tsconfig `paths` adds on top:

- Makes TypeScript and IDEs aware of where packages live _in the source tree_, not just `node_modules`
- Helps `tsc --noEmit` (typecheck) resolve modules correctly when `node_modules` symlinks might not exist (CI)

### Quick sanity check before starting

```bash
cd /path/to/chatwork-translation-bot
bun test        # should pass — record baseline
bun run typecheck  # note any existing errors
bun run lint       # note any existing errors
```

---

## Task 1: Update tsconfig.base.json

**Files:**

- Modify: `tsconfig.base.json`

### Step 1: Read the current file

Open `tsconfig.base.json`. Current content:

```json
{
  "compilerOptions": {
    ...
    "paths": {
      "@core/*": ["./packages/core/src/*"],
      "@translator/*": ["./packages/translator/src/*"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Step 2: Replace the paths section

Replace **only** `compilerOptions.paths` and add `baseUrl`. Do not touch any other compilerOptions.

New content for `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@chatwork-bot/core": ["./packages/core/src/index.ts"],
      "@chatwork-bot/translator": ["./packages/translator/src/index.ts"],
      "@chatwork-bot/webhook-logger": ["./packages/webhook-logger/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Step 3: Verify typecheck still works

```bash
bun run typecheck
```

Expected: same result as baseline (no new errors introduced).

### Step 4: Commit

```bash
git add tsconfig.base.json
git commit -m "chore(tsconfig): add baseUrl and replace dead aliases with workspace package paths"
```

---

## Task 2: Standardize packages/core/tsconfig.json

**Files:**

- Modify: `packages/core/tsconfig.json`

### Step 1: Read the current file

Current content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@core/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2: Rewrite — add baseUrl, remove local paths override

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Why `baseUrl: "../.."`?** When a package extends base and the base has `"baseUrl": "."`, TypeScript resolves paths relative to the _extending_ file's directory unless overridden. Setting `"../..` points back to the monorepo root, so `"./packages/core/src/index.ts"` in the base paths resolves correctly.

### Step 3: Typecheck core package

```bash
cd packages/core && bun run typecheck
```

Expected: passes (or same errors as before — no new ones).

### Step 4: Commit

```bash
git add packages/core/tsconfig.json
git commit -m "chore(tsconfig): standardize core package tsconfig with baseUrl"
```

---

## Task 3: Standardize packages/translator/tsconfig.json

**Files:**

- Modify: `packages/translator/tsconfig.json`

### Step 1: Read the current file

Current content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@core/*": ["../core/src/*"],
      "@translator/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2: Rewrite — add baseUrl, remove local paths override

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3: Typecheck translator package

```bash
cd packages/translator && bun run typecheck
```

Expected: passes.

### Step 4: Commit

```bash
git add packages/translator/tsconfig.json
git commit -m "chore(tsconfig): standardize translator package tsconfig with baseUrl"
```

---

## Task 4: Standardize packages/webhook-logger/tsconfig.json

**Files:**

- Modify: `packages/webhook-logger/tsconfig.json`

### Step 1: Read the current file

Current content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "@core/*": ["../core/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2: Rewrite — add baseUrl, remove local paths override

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3: Typecheck webhook-logger package

```bash
cd packages/webhook-logger && bun run typecheck
```

Expected: passes.

### Step 4: Run full typecheck from root

```bash
bun run typecheck
```

Expected: passes. This runs `tsc -p tsconfig.root.json` AND `bun run --workspaces typecheck`.

### Step 5: Commit

```bash
git add packages/webhook-logger/tsconfig.json
git commit -m "chore(tsconfig): standardize webhook-logger package tsconfig with baseUrl"
```

---

## Task 5: Update ai_rules/export-patterns.md

**Files:**

- Modify: `ai_rules/export-patterns.md`

### Step 1: Read the current file

Note what's already there (4 rules about barrel exports, import type, export type, grouping).

### Step 2: Append new section at end of file

Add this section after the last rule:

````markdown
## Rule: tsconfig paths mirror workspace packages — no deep aliases

`tsconfig.base.json` declares workspace packages in `paths` for IDE and `tsc` resolution:

```json
"paths": {
  "@chatwork-bot/core": ["./packages/core/src/index.ts"],
  "@chatwork-bot/translator": ["./packages/translator/src/index.ts"],
  "@chatwork-bot/webhook-logger": ["./packages/webhook-logger/src/index.ts"]
}
```
````

Do not add `@core/*`, `translator/*`, or any other alias pattern. The barrel (`index.ts`) is the
only public interface. If you need to export something new, add it to the barrel.

```typescript
// ✓ Correct — always use workspace package name
import { parseCommand } from '@chatwork-bot/core'
import type { ITranslationService } from '@chatwork-bot/core'

// ✗ Wrong — deep path aliases (not configured and not needed)
import { parseCommand } from '@core/utils/parse-command'
import { parseCommand } from 'core/utils/parse-command'
```

````

### Step 3: Lint the file

```bash
bun run lint
````

Expected: passes (markdown files not linted by ESLint, just verify no JS errors).

### Step 4: Commit

```bash
git add ai_rules/export-patterns.md
git commit -m "docs(ai_rules): add tsconfig path alias rule to export-patterns"
```

---

## Task 6: Update ai_rules/project-structure.md

**Files:**

- Modify: `ai_rules/project-structure.md`

### Step 1: Read the current file

Note the file mentions `@chatwork-bot/bot` (old name) in the monorepo diagram — this is outdated. The actual packages are `@chatwork-bot/core`, `@chatwork-bot/translator`, and `@chatwork-bot/webhook-logger`.

### Step 2: Update the monorepo diagram and add tsconfig section

**Change 1** — Fix the monorepo layout diagram. Find:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/bot
(types, interfaces,                     (HTTP server, env,
 utils, services)                        Chatwork client, webhook handling)
```

Replace with:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/translator
(types, interfaces,                     (HTTP server, Chatwork client,
 utils, services)                        webhook handling, translation)

@chatwork-bot/core  ←── imported by ──  @chatwork-bot/webhook-logger
                                        (webhook receiver, forwards to translator)
```

**Change 2** — Update `### packages/bot` section header and content:

- Change `### \`packages/bot\` (\`@chatwork-bot/bot\`)`→ two sections for`translator`and`webhook-logger`
- Or simplify to just rename and describe both packages

**Change 3** — Append tsconfig hierarchy section at end:

```markdown
## tsconfig Hierarchy

Single source of truth in `tsconfig.base.json`. Each package extends it.
```

tsconfig.base.json (baseUrl: ".", paths: all @chatwork-bot/\* packages)
├── tsconfig.root.json (for root scripts only, excludes packages/)
├── packages/core/tsconfig.json (baseUrl: "../..")
├── packages/translator/tsconfig.json (baseUrl: "../..")
└── packages/webhook-logger/tsconfig.json (baseUrl: "../..")

```

**Why `baseUrl: "../.."` in packages?** The base config has `"baseUrl": "."` (monorepo root). When a package extends it, TypeScript would resolve paths relative to the package directory. Setting `"baseUrl": "../.."` in each package overrides this back to the monorepo root, so paths like `"./packages/core/src/index.ts"` resolve correctly.

**Rule:** Never add local `paths` overrides in package tsconfigs. All path declarations live in `tsconfig.base.json`.
```

### Step 3: Commit

```bash
git add ai_rules/project-structure.md
git commit -m "docs(ai_rules): fix outdated package names and add tsconfig hierarchy section"
```

---

## Task 7: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

### Step 1: Read the current file

Note the monorepo diagram shows `@chatwork-bot/bot` — outdated.

### Step 2: Fix outdated monorepo diagram

Find:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/bot
(types, interfaces, utils, services)    (HTTP server, webhook handling)
```

Replace with:

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/translator  (HTTP server, webhook handling)
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/webhook-logger  (webhook receiver)
```

### Step 3: Add tsconfig note to Architecture section

In the `### Architecture` section (or nearest relevant section), add:

```markdown
- tsconfig, path aliases, or baseUrl → read `ai_rules/project-structure.md` (tsconfig hierarchy section)
```

### Step 4: Commit

```bash
git add CLAUDE.md
git commit -m "docs(claude): fix outdated package names and add tsconfig pointer"
```

---

## Task 8: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

### Step 1: Read the current file

Note: `AGENTS.md` already has the correct critical rule: "Import from package name only: `@chatwork-bot/core` not `../../core/src/`". But the description says "Two packages: `@chatwork-bot/core` and `@chatwork-bot/bot`" — outdated.

### Step 2: Fix project description

Find:

```
Two packages: `@chatwork-bot/core` (shared logic) and `@chatwork-bot/bot` (HTTP server).
```

Replace with:

```
Three packages: `@chatwork-bot/core` (shared logic), `@chatwork-bot/translator` (HTTP server + translation), `@chatwork-bot/webhook-logger` (webhook receiver).
```

### Step 3: Expand the critical import rule

Find:

```
- Import from package name only: `@chatwork-bot/core` not `../../core/src/`
```

Replace with:

```
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
```

### Step 4: Commit

```bash
git add AGENTS.md
git commit -m "docs(agents): fix outdated package count and expand import rule"
```

---

## Task 9: Full verification

### Step 1: Run all quality checks

```bash
bun test && bun run typecheck && bun run lint
```

Expected output:

- `bun test`: all tests pass (same as baseline — no source changes)
- `bun run typecheck`: 0 errors across root + all packages
- `bun run lint`: 0 errors

### Step 2: Verify per-package typecheck individually

```bash
cd packages/core && bun run typecheck
cd packages/translator && bun run typecheck
cd packages/webhook-logger && bun run typecheck
```

All should pass.

### Step 3: If typecheck fails — debugging guide

Common failure after this change:

**Error: "Cannot find module '@chatwork-bot/core'"**

- Cause: `baseUrl` not set correctly in a package tsconfig
- Fix: ensure `"baseUrl": "../.."` is in that package's `compilerOptions`

**Error: "paths must be relative to baseUrl"**

- Cause: `tsconfig.base.json` paths start with `./` but `baseUrl` is not set
- Fix: ensure `"baseUrl": "."` is in `tsconfig.base.json`

**Error: module resolves to wrong path**

- Cause: package tsconfig has local `paths` override that takes precedence
- Fix: remove all `paths` from package tsconfigs (only base should have them)

### Step 4: Final commit if any fixup needed

```bash
git add -p   # stage only changed config files, NOT source files
git commit -m "chore(tsconfig): fixup path resolution after verification"
```

---

## Acceptance Criteria

- [ ] `bun test` passes (all existing tests green)
- [ ] `bun run typecheck` passes with 0 errors
- [ ] `bun run lint` passes with 0 errors
- [ ] `tsconfig.base.json` has `baseUrl: "."` and only `@chatwork-bot/*` paths
- [ ] All 3 package tsconfigs have `baseUrl: "../.."` and no local `paths`
- [ ] `ai_rules/export-patterns.md` documents the tsconfig path strategy
- [ ] `ai_rules/project-structure.md` has correct package names and tsconfig hierarchy
- [ ] `CLAUDE.md` and `AGENTS.md` show correct 3-package monorepo
- [ ] Zero source `.ts` files changed
