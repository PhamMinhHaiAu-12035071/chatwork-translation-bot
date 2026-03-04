# Monorepo Quality Standardization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize lint/format/typecheck/test/hooks across all packages using workspace-native Bun scripts, a guard script, compact pre-commit logs, enforced commit scopes, and unified zod v4.

**Architecture:** Root scripts delegate to packages via `bun run --workspaces --if-present --sequential`. Each package is self-contained with 5 standard scripts (`lint`, `lint:fix`, `format`, `typecheck`, `test`). A TypeScript guard (`scripts/verify-standards.ts`) enforces this contract at commit time. Commitlint enforces scope enum from the first commit.

**Tech Stack:** Bun workspaces, TypeScript-ESLint strictTypeChecked, Prettier, Husky v9, lint-staged, commitlint, Zod v4

---

### Task 1: Create `tsconfig.root.json`

**Why first:** The updated `typecheck` root script uses `tsc -p tsconfig.root.json`. This file must exist before we update the root scripts.

**Files:**

- Create: `tsconfig.root.json`

**Step 1: Create `tsconfig.root.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "include": ["*.ts", "scripts/**/*.ts"],
  "exclude": ["packages/**", "node_modules", "dist", "output"]
}
```

**Step 2: Verify it typechecks without errors**

Run: `tsc --noEmit -p tsconfig.root.json`
Expected: No output (clean pass). This checks `eslint.config.ts` and `commitlint.config.ts`.

**Step 3: Commit**

```bash
git add tsconfig.root.json
git commit -m "chore(repo): add tsconfig.root.json for root-level typecheck"
```

---

### Task 2: Add standard scripts to each package + unify zod

**Why:** Workspace-native root scripts (`bun run --workspaces --if-present --sequential lint`) only work if packages have those scripts. The `--if-present` flag skips packages that lack the script, but we want all packages covered.

**Files:**

- Modify: `packages/core/package.json`
- Modify: `packages/translator/package.json`
- Modify: `packages/webhook-logger/package.json`

**Step 1: Update `packages/core/package.json`**

Add `lint`, `lint:fix`, `format`, `test` to the existing `typecheck`. Full scripts section:

```json
"scripts": {
  "lint": "eslint \"**/*.ts\"",
  "lint:fix": "eslint \"**/*.ts\" --fix",
  "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
}
```

Do NOT add `eslint.config.ts`, `.prettierrc`, or any config file to `packages/core/`.

**Step 2: Update `packages/translator/package.json`**

Add scripts and upgrade zod from `^3.23.0` to `^4.3.6`. Full `scripts` and `dependencies`:

```json
"scripts": {
  "dev": "bun --hot src/index.ts",
  "start": "bun src/index.ts",
  "lint": "eslint \"**/*.ts\"",
  "lint:fix": "eslint \"**/*.ts\" --fix",
  "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
},
"dependencies": {
  "@chatwork-bot/core": "workspace:*",
  "@elysiajs/swagger": "^1.3.1",
  "elysia": "^1.4.27",
  "zod": "^4.3.6"
}
```

**Step 3: Update `packages/webhook-logger/package.json`**

Same changes as translator:

```json
"scripts": {
  "dev": "bun --hot src/index.ts",
  "start": "bun src/index.ts",
  "lint": "eslint \"**/*.ts\"",
  "lint:fix": "eslint \"**/*.ts\" --fix",
  "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
},
"dependencies": {
  "@chatwork-bot/core": "workspace:*",
  "@elysiajs/swagger": "^1.3.1",
  "elysia": "^1.4.27",
  "zod": "^4.3.6"
}
```

**Step 4: Install updated dependencies**

Run: `bun install`
Expected: `bun.lock` updated, zod v4 installed in translator and webhook-logger.

**Step 5: Verify zod code is compatible with v4**

Run: `tsc --noEmit -p packages/translator/tsconfig.json && tsc --noEmit -p packages/webhook-logger/tsconfig.json`
Expected: No errors. Zod usage (`z.object`, `.safeParse`, `z.ZodIssueCode.custom`, `.error.issues`, `z.infer`) is v4-compatible.

**Step 6: Commit**

```bash
git add packages/core/package.json packages/translator/package.json packages/webhook-logger/package.json bun.lock
git commit -m "chore(repo): add standard scripts to all packages and unify zod to v4"
```

---

### Task 3: Create `scripts/verify-standards.ts`

**Why:** Guard script that enforces the 5-script contract and prevents config fragmentation. Must exist before it's added to the pre-commit hook.

**Files:**

- Create: `scripts/verify-standards.ts`

