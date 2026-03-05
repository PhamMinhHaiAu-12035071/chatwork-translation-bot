# Code Style

## Formatter: Prettier

Config in `.prettierrc`:

- No semicolons
- Single quotes
- Trailing commas (ES5)
- Print width: 100 characters

Auto-format on save. To run manually: `bun run format`

## Linter: ESLint

Presets enabled: `strictTypeChecked` + `stylisticTypeChecked`

Key enforced rules:

- `import type` required for type-only imports (`@typescript-eslint/consistent-type-imports`)
- Unused variables must be prefixed with `_` (e.g. `_event`, `_unused`)

To run: `bun run lint`
To auto-fix: `bun run lint:fix`

## TypeScript Strict Settings

Beyond `strict: true`, these additional settings are enabled:

| Setting                      | Effect                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| `noUncheckedIndexedAccess`   | Array/object index access returns `T \| undefined`, not `T`             |
| `exactOptionalPropertyTypes` | Optional props must be explicitly `T \| undefined`, not just assignable |

These are configured in `tsconfig.root.json` and inherited by all packages.
