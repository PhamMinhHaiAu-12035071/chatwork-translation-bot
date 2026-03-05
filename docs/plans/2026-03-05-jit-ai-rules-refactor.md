# JIT AI Rules Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor CLAUDE.md và AGENTS.md thành JIT directive-based format, tách chi tiết ra 6 file ai_rules/ mới để giảm token usage và loại bỏ duplication.

**Architecture:** Tạo 6 ai_rules/ files mới chứa nội dung chi tiết. Rewrite CLAUDE.md (~60 dòng) và AGENTS.md (~45 dòng) chỉ giữ JIT directives "read ai_rules/X.md when working on X". Không có code thay đổi — chỉ markdown files.

**Tech Stack:** Markdown, commitlint (scope: `repo`), Prettier (auto-format .md), Husky pre-commit hooks

---

### Task 1: Tạo `ai_rules/code-style.md`

**Files:**

- Create: `ai_rules/code-style.md`
- Source content from: `CLAUDE.md:81-88`, `AGENTS.md:27-34`

**Step 1: Tạo file**

```markdown
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

| Setting                      | Effect                               |
| ---------------------------- | ------------------------------------ | ------------------------------- |
| `noUncheckedIndexedAccess`   | Array/object index access returns `T | undefined`, not `T`             |
| `exactOptionalPropertyTypes` | Optional props must be explicitly `T | undefined`, not just assignable |

These are configured in `tsconfig.root.json` and inherited by all packages.
```

**Step 2: Verify Prettier formats file correctly**

```bash
bun run format
```

Expected: File reformatted (or no changes needed). No errors.

**Step 3: Commit**

```bash
git add ai_rules/code-style.md
git commit -m "docs(repo): add ai_rules/code-style.md with Prettier, ESLint, TS strict settings"
```

Expected: Pre-commit hooks pass, commit succeeds.

---

### Task 2: Tạo `ai_rules/commit-conventions.md`

**Files:**

- Create: `ai_rules/commit-conventions.md`
- Source content from: `CLAUDE.md:84`, `AGENTS.md:65-76`

**Step 1: Tạo file**

```markdown
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

| Type       | Use when                                        |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature                                     |
| `fix`      | Bug fix                                         |
| `docs`     | Documentation only                              |
| `style`    | Formatting, no logic change                     |
| `refactor` | Code restructure without feature/fix            |
| `test`     | Adding or updating tests                        |
| `chore`    | Build process, tooling, dependencies            |
| `perf`     | Performance improvement                         |
| `ci`       | CI/CD config                                    |
| `build`    | Build system or external dependencies           |
| `revert`   | Reverts a previous commit                       |

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
```

**Step 2: Verify format**

```bash
bun run format
```

Expected: No errors.

**Step 3: Commit**

```bash
git add ai_rules/commit-conventions.md
git commit -m "docs(repo): add ai_rules/commit-conventions.md with conventional commits, PR format, branches"
```

---

### Task 3: Tạo `ai_rules/commands.md`

**Files:**

- Create: `ai_rules/commands.md`
- Source content from: `CLAUDE.md:18-40`, `AGENTS.md:14-23`

**Step 1: Tạo file**

````markdown
# Commands

## Development

```bash
bun run dev          # Run bot with hot-reload (packages/bot/src/index.ts)
```
````

## Build

```bash
bun run build        # Bundle to dist/server.js (minified, target bun)
```

## Type Checking

```bash
bun run typecheck    # Checks root + all packages (core, translator, webhook-logger)
```

## Linting & Formatting

```bash
bun run lint         # ESLint (strict + stylistic)
bun run lint:fix     # ESLint with auto-fix
bun run format       # Prettier (formats .ts, .json, .md, .yml)
```

## Testing

```bash
bun test                                                    # Run all tests
bun test packages/core/src/utils/parse-command.test.ts     # Run single file
```

## Docker

```bash
docker compose up            # Run on port 3000 with healthcheck
docker compose up --build    # Rebuild image and run
```

## Pre-PR Validation

Run this before creating any pull request:

```bash
bun test && bun run typecheck && bun run lint
```

All three must pass with zero errors.

````

**Step 2: Commit**

