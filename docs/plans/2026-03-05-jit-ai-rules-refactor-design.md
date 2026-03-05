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

**Approach B (rejected)**: Subdirectory grouping — `ai_rules/code/`, `ai_rules/workflow/`. Breaking
change cho 4 files hiện có, phức tạp hơn cần thiết.

**Approach C (rejected)**: Minimal — 3 file mới, merge còn lại. File `architecture-overview.md`
sẽ phình to, vi phạm single responsibility.

## Audience

| File            | Audience                | Purpose                                                   |
| --------------- | ----------------------- | --------------------------------------------------------- |
| `CLAUDE.md`     | Claude Code + Cursor    | Claude-specific features, hooks, MCP tools, memory system |
| `AGENTS.md`     | Codex + other AI agents | Universal agent guidance + inline critical rules fallback |
| `ai_rules/*.md` | All agents              | Detailed topic-specific rules (JIT-loaded on demand)      |

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

## CLAUDE.md After Refactor (~60 lines)

CLAUDE.md phân biệt với AGENTS.md bằng **Claude Code-specific section** (MCP tools, slash
commands, memory system) và **keyword-based triggers** cho JIT directives.

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor.

## Project Overview

Chatwork Translation Bot — webhook-based bot. Receives Chatwork messages, parses
`/translate <lang> <text>`, translates, replies. Pure backend, no frontend or database.

**Stack**: Bun v1.1+ · TypeScript 5.4+ strict · Bun.serve() · Zod · Docker (oven/bun:1.1-distroless)

## Monorepo

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/bot
(types, interfaces, utils, services)    (HTTP server, webhook handling)
```

→ Details: `ai_rules/project-structure.md`

## Environment Variables

Required: `CHATWORK_API_TOKEN`, `CHATWORK_WEBHOOK_SECRET`
Optional: `PORT` (default 3000), `NODE_ENV` (default development)

→ Details: `ai_rules/security.md`

## AI Rules — Read before working on related tasks

When you encounter these **keywords** in code or task description, read the linked file first:

### Types & Structure

- `interface`, `type`, `IXxx`, `types/`, `interfaces/` → read `ai_rules/type-organization.md` + `ai_rules/naming-conventions.md`
- `import`, `export`, `index.ts`, `from '@` → read `ai_rules/export-patterns.md`

### Testing

- `.test.ts`, `describe(`, `it(`, `expect(` → read `ai_rules/test-colocation.md`

### Code Quality & Workflow

- Formatting, linting, or TS config → read `ai_rules/code-style.md`
- Writing commit or creating PR → read `ai_rules/commit-conventions.md`
- Need commands for build/test/run → read `ai_rules/commands.md`

### Architecture

- Webhook, routing, request flow, or env → read `ai_rules/architecture-patterns.md` + `ai_rules/security.md`
- Unsure where to put a new file → read `ai_rules/project-structure.md`

## Claude Code–Specific

### Available MCP Tools

- `context7` — fetch library docs on demand (use when needing API reference)
- `github` — create issues, PRs, review code
- `sequentialthinking` — complex multi-step reasoning

### Custom Slash Commands

Check `.claude/commands/` for available workflows.

### Memory System

- Use `#` in conversation to save decisions permanently
- Session memories: `.claude/projects/*/memory/MEMORY.md`

## Definition of Done

<!-- Intentionally inline — must be immediately visible at session start, not JIT-loaded -->

```bash
bun test && bun run typecheck && bun run lint
```
````

## AGENTS.md After Refactor (~45 lines)

AGENTS.md phân biệt với CLAUDE.md bằng **Critical Rules inline** — làm fallback cho Codex và
các agent có độ tin cậy thấp hơn với JIT directives.

````markdown
# Repository Guidelines

This file provides guidance for Codex and other AI agents.

## Project Overview

Chatwork Translation Bot — Bun + TypeScript monorepo. Webhook-based bot, no frontend or database.
Two packages: `@chatwork-bot/core` (shared logic) and `@chatwork-bot/bot` (HTTP server).

→ Details: `ai_rules/project-structure.md`

## Critical Rules (inline — safety-critical, không JIT-load)

- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core` not `../../core/src/`
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
````

## JIT Mechanism — How It Works

### Directive vs Passive Link

**Directive-based** (reliable — instructions AI must follow):

```markdown
# GOOD: Directive with trigger keyword

- Thấy `interface`, `type` → read `ai_rules/type-organization.md`
```

**Passive link** (unreliable — AI may skip):

```markdown
# BAD: Passive link without trigger

- Type organization: ai_rules/type-organization.md
```

### Reliability by Platform

| Platform          | Reliability | Mechanism                                               |
| ----------------- | ----------- | ------------------------------------------------------- |
| Claude Code       | High        | CLAUDE.md treated as immutable system rules             |
| Cursor            | High        | Rules files injected per-context, directives followed   |
| Codex (AGENTS.md) | Medium      | Varies by implementation — mitigated by inline fallback |

### Why Definition of Done Is Inline (Not JIT)

`bun test && bun run typecheck && bun run lint` appears in both `CLAUDE.md` and `ai_rules/commands.md`.
This is **intentional** — not accidental duplication:

- `commands.md`: part of workflow reference docs (JIT context)
- `CLAUDE.md`/`AGENTS.md`: "Definition of Done" is a **safety gate** — must be visible at session
  start without any JIT-loading. Removing it creates risk of AI skipping validation.

### Update Strategy

| When to update...           | Update this file                                |
| --------------------------- | ----------------------------------------------- |
| Adding a new rule category  | Create new `ai_rules/<topic>.md`                |
| Updating existing rule      | Update the relevant `ai_rules/<topic>.md`       |
| Adding Claude Code feature  | Update `CLAUDE.md` Claude Code-Specific section |
| Adding universal rule       | Update `AGENTS.md` Critical Rules section       |
| Adding new build command    | Update `ai_rules/commands.md`                   |
| Changing commit scope/types | Update `ai_rules/commit-conventions.md`         |

## Expected Outcome

| Metric             | Before  | After  |
| ------------------ | ------- | ------ |
| CLAUDE.md lines    | 97      | ~60    |
| AGENTS.md lines    | 82      | ~45    |
| ai_rules/ files    | 4       | 10     |
| Duplicated content | High    | None\* |
| JIT compliance     | Partial | Full   |

\*Definition of Done là intentional duplication — safety gate, không phải bug.

## Files to Create

1. `ai_rules/code-style.md`
2. `ai_rules/commit-conventions.md`
3. `ai_rules/commands.md`
4. `ai_rules/architecture-patterns.md`
5. `ai_rules/project-structure.md`
6. `ai_rules/security.md`

## Files to Modify

1. `CLAUDE.md` — replace with ~60-line JIT directive + Claude-specific version
2. `AGENTS.md` — replace with ~45-line JIT directive + inline critical rules version

## Files to Keep Unchanged

- `ai_rules/type-organization.md`
- `ai_rules/naming-conventions.md`
- `ai_rules/export-patterns.md`
- `ai_rules/test-colocation.md`
