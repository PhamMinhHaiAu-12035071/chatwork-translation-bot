# Commit Conventions

## Format

```
type(scope): subject
```

- `type`: required (see allowed types below)
- `scope`: required — must be one of: `core`, `translator`, `webhook-logger`, `repo`
- `subject`: short description, lowercase, no period at end

Example: `feat(translator): add DeepL translation service`

## Allowed Types

| Type       | Use when                              |
| ---------- | ------------------------------------- |
| `feat`     | New feature                           |
| `fix`      | Bug fix                               |
| `docs`     | Documentation only                    |
| `style`    | Formatting, no logic change           |
| `refactor` | Code restructure without feature/fix  |
| `test`     | Adding or updating tests              |
| `chore`    | Build process, tooling, dependencies  |
| `perf`     | Performance improvement               |
| `ci`       | CI/CD config                          |
| `build`    | Build system or external dependencies |
| `revert`   | Reverts a previous commit             |

Enforced by `commitlint` via Husky `commit-msg` hook.

## Branch Naming

```
feat/short-description
fix/short-description
chore/short-description
docs/short-description
refactor/short-description
```

Example: `feat/deepl-translation-service`

## Pre-commit Hooks (Husky)

Runs automatically on `git commit`:

1. **lint-staged**: Prettier + ESLint on staged files
2. **verify:standards**: `bun run scripts/verify-standards.ts`
3. **typecheck**: `bun run typecheck` across all packages
4. **tests**: `bun test` full suite

All 4 must pass for commit to succeed.

## Pull Request Requirements

Every PR must include:

- **Problem statement**: What issue does this solve?
- **Change summary**: What was changed and why?
- **Validation evidence**: Commands run + outputs (screenshots if UI)
- **Linked issue/task**: Reference the issue number
- **Notes**: Any `.env` changes, API behavior changes, or sample payloads