```bash
git add ai_rules/commands.md
git commit -m "docs(repo): add ai_rules/commands.md with all dev/test/build/lint commands"
````

---

### Task 4: Tạo `ai_rules/architecture-patterns.md`

**Files:**

- Create: `ai_rules/architecture-patterns.md`
- Source content from: `CLAUDE.md:56-72` (Request Flow + Key Patterns)

**Step 1: Tạo file**

```markdown
# Architecture Patterns

## Request Flow
```

POST /webhook
→ router.ts (verify HMAC-SHA256 signature, return 200 OK immediately)
→ async (fire-and-forget): handleWebhookEvent
→ parseCommand()
→ ITranslationService.translate()
→ Chatwork API sendMessage()

````

**Fire-and-forget pattern**: The webhook handler returns 200 OK immediately and processes
the translation asynchronously. This prevents Chatwork from retrying on slow responses.

## Path Aliases

Configured in `tsconfig.root.json` and recognized by Bun's bundler:

| Alias       | Resolves to               |
| ----------- | ------------------------- |
| `@core/*`   | `packages/core/src/*`     |
| `@bot/*`    | `packages/bot/src/*`      |

Example: `import { parseCommand } from '@core/utils/parse-command'`

## Service Interface Pattern

`ITranslationService` in `packages/core/src/interfaces/translation.ts` defines the contract.
`MockTranslationService` is the current placeholder implementation.

When adding a real translation provider:
1. Implement `ITranslationService` in `packages/core/src/services/`
2. Do not modify the interface — code against the abstraction
3. Swap implementation at the bot's composition root (`packages/bot/src/index.ts`)

## Chatwork Markup Stripping

`parseCommand()` strips these tags from message text before parsing:

- `[To:xxx]` — mention tags
- `[rp aid=...]` — reply tags
- `[quote]...[/quote]` — quoted messages
- `[info]...[/info]` — info blocks
- `[title]...[/title]` — title tags
- `[code]...[/code]` — code blocks

This ensures `/translate en hello` is found even when the message contains markup.

## Env Validation Pattern

Zod schema is parsed **at module load** in `packages/bot/src/env.ts`.
It exports a typed `env` singleton used throughout the bot.

```typescript
// Usage — never use process.env directly in bot code
import { env } from '@bot/env'
const token = env.CHATWORK_API_TOKEN
````

If a required variable is missing, the process exits at startup with a clear error.

````

**Step 2: Commit**

```bash
git add ai_rules/architecture-patterns.md
git commit -m "docs(repo): add ai_rules/architecture-patterns.md with request flow and key patterns"
````

---

### Task 5: Tạo `ai_rules/project-structure.md`

**Files:**

- Create: `ai_rules/project-structure.md`
- Source content from: `CLAUDE.md:43-54`, `AGENTS.md:5-9`

**Step 1: Tạo file**

```markdown
# Project Structure

## Monorepo Layout

Bun workspaces monorepo. Two packages:
```

@chatwork-bot/core ←── imported by ── @chatwork-bot/bot
(types, interfaces, (HTTP server, env,
utils, services) Chatwork client, webhook handling)

```

## Package Responsibilities

### `packages/core` (`@chatwork-bot/core`)

Shared logic with **zero runtime dependencies**.

Contains:
- `src/types/` — external data shapes (webhook events, API responses)
- `src/interfaces/` — behavioral contracts (`ITranslationService`, `IChatworkClient`)
- `src/services/` — service implementations (`MockTranslationService`)
- `src/utils/` — pure utility functions (`parseCommand`)

Package exports point to raw TypeScript source (`"main": "./src/index.ts"`).
No build step needed for `core` — Bun resolves TypeScript directly.

### `packages/bot` (`@chatwork-bot/bot`)

Runnable HTTP server. Owns:
- Env validation (Zod schema in `src/env.ts`)
- Chatwork REST API client (`src/chatwork/`)
- Webhook signature verification (HMAC-SHA256 via Web Crypto)
- HTTP routing (`src/webhook/router.ts`)
- Webhook event handling (`src/webhook/handler.ts`)

## Key Files

| File | Purpose |
| ---- | ------- |
| `dist/server.js` | Build output — do not edit manually |
| `eslint.config.ts` | Root ESLint config shared by all packages |
| `.prettierrc` | Prettier config |
| `commitlint.config.ts` | Conventional commits enforcement |
| `docker-compose.yml` | Local Docker setup on port 3000 |
| `.env.example` | Template for required env vars |

## Rule: Core vs Bot

Business logic belongs in `core`. Integration and transport concerns belong in `bot`.

- Parsing, translation interfaces, domain types → `core`
- HTTP handling, Chatwork API calls, env loading → `bot`
```

**Step 2: Commit**

```bash
git add ai_rules/project-structure.md
git commit -m "docs(repo): add ai_rules/project-structure.md with monorepo layout and package responsibilities"
```

---

### Task 6: Tạo `ai_rules/security.md`

**Files:**

- Create: `ai_rules/security.md`
- Source content from: `CLAUDE.md:74-78`, `AGENTS.md:77-81`

**Step 1: Tạo file**

```markdown
# Security

## Environment Variables

### Required

| Variable                  | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `CHATWORK_API_TOKEN`      | Chatwork REST API authentication token  |
| `CHATWORK_WEBHOOK_SECRET` | Secret for verifying webhook signatures |

### Optional

| Variable   | Default       | Purpose             |
| ---------- | ------------- | ------------------- |
| `PORT`     | `3000`        | HTTP server port    |
| `NODE_ENV` | `development` | Runtime environment |

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

## Secrets Management

- **Never** commit `.env`, API tokens, or credentials to git
- `.env` is in `.gitignore` — verify before staging
- For CI/CD, use repository secrets (GitHub Actions secrets)
- When adding new env vars, add them to `.env.example` with a placeholder value

## Webhook Signature Verification

All incoming webhooks are verified with HMAC-SHA256 before processing:

1. Chatwork sends `X-ChatWorkWebhookSignature` header with every request
2. Bot computes HMAC-SHA256 of request body using `CHATWORK_WEBHOOK_SECRET`
3. Signatures are compared using constant-time comparison (timing-attack safe)
4. Requests with invalid signatures are rejected with 400

Implementation: `packages/bot/src/webhook/router.ts`

## Runtime Endpoints

| Endpoint   | Method | Purpose                       |
| ---------- | ------ | ----------------------------- |
| `/health`  | GET    | Health check (returns 200 OK) |
| `/webhook` | POST   | Chatwork webhook receiver     |

Verify locally after startup: `curl http://localhost:3000/health`
```

**Step 2: Commit**

```bash
git add ai_rules/security.md
git commit -m "docs(repo): add ai_rules/security.md with env vars, secrets, webhook verification"
```

---

### Task 7: Rewrite `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md` (full rewrite — read first, then write)

**Step 1: Pre-flight — verify all 10 ai_rules files exist**

Tasks 1-6 must complete before this task. Verify:

```bash
ls ai_rules/ | sort
```

Expected (10 files, alphabetical):

```
architecture-patterns.md
code-style.md
commit-conventions.md
commands.md
export-patterns.md
naming-conventions.md
project-structure.md
security.md
test-colocation.md
type-organization.md
```

Then verify exact count:

```bash
ls ai_rules/ | wc -l
```

Expected: `10`

**If count < 10: ABORT** — do not proceed with Task 7. Identify the missing file(s) using the list above and complete the corresponding Task (1–6) first. Overwriting CLAUDE.md before all ai_rules files exist will break JIT directive links.

**Step 2: Read current file**

```bash
cat CLAUDE.md | wc -l
```

Expected: 97 lines.

**Step 3: Rewrite with JIT directive + Claude-specific format**

Replace entire content with:

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

- Use `#` in conversation to save decisions permanently across sessions
- Session memories: `.claude/projects/*/memory/MEMORY.md`
- **When to use `#`**: Architectural decisions that affect future sessions (e.g., "we chose Approach A over B because..."), patterns discovered during debugging, user preferences for this project
- **When NOT to use `#`**: Temporary task state, information already in CLAUDE.md or ai_rules/

