# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor.

## Project Overview

Chatwork Translation Bot — webhook-based bot. Receives Chatwork messages, parses
`/translate <lang> <text>`, translates, replies. Pure backend, no frontend or database.

**Stack**: Bun v1.1+ · TypeScript 5.4+ strict · Bun.serve() · Zod · Docker (oven/bun:1.1-distroless)

## Monorepo

```
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/translator      (HTTP server, translation)
@chatwork-bot/core  ←── imported by ──  @chatwork-bot/webhook-logger  (webhook receiver)
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
- tsconfig, path aliases, or baseUrl → read `ai_rules/project-structure.md` (tsconfig hierarchy section)

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
