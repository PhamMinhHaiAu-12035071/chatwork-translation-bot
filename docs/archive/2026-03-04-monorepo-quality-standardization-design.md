# Design: Monorepo Quality Standardization

**Date**: 2026-03-04
**Status**: Approved
**Scope**: Standardize lint/format/typecheck/test/hooks across all packages

---

## Summary

Standardize the monorepo using a "one source of truth at root + minimal proxy scripts per package" model. Replace hardcoded package paths in root scripts with workspace-native `bun --workspaces` delegation. Add a guard script to enforce standards for future packages.

---

## Decisions Made

| #   | Decision                                                                     | Rationale                                                                     |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Workspace-native (`bun run --workspaces --if-present --sequential`)          | Extensible — adding a new package requires no root changes                    |
| 2   | Merge Phase 1 + Phase 2 into single implementation                           | Team accepts scope enforcement immediately                                    |
| 3   | Keep `ignores: ['*.config.ts']` in ESLint                                    | Config files have different patterns; Prettier still formats them             |
| 4   | `verify-standards.ts` checks scripts + fragmented config only                | Dep version checking handled via CLAUDE.md documentation                      |
| 5   | Pre-commit: fail-fast sequential                                             | `lint-staged → verify:standards → typecheck → tests`                          |
| 6   | `scripts/verify-standards.ts` runs via `bun run scripts/verify-standards.ts` | Bun executes TypeScript natively, no build step needed                        |
| 7   | No CI workflow for now                                                       | Deferred — not needed at current team size                                    |
| 8   | Compact hook log with stage icons                                            | `[✓] lint-staged`, `[↻] typecheck`, etc.                                      |
| 9   | Single root `eslint.config.ts`, no per-package config                        | One source of truth, no config fragmentation                                  |
| 10  | Create `tsconfig.root.json` for root-level typecheck                         | Separates base config from compilation target                                 |
| 11  | Include README update + `docs/quality-workflow.md`                           | Complete per acceptance criteria                                              |
| 12  | Unify `zod` to `^4.3.6` across all packages                                  | `translator` and `webhook-logger` were on v3.23.0; API usage is v4-compatible |

---

## Architecture

### Before

```
Root scripts (hardcoded):
  lint       → eslint packages/*/src/**/*.ts
  format     → prettier --write "packages/*/src/**/*.ts"
  typecheck  → tsc -p tsconfig.base.json && tsc -p packages/core/... && tsc -p packages/translator/... && ...

Package scripts (incomplete):
  core         → typecheck, test only
  translator   → dev, start, typecheck only
  webhook-logger → dev, start, typecheck only

lint-staged:
  *.{ts,tsx} → eslint + prettier (global glob, not package-scoped)

pre-commit:
  lint-staged → typecheck → tests (no verify-standards, verbose log)

commitlint: type-only, no scope enforcement
```

### After

```
Root scripts (workspace-native):
  lint           → bun run --workspaces --if-present --sequential lint
  lint:fix       → bun run --workspaces --if-present --sequential lint:fix
  format         → bun run --workspaces --if-present --sequential format
                   && prettier --write "*.{json,md,yml,yaml}" "docs/**/*.md"
  typecheck      → tsc --noEmit -p tsconfig.root.json
                   && bun run --workspaces --if-present --sequential typecheck
  test           → bun test
  quality        → bun run lint && bun run typecheck && bun run test
  quality:ci     → bun run quality && bunx prettier --check ...
  verify:standards → bun run scripts/verify-standards.ts

Per-package scripts (all 5 standard):
  lint       → eslint "**/*.ts"
  lint:fix   → eslint "**/*.ts" --fix
  format     → prettier --write "**/*.{ts,tsx,json,md,yml,yaml}"
  typecheck  → tsc --noEmit
  test       → bun test

lint-staged (updated):
  packages/**/*.{ts,tsx}  → eslint --fix, prettier --write
  *.{ts,tsx}              → prettier --write (root config files)
  *.{json,md,yml,yaml}    → prettier --write
  docs/**/*.md            → prettier --write

pre-commit (compact log):
  [↻] lint-staged...   → bunx lint-staged
  [✓] lint-staged
  [↻] verify:standards... → bun run verify:standards
  [✓] verify:standards
  [↻] typecheck...     → bun run typecheck
  [✓] typecheck
  [↻] tests...         → bun test
  [✓] tests

commitlint (scope enforced):
  scope-empty: [2, 'never']
  scope-enum:  [2, 'always', ['core', 'translator', 'webhook-logger', 'repo']]
```

---

## Files Changed

### New Files

- `tsconfig.root.json` — typecheck root `*.ts` + `scripts/**/*.ts`, excludes `packages/**`
- `scripts/verify-standards.ts` — guard: fail if package missing 5 standard scripts or has fragmented config

### Modified Files

- `package.json` — scripts, lint-staged
- `packages/core/package.json` — add lint, lint:fix, format, test scripts; zod stays at ^4.3.6
- `packages/translator/package.json` — add lint, lint:fix, format scripts; zod ^3.23.0 → ^4.3.6
- `packages/webhook-logger/package.json` — add lint, lint:fix, format scripts; zod ^3.23.0 → ^4.3.6
- `.husky/pre-commit` — add verify:standards step, compact log format
- `commitlint.config.ts` — add scope-empty + scope-enum rules
- `README.md` — update Commands section and package list
- `docs/quality-workflow.md` — new doc (command matrix, hook flow, commit convention)

---

## `scripts/verify-standards.ts` Logic

```
For each package in packages/*:
  1. Read package.json
  2. Check required scripts: lint, lint:fix, format, typecheck, test
     → FAIL if any missing
  3. Check for fragmented config files:
     eslint.config.*, .eslintrc.*, .prettierrc*, prettier.config.*,
     commitlint.config.*, .huskyrc*, lint-staged.config.*
     → FAIL if any found
  4. If all pass → exit 0
  5. If any fail → print actionable per-package error → exit 1
```

---

## Commit Message Convention (from Phase 2)

Format: `type(scope): description`

Valid scopes: `core`, `translator`, `webhook-logger`, `repo`

Examples:

- `feat(core): add translation caching`
- `fix(translator): handle empty webhook body`
- `docs(repo): update quality workflow docs`
- `chore(repo): update husky hooks`

---

## Acceptance Criteria

- [ ] No hardcoded package list in root scripts
- [ ] All packages have the 5 standard scripts
- [ ] No fragmented lint/format config in any package
- [ ] `verify:standards` fails fast on violations
- [ ] Pre-commit: compact log, fail-fast sequential
- [ ] Commitlint enforces scope
- [ ] `zod` unified to `^4.3.6` across all packages
- [ ] README + `docs/quality-workflow.md` up to date

---

## Verification Commands

```bash
bun run verify:standards   # Should pass
bun run lint               # Should pass (no errors)
bun run typecheck          # Should pass
bun test                   # Should pass
bun run quality            # All three above in sequence
```