## Definition of Done

<!-- Intentionally inline — must be immediately visible at session start, not JIT-loaded -->

```bash
bun test && bun run typecheck && bun run lint
```
````

**Step 4: Verify line count**

```bash
cat CLAUDE.md | wc -l
```

Expected: ~60 lines.

**Step 5: Run format**

```bash
bun run format
```

Expected: No errors.

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(repo): refactor CLAUDE.md to JIT directive format with Claude-specific section (~60 lines, was 97)"
```

---

### Task 8: Rewrite `AGENTS.md`

**Files:**

- Modify: `AGENTS.md` (full rewrite — read first, then write)

**Step 1: Read current file**

```bash
cat AGENTS.md | wc -l
```

Expected: 82 lines.

**Step 2: Rewrite with JIT directive + inline critical rules format**

Replace entire content with:

````markdown
# Repository Guidelines

This file provides guidance for Codex and other AI agents.

## Project Overview

Chatwork Translation Bot — Bun + TypeScript monorepo. Webhook-based bot, no frontend or database.
Two packages: `@chatwork-bot/core` (shared logic) and `@chatwork-bot/bot` (HTTP server).

→ Details: `ai_rules/project-structure.md`

## Critical Rules (inline — safety-critical, not JIT-loaded)

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

**Step 3: Verify line count**

```bash
cat AGENTS.md | wc -l
```

Expected: ~45 lines.

**Step 4: Run format**

```bash
bun run format
```

**Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(repo): refactor AGENTS.md to JIT directive format with inline critical rules (~45 lines, was 82)"
```

