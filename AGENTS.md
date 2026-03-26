# Repository Guidelines

This file provides guidance for Codex and other AI agents.

## Project Overview

Chatwork Translation Bot — Bun + TypeScript monorepo. Webhook-based bot, no frontend or database.
Nine packages:

- `@chatwork-bot/core` — types, interfaces, ILLMExecutor, plugin registry (NO provider-specific model values)
- `@chatwork-bot/translation-prompt` — 4-phase pipeline prompts + Zod schemas (AnalysisSchema, ReviewSchema, PipelineTraceSchema)
- `@chatwork-bot/chatwork` — anti-corruption layer for Chatwork API
- `@chatwork-bot/provider-gemini` — Gemini provider plugin (`@ai-sdk/google`)
- `@chatwork-bot/provider-openai` — OpenAI provider plugin (`@ai-sdk/openai`)
- `@chatwork-bot/provider-cursor` — Cursor provider plugin, LOCAL DEV ONLY (`@ai-sdk/openai-compatible`)
- `@chatwork-bot/translator` — HTTP server, env validation, bootstrap, translation handler
- `@chatwork-bot/webhook-logger` — webhook receiver, forwards to translator
- `@chatwork-bot/dataset-runner` — ACK-driven queue runner sidecar for dataset injection (LOCAL DEV ONLY)

→ Details: `ai_rules/project-structure.md`

## Critical Rules (inline — safety-critical, not JIT-loaded)

- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
- **Never** use `../` for intra-package imports — use `~/path` alias instead (e.g. `~/types/command` not `../types/command`)
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

## Learned User Preferences

- For dashboard modals over scrollable pages, opening the dialog must not change viewport scroll: programmatic focus inside fixed overlays should use `focus({ preventScroll: true })`, and background scroll should be locked while the modal is open. When locking body scroll (`overflow: hidden`), also apply `padding-right` equal to the scrollbar width (`window.innerWidth - document.documentElement.clientWidth`) to prevent layout shift from the scrollbar disappearing.

## Learned Workspace Facts

- `packages/dashboard` is the React SPA (Vite, Tailwind) for multi-room room management; UI work for that product lives there alongside the webhook bot packages.
- The dashboard uses a neubrutalism design language; shared visual primitives (`.brutal-button`, `.brutal-input`, `.brutal-input-error`) are defined as CSS classes in `packages/dashboard/src/styles/global.css` rather than inline Tailwind utilities.
