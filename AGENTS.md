# Repository Guidelines

This file provides guidance for Codex and other AI agents.

## Project Overview

Chatwork Translation Bot — Bun + TypeScript monorepo. Webhook-based bot, no frontend or database.
Three packages: `@chatwork-bot/core` (shared logic), `@chatwork-bot/translator` (HTTP server + translation), `@chatwork-bot/webhook-logger` (webhook receiver).

→ Details: `ai_rules/project-structure.md`

## Critical Rules (inline — safety-critical, not JIT-loaded)

- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
- Always use `import type` for type-only imports
- Prefix unused vars with `_` (enforced by ESLint)
- **Never** commit `.env`, tokens, or secrets
- **Never** use `any` type without explicit justification comment

## Commands

→ See `ai_rules/commands.md` for all dev/test/build/lint/docker commands.

Pre-PR validation (must all pass):

```bash
bun test && bun run typecheck && bun run lint
```

## AI Rules — Read before working on related tasks

When you encounter these **keywords** in code or task description, read the linked file first:

### Types & Code Structure

- `interface`, `type`, `IXxx`, `types/`, `interfaces/` → `ai_rules/type-organization.md` + `ai_rules/naming-conventions.md`
- `import`, `export`, `index.ts`, `from '@` → `ai_rules/export-patterns.md`
- `.test.ts`, `describe(`, `it(` → `ai_rules/test-colocation.md`

### Style & Workflow

- Formatting, linting, TS config → `ai_rules/code-style.md`
- Commit, PR, or branch → `ai_rules/commit-conventions.md`

### Architecture & Security

- Webhook, routing, env, or secrets → `ai_rules/architecture-patterns.md` + `ai_rules/security.md`