**Step 1: Create `scripts/` directory and write the guard**

```typescript
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const REQUIRED_SCRIPTS = ['lint', 'lint:fix', 'format', 'typecheck', 'test'] as const

const FRAGMENTED_CONFIG_FILES = [
  'eslint.config.js',
  'eslint.config.ts',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.ts',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.ts',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'prettier.config.js',
  'prettier.config.ts',
  'prettier.config.mjs',
  '.commitlintrc',
  '.commitlintrc.js',
  '.commitlintrc.json',
  '.commitlintrc.yml',
  'commitlint.config.js',
  'commitlint.config.ts',
  '.huskyrc',
  '.huskyrc.js',
  '.huskyrc.json',
  '.huskyrc.yaml',
  'lint-staged.config.js',
  'lint-staged.config.ts',
  'lint-staged.config.mjs',
  '.lintstagedrc',
  '.lintstagedrc.js',
  '.lintstagedrc.json',
  '.lintstagedrc.yml',
] as const

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
}

interface PackageError {
  package: string
  missingScripts: string[]
  fragmentedConfigs: string[]
}

function getPackageNames(packagesDir: string): string[] {
  if (!existsSync(packagesDir)) return []
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function checkPackage(packagesDir: string, pkgName: string): PackageError | null {
  const pkgPath = join(packagesDir, pkgName)
  const pkgJsonPath = join(pkgPath, 'package.json')
  if (!existsSync(pkgJsonPath)) return null

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as PackageJson
  const scripts = pkg.scripts ?? {}

  const missingScripts = REQUIRED_SCRIPTS.filter((s) => !(s in scripts))
  const fragmentedConfigs = FRAGMENTED_CONFIG_FILES.filter((f) => existsSync(join(pkgPath, f)))

  if (missingScripts.length === 0 && fragmentedConfigs.length === 0) return null

  return { package: pkgName, missingScripts, fragmentedConfigs }
}

function main(): void {
  const packagesDir = join(import.meta.dirname, '..', 'packages')
  const packageNames = getPackageNames(packagesDir)

  if (packageNames.length === 0) {
    console.log('[verify-standards] No packages found, skipping')
    process.exit(0)
  }

  const errors: PackageError[] = []
  for (const pkg of packageNames) {
    const error = checkPackage(packagesDir, pkg)
    if (error) errors.push(error)
  }

  if (errors.length === 0) {
    console.log('[verify-standards] ✓ All packages meet standards')
    process.exit(0)
  }

  console.error('[verify-standards] ✗ Standards violations found:\n')
  for (const err of errors) {
    console.error(`  packages/${err.package}:`)
    if (err.missingScripts.length > 0) {
      console.error(`    ✗ Missing scripts: ${err.missingScripts.join(', ')}`)
    }
    if (err.fragmentedConfigs.length > 0) {
      console.error(`    ✗ Fragmented config files: ${err.fragmentedConfigs.join(', ')}`)
    }
  }
  console.error(
    "\n  Fix: add missing scripts to each package's package.json and remove fragmented config files",
  )
  process.exit(1)
}

main()
```

**Step 2: Run the script directly**

Run: `bun run scripts/verify-standards.ts`
Expected: `[verify-standards] ✓ All packages meet standards`

**Step 3: Verify tsconfig.root.json can typecheck the new script**

Run: `tsc --noEmit -p tsconfig.root.json`
Expected: No errors.

**Step 4: Commit**

```bash
git add scripts/verify-standards.ts
git commit -m "feat(repo): add verify-standards guard script"
```

---

### Task 4: Update root `package.json` scripts and lint-staged

**Files:**

- Modify: `package.json`

**Step 1: Replace the `scripts` section in root `package.json`**

Keep `dev`, `build`, `logger`, `tunnel:logger`, `prepare`. Replace `lint`, `lint:fix`, `format`, `typecheck`, `test`. Add `quality`, `quality:ci`, `verify:standards`:

```json
"scripts": {
  "dev": "NODE_ENV=development bun run packages/translator/src/index.ts",
  "build": "bun build packages/translator/src/index.ts --outfile dist/server.js --target bun --minify",
  "logger": "bun run --hot packages/webhook-logger/src/index.ts",
  "tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger",
  "lint": "bun run --workspaces --if-present --sequential lint",
  "lint:fix": "bun run --workspaces --if-present --sequential lint:fix",
  "format": "bun run --workspaces --if-present --sequential format && prettier --write \"*.{json,md,yml,yaml}\" \"docs/**/*.md\"",
  "typecheck": "tsc --noEmit -p tsconfig.root.json && bun run --workspaces --if-present --sequential typecheck",
  "test": "bun test",
  "quality": "bun run lint && bun run typecheck && bun run test",
  "quality:ci": "bun run quality && bunx prettier --check \"*.{json,md,yml,yaml}\" \"docs/**/*.md\"",
  "verify:standards": "bun run scripts/verify-standards.ts",
  "prepare": "husky"
}
```

