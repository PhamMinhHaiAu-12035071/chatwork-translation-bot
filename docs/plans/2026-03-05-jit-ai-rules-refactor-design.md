# Design: JIT AI Rules Refactor — CLAUDE.md + AGENTS.md

**Date**: 2026-03-05
**Status**: Approved, ready for implementation

## Problem

`CLAUDE.md` (~97 lines) và `AGENTS.md` (~82 lines) chứa nội dung chi tiết bị trùng lặp lẫn nhau
và với `ai_rules/`. Điều này:

- Tăng token usage ở mỗi session vì cả 2 file được load toàn bộ vào context
- Vi phạm nguyên tắc JIT (Just-In-Time) loading: load chi tiết chỉ khi cần
- Gây maintenance burden khi cùng nội dung nằm ở nhiều nơi

**Research findings** (từ [earezki.com case study](https://earezki.com/ai-news/2026-02-26-how-i-cut-my-ai-coding-agents-token-usage-by-65-without-changing-models/) và
[generate-claude.md](https://github.com/RayFernando1337/llm-cursor-rules/blob/main/generate-claude.md)):

- Files > 150 lines làm giảm agent performance 28-65%
- "Decisions, not descriptions" → 20% token reduction
- Directive-based references đảm bảo AI đọc đúng file khi cần

## Solution: Approach A — Flat ai_rules Expansion

Tách chi tiết ra `ai_rules/` (6 file mới), giữ 2 file chính chỉ với JIT directives.

## Audience

| File            | Audience                | Purpose                                        |
| --------------- | ----------------------- | ---------------------------------------------- |
| `CLAUDE.md`     | Claude Code + Cursor    | Claude-specific features, hooks, memory system |
| `AGENTS.md`     | Codex + other AI agents | Universal agent guidance                       |
| `ai_rules/*.md` | All agents              | Detailed topic-specific rules                  |

## New ai_rules Files (6 files)

### 1. `ai_rules/code-style.md`

**Source**: CLAUDE.md L81-88, AGENTS.md L27-34

Content:

- Prettier config: no semicolons, single quotes, trailing commas, 100 char width
- ESLint presets: `strictTypeChecked` + `stylisticTypeChecked`
- TypeScript strict settings: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `import type` for type-only imports (enforced by ESLint)
- Unused vars must be prefixed with `_`

### 2. `ai_rules/commit-conventions.md`

**Source**: CLAUDE.md L84, AGENTS.md L65-76 (+ branch naming + hooks)

Content:

- Conventional commits format: `type(scope): subject`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`
- PR requirements: problem statement, change summary, validation evidence, linked issue/task, .env notes
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`
- Pre-commit hooks: Husky → lint-staged → typecheck → tests

### 3. `ai_rules/commands.md`

**Source**: CLAUDE.md L18-40, AGENTS.md L14-23

Content:

- Development: `bun run dev`
- Build: `bun run build`
- Type checking: `bun run typecheck`
- Lint: `bun run lint`, `bun run lint:fix`
- Format: `bun run format`
- Test: `bun test`, `bun test <file>`
- Docker: `docker compose up`
- Pre-PR: `bun test && bun run typecheck && bun run lint`

### 4. `ai_rules/architecture-patterns.md`

**Source**: CLAUDE.md L56-72 (Key Patterns + Request Flow)

Content:

- Request Flow: `POST /webhook → router.ts (HMAC verify, 200 OK) → async: handleWebhookEvent → parseCommand → translate → sendMessage`
- Fire-and-forget webhook pattern
- Path aliases: `@core/*` → `packages/core/src/*`, `@bot/*` → `packages/bot/src/*`
- Service interface pattern: `ITranslationService` contract + `MockTranslationService` placeholder
- Chatwork markup stripping: `[To:xxx]`, `[rp aid=...]`, `[quote]`, `[info]`, `[title]`, `[code]`
- Env validation: Zod schema at module load, exports typed `env` singleton

### 5. `ai_rules/project-structure.md`

**Source**: CLAUDE.md L43-54, AGENTS.md L5-9

Content:

- Monorepo: Bun workspaces, 2 packages
- `@chatwork-bot/core`: shared logic, zero runtime deps, types + interfaces + utils + services
- `@chatwork-bot/bot`: HTTP server, env validation, Chatwork REST client, webhook handling
- Package exports point to raw TypeScript source (`./src/index.ts`)
- `dist/server.js`: build output (do not edit)
- Root configs: `eslint.config.ts`, `.prettierrc`, `commitlint.config.ts`, `docker-compose.yml`
- Business logic in `core`, integration/transport in `bot`

### 6. `ai_rules/security.md`

**Source**: CLAUDE.md L74-78, AGENTS.md L77-81

Content:

- Required env vars: `CHATWORK_API_TOKEN`, `CHATWORK_WEBHOOK_SECRET`
- Optional env vars: `PORT` (default 3000), `NODE_ENV` (default development)
- Never commit `.env`, tokens, or secrets to git
- Use `.env.example` as template
- Webhook signature verified with HMAC-SHA256 via Web Crypto
- Runtime health endpoints: `GET /health`, `POST /webhook`

## Existing ai_rules Files (unchanged)

| File                             | Status     |
| -------------------------------- | ---------- |
| `ai_rules/type-organization.md`  | Keep as-is |
| `ai_rules/naming-conventions.md` | Keep as-is |
| `ai_rules/export-patterns.md`    | Keep as-is |
| `ai_rules/test-colocation.md`    | Keep as-is |

## CLAUDE.md After Refactor (~45 lines)

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor.

## Project Overview

Chatwork Translation Bot — webhook-based bot. Receives Chatwork messages, parses
`/translate <lang> <text>`, translates, replies. Pure backend, no frontend or database.

**Stack**: Bun v1.1+ · TypeScript 5.4+ strict · Bun.serve() · Zod · Docker (oven/bun:1.1-distroless)

## Monorepo
```

@chatwork-bot/core ←── imported by ── @chatwork-bot/bot
(types, interfaces, utils, services) (HTTP server, webhook handling)

````
→ Details: ai_rules/project-structure.md

## Environment Variables

Required: `CHATWORK_API_TOKEN`, `CHATWORK_WEBHOOK_SECRET`
Optional: `PORT` (default 3000), `NODE_ENV` (default development)
→ Details: ai_rules/security.md

## AI Rules — Đọc trước khi làm task liên quan

### Types & Structure
- Modify types/interfaces/data shapes → read `ai_rules/type-organization.md`
- Naming identifiers/files/folders    → read `ai_rules/naming-conventions.md`
- Imports/exports/barrel files        → read `ai_rules/export-patterns.md`

### Testing
- Viết hoặc sửa tests → read `ai_rules/test-colocation.md`

### Code Quality & Workflow
- Formatting/linting/TS config → read `ai_rules/code-style.md`
- Commits/PRs/branches         → read `ai_rules/commit-conventions.md`
- Dev/build/test commands      → read `ai_rules/commands.md`

### Architecture
- Request flow/key patterns         → read `ai_rules/architecture-patterns.md`
- Monorepo structure/package layout → read `ai_rules/project-structure.md`
- Env vars/secrets/security         → read `ai_rules/security.md`

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
````

````

## AGENTS.md After Refactor (~32 lines)

```markdown
# Repository Guidelines

This file provides guidance for Codex and other AI agents.

## Project Overview

Chatwork Translation Bot — Bun + TypeScript monorepo. Webhook-based, no frontend/database.
Two packages: `@chatwork-bot/core` (shared logic) and `@chatwork-bot/bot` (HTTP server).
→ Details: ai_rules/project-structure.md

## Quick Commands

→ See ai_rules/commands.md for all dev/test/build/lint commands.

Pre-PR validation: `bun test && bun run typecheck && bun run lint`

## AI Rules — Read before working on related tasks

### Code & Types
- Types/interfaces/data shapes → ai_rules/type-organization.md
- Naming conventions           → ai_rules/naming-conventions.md
- Imports/exports/barrels      → ai_rules/export-patterns.md
- Tests                        → ai_rules/test-colocation.md

### Style & Workflow
- Formatting/linting/TS config → ai_rules/code-style.md
- Commits/PRs/branches         → ai_rules/commit-conventions.md

### Architecture & Security
- Request flow/key patterns → ai_rules/architecture-patterns.md
- Env vars/secrets          → ai_rules/security.md
````

## JIT Mechanism — How It Works

**Directive-based references** (vs passive links) đảm bảo reliability:

- **Claude Code**: CLAUDE.md content được treat như immutable system rules, priority cao hơn user
  prompts. Khi instruction nói "read ai_rules/X.md", Claude SẼ đọc file đó.
- **Cursor**: Rules files được inject theo context. Directives trong CLAUDE.md được follow.
- **Codex/AGENTS.md**: Medium reliability — phụ thuộc agent implementation. Format directive
  tăng khả năng agent đọc đúng file.

**Pattern**: Không dùng passive link, dùng explicit instruction:

```markdown
# GOOD: Directive

- Modify types → read `ai_rules/type-organization.md`

# BAD: Passive link

- Type organization: ai_rules/type-organization.md
```

## Expected Outcome

| Metric             | Before  | After |
| ------------------ | ------- | ----- |
| CLAUDE.md lines    | 97      | ~45   |
| AGENTS.md lines    | 82      | ~32   |
| ai_rules/ files    | 4       | 10    |
| Duplicated content | High    | None  |
| JIT compliance     | Partial | Full  |

## Files to Create

1. `ai_rules/code-style.md`
2. `ai_rules/commit-conventions.md`
3. `ai_rules/commands.md`
4. `ai_rules/architecture-patterns.md`
5. `ai_rules/project-structure.md`
6. `ai_rules/security.md`

## Files to Modify

1. `CLAUDE.md` — replace with ~45-line JIT directive version
2. `AGENTS.md` — replace with ~32-line JIT directive version

## Files to Keep Unchanged

- `ai_rules/type-organization.md`
- `ai_rules/naming-conventions.md`
- `ai_rules/export-patterns.md`
- `ai_rules/test-colocation.md`