---

### Task 9: Final Verification

**Step 1: Verify all 10 ai_rules files exist**

```bash
ls ai_rules/ | sort
```

Expected (exactly 10 files):

```
architecture-patterns.md
code-style.md
commit-conventions.md
commands.md
export-patterns.md
naming-conventions.md
project-structure.md
security.md
test-colocation.md
type-organization.md
```

Count check: `ls ai_rules/ | wc -l` → Expected: `10`

**Step 2: Verify CLAUDE.md has Claude-specific section**

```bash
grep -n "Claude Code" CLAUDE.md
```

Expected: At least 2 matches (`## Claude Code–Specific` heading + MCP tools section).

**Step 3: Verify AGENTS.md has inline critical rules**

```bash
grep -n "Critical Rules" AGENTS.md
```

Expected: 1 match — `## Critical Rules (inline — safety-critical, not JIT-loaded)`.

**Step 4: Verify old inline content removed from CLAUDE.md**

```bash
grep -n "no semicolons\|strictTypeChecked\|noUncheckedIndexedAccess\|conventional commits\|bun run dev\|fire-and-forget" CLAUDE.md
```

Expected: No matches (all moved to ai_rules/).

**Step 5: Verify old inline content removed from AGENTS.md**

```bash
grep -n "strictTypeChecked\|feat.*fix.*docs.*refactor\|bun run dev\|Husky" AGENTS.md
```

Expected: No matches.

**Step 6: Verify all keyword-based triggers present in both files**

```bash
grep -n "interface" CLAUDE.md AGENTS.md
grep -n "type" CLAUDE.md AGENTS.md
grep -n "IXxx" CLAUDE.md AGENTS.md
```

Expected: Each grep returns at least 1 match per file — the trigger directive line containing all three keywords.

**Step 7: Run full pre-PR validation**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All pass, no errors.

**Step 8: Verify clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Summary

| Task | Action                                     | Files touched   |
| ---- | ------------------------------------------ | --------------- |
| 1    | Create `ai_rules/code-style.md`            | 1 new file      |
| 2    | Create `ai_rules/commit-conventions.md`    | 1 new file      |
| 3    | Create `ai_rules/commands.md`              | 1 new file      |
| 4    | Create `ai_rules/architecture-patterns.md` | 1 new file      |
| 5    | Create `ai_rules/project-structure.md`     | 1 new file      |
| 6    | Create `ai_rules/security.md`              | 1 new file      |
| 7    | Rewrite `CLAUDE.md`                        | 1 modified file |
| 8    | Rewrite `AGENTS.md`                        | 1 modified file |
| 9    | Final verification                         | —               |

**Total**: 6 new files, 2 modified files, 8 commits.

**Expected outcome**:

- CLAUDE.md: 97 → ~60 lines (-38%) — includes Claude Code-specific section
- AGENTS.md: 82 → ~45 lines (-45%) — includes inline critical rules fallback
- ai_rules/: 4 → 10 files
- Zero accidental duplication (Definition of Done inline is intentional safety gate)
- Keyword-based JIT directives ensure AI reads correct file for each task type
- AGENTS.md fallback rules protect Codex from missing critical rules if JIT fails