**Step 2: Replace `lint-staged` section**

```json
"lint-staged": {
  "packages/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{ts,tsx}": ["prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "docs/**/*.md": ["prettier --write"]
}
```

**Step 3: Smoke-test each new command**

```bash
bun run verify:standards
# Expected: [verify-standards] ✓ All packages meet standards

bun run lint
# Expected: no ESLint errors across core, translator, webhook-logger

bun run typecheck
# Expected: tsc clean for root + all packages

bun run test
# Expected: 64 pass, 0 fail
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore(repo): migrate to workspace-native scripts and update lint-staged"
```

---

### Task 5: Fix Husky deprecation warnings + update pre-commit hook

**Context:** Current `.husky/pre-commit` has two deprecated lines that will fail in Husky v10:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```

Husky v9 emits a warning about these. Remove them and rewrite the hook with the new format.

**Files:**

- Modify: `.husky/pre-commit`

**Step 1: Rewrite `.husky/pre-commit`**

Replace the entire file content:

```sh
export PATH="$HOME/.bun/bin:$PATH"

echo "[↻] lint-staged..."
bunx lint-staged || exit 1
echo "[✓] lint-staged"

echo "[↻] verify:standards..."
bun run verify:standards || exit 1
echo "[✓] verify:standards"

echo "[↻] typecheck..."
bun run typecheck || exit 1
echo "[✓] typecheck"

echo "[↻] tests..."
bun test || exit 1
echo "[✓] tests"
```

**Step 2: Ensure the file is executable**

Run: `chmod +x .husky/pre-commit`

**Step 3: Also fix `.husky/commit-msg` deprecation**

Current content has same deprecated lines. Replace with:

```sh
export PATH="$HOME/.bun/bin:$PATH"
bunx commitlint --edit $1
```

Run: `chmod +x .husky/commit-msg`

**Step 4: Commit (note: this commit triggers the new hook for the first time)**

```bash
git add .husky/pre-commit .husky/commit-msg
git commit -m "chore(repo): fix husky v9 deprecation and add verify-standards to pre-commit"
```

Expected: Pre-commit runs with compact `[↻]/[✓]` log, no deprecation warning.

---

### Task 6: Update `commitlint.config.ts` — enforce scope

**Files:**

- Modify: `commitlint.config.ts`

**Step 1: Add scope rules**

```typescript
import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', ['core', 'translator', 'webhook-logger', 'repo']],
  },
}

export default config
```

**Step 2: Commit (must use scope format)**

```bash
git add commitlint.config.ts
git commit -m "chore(repo): enforce commit scope via commitlint scope-enum"
```

Expected: commit-msg hook passes with `(repo)` scope.

---

### Task 7: Update README + create `docs/quality-workflow.md`

**Files:**

- Modify: `README.md`
- Create: `docs/quality-workflow.md`

**Step 1: Update README.md**

Replace the `## Project Structure` section (outdated — references `bot` package which no longer exists):

```markdown
## Project Structure

Bun workspaces monorepo with three packages:
```

packages/
├── core/ # @chatwork-bot/core — shared types, interfaces, utils, services
│ └── src/
│ ├── types/ # Chatwork webhook & command types
│ ├── interfaces/ # ITranslationService interface
│ ├── services/ # Translation prompt builder
│ └── utils/ # Command parser, output writer
├── translator/ # @chatwork-bot/translator — HTTP server (Elysia), webhook handler
│ └── src/
│ ├── webhook/ # Handler, routes
│ └── utils/ # Output writer
└── webhook-logger/ # @chatwork-bot/webhook-logger — debug logger server
└── src/

```

```

Replace the `## Scripts` section:

````markdown
## Scripts

```bash
# Development
bun run dev              # Run translator bot with hot-reload
bun run logger           # Run webhook-logger with hot-reload

# Build
bun run build            # Bundle to dist/server.js (minified, target bun)

# Type checking
bun run typecheck        # Typecheck root config files + all packages

# Linting & formatting
bun run lint             # ESLint across all packages (workspace-native)
bun run lint:fix         # ESLint with auto-fix
bun run format           # Prettier across all packages + root docs/configs

# Testing
bun test                 # Run all tests

# Quality (combined)
bun run quality          # lint + typecheck + test
bun run quality:ci       # quality + prettier --check on docs/configs
bun run verify:standards # Verify all packages meet script/config standards
```
````

