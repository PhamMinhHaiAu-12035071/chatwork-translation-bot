# Design: Intra-package `~/` Alias + Strict ESLint Enforcement

Date: 2026-03-06

## Problem

All files inside `packages/` use relative `../` imports for intra-package navigation
(e.g. `../types/command` from `core/src/utils/`). There is no alias or enforcement to
prevent this. The codebase already has the rule that cross-package imports must use
`@chatwork-bot/core`, but intra-package imports have no such constraint.

## Goal

- Replace all `../` intra-package imports with a `~/` alias
- Enforce via ESLint so no `../` can be introduced in the future
- Document the rule in `ai_rules/` so AI agents and human devs always follow it

## Decisions

| Decision           | Choice                                                                              | Reason                                                          |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Alias prefix       | `~/`                                                                                | No conflict with workspace `@chatwork-bot/*`, backend-idiomatic |
| Alias target       | `./src/*` per package                                                               | `~/types/command` → `src/types/command`, no `src/` in import    |
| tsconfig location  | Each `packages/*/tsconfig.json`                                                     | Each package owns its own paths, clear separation               |
| ESLint enforcement | `eslint-plugin-import-x` + `import-x/no-relative-parent-imports`                    | Semantic rule, ESM flat config compatible, well-maintained fork |
| Resolver           | `eslint-import-resolver-typescript`                                                 | Resolves tsconfig paths so ESLint understands `~/`              |
| Migration          | Immediate — migrate all ~20 imports in same PR                                      | Project is small, zero risk                                     |
| Docs               | AGENTS.md + CLAUDE.md + ai_rules/export-patterns.md + ai_rules/project-structure.md | Full coverage for AI agents and human devs                      |

## Architecture

### tsconfig per package

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

Applied to: `packages/core/tsconfig.json`, `packages/translator/tsconfig.json`,
`packages/webhook-logger/tsconfig.json`.

### ESLint config

New devDependencies (root):

- `eslint-plugin-import-x`
- `eslint-import-resolver-typescript`

Addition to `eslint.config.ts`:

```typescript
import importX from 'eslint-plugin-import-x'

// new config block
{
  plugins: { 'import-x': importX },
  settings: {
    'import-x/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['packages/*/tsconfig.json'],
      },
    },
  },
  rules: {
    'import-x/no-relative-parent-imports': 'error',
  },
}
```

### Import migration

All `../` in `packages/` become `~/`:

| File                                                  | Changes                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/core/src/interfaces/chatwork.ts`            | `../types/chatwork` → `~/types/chatwork`                                 |
| `packages/core/src/utils/parse-command.ts`            | `../types/command` (×2) → `~/types/command`                              |
| `packages/core/src/chatwork/client.ts`                | `../types/chatwork`, `../interfaces/chatwork` → `~/`                     |
| `packages/core/src/chatwork/client.test.ts`           | `../types/chatwork` → `~/types/chatwork`                                 |
| `packages/core/src/services/mock-translation.ts`      | `../interfaces/translation` → `~/interfaces/translation`                 |
| `packages/core/src/services/gemini-translation.ts`    | `../interfaces/translation` (×2), `../types/ai` (×2) → `~/`              |
| `packages/core/src/services/openai-translation.ts`    | `../interfaces/translation` (×2), `../types/ai` (×2) → `~/`              |
| `packages/core/src/services/translation-factory.ts`   | `../interfaces/translation`, `../types/ai` (×2) → `~/`                   |
| `packages/translator/src/utils/output-writer.ts`      | `../types/output` → `~/types/output`                                     |
| `packages/translator/src/utils/output-writer.test.ts` | `../types/output` → `~/types/output`                                     |
| `packages/translator/src/webhook/handler.ts`          | `../env`, `../utils/output-writer`, `../services/chatwork-sender` → `~/` |
| `packages/webhook-logger/src/routes/webhook.ts`       | `../env` → `~/env`                                                       |

Note: `./` same-directory imports remain unchanged. Only `../` is banned.

### Documentation updates

- `ai_rules/export-patterns.md` — add "Rule: Intra-package imports must use `~/` alias"
- `ai_rules/project-structure.md` — add `~/` to tsconfig hierarchy section
- `AGENTS.md` — add inline critical rule
- `CLAUDE.md` — add inline critical rule

## Constraints

- `~/` must NOT be added to `tsconfig.base.json` — `baseUrl` differs between root and packages
- `.test.ts` files are excluded from `tsconfig.base.json` include but need `~/` too — handled by per-package tsconfig which has no test exclusion override, or add `tsconfig.test.json`
- ESLint `ignores` already excludes `*.config.ts` — no impact on `eslint.config.ts` itself

## Testing Strategy

- After migration: `bun test` must pass (all ~12 affected files)
- `bun run typecheck` must pass (tsconfig paths resolve correctly)
- `bun run lint` must show zero errors (ESLint rule active, no `../` remains)

## Verification Commands

```bash
bun test && bun run typecheck && bun run lint
```

## Commit Scope

`chore(repo)` — no business logic change, pure refactor + tooling.
