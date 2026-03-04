# Quality Workflow

## Command Matrix

| Command                    | What it does                                                      | When to use                       |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| `bun run lint`             | ESLint across all packages                                        | Before committing                 |
| `bun run lint:fix`         | ESLint with auto-fix                                              | When lint errors are auto-fixable |
| `bun run format`           | Prettier across packages + root docs                              | Before committing                 |
| `bun run typecheck`        | tsc clean for root + all packages                                 | Before committing                 |
| `bun test`                 | All tests                                                         | Before committing                 |
| `bun run quality`          | lint + typecheck + test in sequence                               | Full pre-push check               |
| `bun run quality:ci`       | quality + prettier --check                                        | CI or final validation            |
| `bun run verify:standards` | Check all packages have required scripts and no fragmented config | Automated via pre-commit          |

## Pre-Commit Hook Flow

```
git commit
    ↓
[↻] lint-staged     → ESLint --fix + Prettier on staged files
[✓] lint-staged
    ↓ (fail-fast: if lint-staged fails, stop here)
[↻] verify:standards → Check 5 required scripts + no fragmented config in packages/
[✓] verify:standards
    ↓
[↻] typecheck       → tsc root + all packages
[✓] typecheck
    ↓
[↻] tests           → bun test
[✓] tests
    ↓
commit-msg hook     → commitlint enforces scope
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
```

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
```

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
