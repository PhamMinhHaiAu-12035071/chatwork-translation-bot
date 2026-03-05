# Design: tsconfig Path Alias Cleanup & Standardization

**Date**: 2026-03-05
**Status**: Approved
**Scope**: Config-only — no source file changes

## Problem Statement

The current tsconfig setup has several inconsistencies:

1. `tsconfig.base.json` has `@core/*` and `@translator/*` paths that are **never used** in source code — dead config causing confusion
2. No `baseUrl` in base config, so paths resolve incorrectly when extended by packages
3. Each package overrides paths differently (inconsistent local overrides)
4. `@chatwork-bot/webhook-logger` missing from base tsconfig paths
5. Docs (ai_rules, CLAUDE.md, AGENTS.md) don't reflect the actual workspace import convention

## Decision

**Keep `@chatwork-bot/core` workspace imports** (current source code unchanged).
Add explicit `paths` in `tsconfig.base.json` that map workspace package names to their source entry points, enabling accurate TypeScript and IDE resolution without duplicating workspace resolution logic.

## Approach: Add @chatwork-bot/\* aliases (Option B)

Chosen over:

- Minimal cleanup only (less explicit, no IDE benefit)
- Zero paths (loses tsconfig documentation value)

## Design

### tsconfig.base.json

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

**Changes from current:**

- Add `"baseUrl": "."`
- Remove `"@core/*"` and `"@translator/*"` (unused)
- Add `@chatwork-bot/*` paths for all 3 packages

### packages/\*/tsconfig.json (all three)

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

**Changes from current:**

- Add `"baseUrl": "../.."` (overrides base's `"."` so paths resolve from monorepo root)
- Remove all local `paths` overrides (they were inconsistent and wrong)

### tsconfig.root.json

No changes needed. Already correct.

## Import Convention (unchanged)

```typescript
// Primary — always use workspace package name via barrel
import { parseCommand, ChatworkClient } from '@chatwork-bot/core'
import type { ITranslationService } from '@chatwork-bot/core'

// Never use deep paths or path aliases
// import { parseCommand } from '@core/utils/parse-command'  // WRONG
// import { parseCommand } from 'core/utils/parse-command'   // WRONG
```

## tsconfig Hierarchy

```
tsconfig.base.json         (baseUrl: ".", paths: @chatwork-bot/*)
  ├── tsconfig.root.json   (for root scripts, exclude packages/)
  ├── packages/core/tsconfig.json         (baseUrl: "../..")
  ├── packages/translator/tsconfig.json   (baseUrl: "../..")
  └── packages/webhook-logger/tsconfig.json (baseUrl: "../..")
```

## Files Changed

| File                                    | Change                                  |
| --------------------------------------- | --------------------------------------- |
| `tsconfig.base.json`                    | Add baseUrl, replace paths              |
| `packages/core/tsconfig.json`           | Add baseUrl "../..", remove local paths |
| `packages/translator/tsconfig.json`     | Add baseUrl "../..", remove local paths |
| `packages/webhook-logger/tsconfig.json` | Add baseUrl "../..", remove local paths |
| `ai_rules/export-patterns.md`           | Add tsconfig path strategy section      |
| `ai_rules/project-structure.md`         | Add tsconfig hierarchy section          |
| `CLAUDE.md`                             | Clarify import convention rule          |
| `AGENTS.md`                             | Clarify import convention rule          |

## Files NOT Changed

- All `*.ts` source files
- All `*.test.ts` test files
- All `package.json` files
- `tsconfig.root.json`

## Verification

```bash
bun test && bun run typecheck && bun run lint
```

## Edge Cases

- `tsconfig.root.json` extends base and excludes packages — `baseUrl: "."` at base is compatible
- `bun test` does not run `tsc`, so test files with `exclude` in tsconfig are unaffected
- Bun resolves workspace packages via `node_modules` symlinks, redundant with tsconfig paths — acceptable