````

**Step 2: Create `docs/quality-workflow.md`**

```markdown
# Quality Workflow

## Command Matrix

| Command | What it does | When to use |
|---------|-------------|-------------|
| `bun run lint` | ESLint across all packages | Before committing |
| `bun run lint:fix` | ESLint with auto-fix | When lint errors are auto-fixable |
| `bun run format` | Prettier across packages + root docs | Before committing |
| `bun run typecheck` | tsc clean for root + all packages | Before committing |
| `bun test` | All tests | Before committing |
| `bun run quality` | lint + typecheck + test in sequence | Full pre-push check |
| `bun run quality:ci` | quality + prettier --check | CI or final validation |
| `bun run verify:standards` | Check all packages have required scripts and no fragmented config | Automated via pre-commit |

## Pre-Commit Hook Flow

````

git commit
↓
[↻] lint-staged → ESLint --fix + Prettier on staged files
[✓] lint-staged
↓ (fail-fast: if lint-staged fails, stop here)
[↻] verify:standards → Check 5 required scripts + no fragmented config in packages/
[✓] verify:standards
↓
[↻] typecheck → tsc root + all packages
[✓] typecheck
↓
[↻] tests → bun test
[✓] tests
↓
commit-msg hook → commitlint enforces scope

```

## Commit Message Format

```

type(scope): description

```

**Valid types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

**Valid scopes:** `core`, `translator`, `webhook-logger`, `repo`

**Examples:**
```

feat(core): add translation caching layer
fix(translator): handle empty webhook body gracefully
docs(repo): update quality workflow docs
chore(repo): update husky hooks
test(core): add edge cases for parseCommand

````

## Package Standard Contract

Every package in `packages/*` MUST have these 5 scripts:

```json
"scripts": {
  "lint": "eslint \"**/*.ts\"",
  "lint:fix": "eslint \"**/*.ts\" --fix",
  "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
}
````

And MUST NOT have any of these config files (config lives at root only):

- `eslint.config.*`, `.eslintrc*`
- `.prettierrc*`, `prettier.config.*`
- `commitlint.config.*`, `.commitlintrc*`
- `.huskyrc*`, `lint-staged.config.*`, `.lintstagedrc*`

The `verify:standards` script enforces this automatically.

## Adding a New Package

1. Create `packages/new-package/package.json` with all 5 standard scripts
2. Do NOT add any lint/format/hook config files inside the package
3. Run `bun run verify:standards` to confirm it passes
4. Add your package name to `scope-enum` in `commitlint.config.ts` if commits will target it

````

**Step 3: Commit**

```bash
git add README.md docs/quality-workflow.md
git commit -m "docs(repo): update README and add quality-workflow documentation"
````

---

### Task 8: Final Verification

**Step 1: Run full quality check**

Run: `bun run quality`
Expected: lint passes, typecheck passes, 64 tests pass (0 fail)

**Step 2: Verify standards guard**

Run: `bun run verify:standards`
Expected: `[verify-standards] ✓ All packages meet standards`

**Step 3: Test individual package scripts work standalone**

```bash
cd packages/core && bun run lint && bun run typecheck && bun run test && cd ../..
cd packages/translator && bun run lint && bun run typecheck && cd ../..
cd packages/webhook-logger && bun run lint && bun run typecheck && cd ../..
```

Expected: all pass, no errors

**Step 4: Verify lint-staged patterns are correct**

Run: `bunx lint-staged --debug 2>&1 | head -30`
Expected: Shows `packages/**/*.{ts,tsx}`, `*.{ts,tsx}`, etc. as configured patterns

**Step 5: Run quality:ci as final gate**

Run: `bun run quality:ci`
Expected: All checks pass including prettier --check on docs/configs

---

## Acceptance Criteria Checklist

- [ ] No hardcoded package list in root scripts
- [ ] All 3 packages have the 5 standard scripts
- [ ] No fragmented lint/format config in any package
- [ ] `bun run verify:standards` passes
- [ ] `bun run quality` passes (lint + typecheck + test)
- [ ] Pre-commit hook uses compact log, no deprecation warning
- [ ] Commitlint enforces scope (test: `git commit -m "fix: no scope"` should fail)
- [ ] `zod` unified to `^4.3.6` in all packages
- [ ] README reflects current package structure
- [ ] `docs/quality-workflow.md` exists and is complete
