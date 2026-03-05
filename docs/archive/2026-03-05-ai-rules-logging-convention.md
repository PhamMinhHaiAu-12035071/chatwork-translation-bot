# AI Rules — Logging Convention Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cập nhật AI rules để future agents (Cursor, Claude Code, Codex) biết dùng logixlysia thay vì console.log khi làm việc với Elysia services.

**Architecture:** Ba thay đổi song song — tạo `ai_rules/logging.md` chứa toàn bộ convention chi tiết, thêm JIT trigger trong `CLAUDE.md` dẫn AI đến file đó, thêm inline critical rule trong `AGENTS.md` cho Codex đọc ngay mà không cần JIT load.

**Tech Stack:** Markdown, ai_rules JIT pattern (đã có trong dự án), commitlint scope `repo`

---

## Context: Codebase hiện tại

**Pattern JIT đã có trong CLAUDE.md:**

```markdown
- `.test.ts`, `describe(`, `it(` → read `ai_rules/test-colocation.md`
- Formatting, linting, or TS config → read `ai_rules/code-style.md`
```

**Critical Rules đã có trong AGENTS.md:**

```markdown
- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/`
- Never commit `.env`, tokens, or secrets
- Never use `any` type without explicit justification comment
```

**logixlysia đã implement ở:**

- `packages/translator/src/app.ts` — dùng `NODE_ENV !== 'test'` guard
- `packages/webhook-logger/src/app.ts` — cùng pattern

**Files giữ nguyên console.error (explicitly deferred):**

- `packages/translator/src/webhook/router.ts` — fire-and-forget `.catch()`
- `packages/webhook-logger/src/routes/webhook.ts` — cùng lý do
- `packages/*/src/index.ts` — startup logs informational

**Verification command:**

```bash
bun test && bun run typecheck && bun run lint
```

---

## Task 1: Tạo `ai_rules/logging.md`

**Files:**

- Create: `ai_rules/logging.md`

### Step 1: Tạo file với nội dung đầy đủ

Tạo `ai_rules/logging.md`:

````markdown
# Logging

## HTTP Request Logging: logixlysia

Elysia services dùng [`logixlysia`](https://github.com/PunGrumpy/logixlysia) — Elysia-native HTTP logging plugin — thay vì `console.log`/`console.error` thủ công.

**Tại sao logixlysia:**

- Tích hợp trực tiếp Elysia lifecycle (`onRequest`, `onAfterHandle`, `onError`) — không cần viết lại
- Tự động tính `durationMs` qua `process.hrtime.bigint()`
- TTY: colorized output cho dev. Non-TTY (Docker/pipe): plain text — tự detect
- Thay thế hoàn toàn `.onError` thủ công trong `app.ts`

---

## Pattern: thêm logixlysia vào Elysia app

```typescript
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'service-name' })

  // Guard: không chạy logixlysia trong test — tránh log noise trong test runner.
  // app.test.ts mock env.NODE_ENV = 'test', guard này có hiệu lực.
  if (env.NODE_ENV !== 'test') {
    app.use(
      logixlysia({
        config: {
          showStartupMessage: false,
          ip: false,
        },
      }),
    )
  }

  // KHÔNG cần .onError() thủ công — logixlysia đã handle
  return app.use(someRoutes)
}
```
````

**Config options được dùng:**

- `showStartupMessage: false` — tắt banner startup (đã có `console.log` trong `index.ts`)
- `ip: false` — không log IP address

---

## Explicitly deferred — KHÔNG dùng logixlysia ở đây

| File                                            | Lý do                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/translator/src/webhook/router.ts`     | `console.error` trong fire-and-forget `.catch()` — logixlysia's pino không accessible ngoài Elysia route context mà không thêm pino làm direct dep |
| `packages/webhook-logger/src/routes/webhook.ts` | Cùng lý do trên                                                                                                                                    |
| `packages/*/src/index.ts`                       | Startup `console.log` informational, one-time, không cần structured format                                                                         |
| `packages/core/**`                              | Core không có và không nên có Elysia dependency                                                                                                    |

---

## Test guard

`NODE_ENV !== 'test'` guard nhất quán với pattern `NODE_ENV === 'development'` đã dùng cho swagger:

```typescript
// Cùng pattern, cùng file
if (env.NODE_ENV !== 'test') {
  app.use(logixlysia({ config: { showStartupMessage: false, ip: false } }))
}

if (env.NODE_ENV === 'development') {
  app.use(swagger({ ... }))
}
```

`app.test.ts` mock `env.NODE_ENV = 'test'` → guard đảm bảo logixlysia không emit log trong test runner.

---

## Output format

**Development (TTY — có màu):**

```
🦊 2026-03-05 08:30:00.000 INFO  832.50ms POST /internal/translate 200
🦊 2026-03-05 08:30:01.000 ERROR  12.00ms POST /internal/translate 500
```

**Production (non-TTY — plain text):**

```
🦊 2026-03-05T08:30:00.000Z INFO 832.50ms POST /internal/translate 200
```

````

### Step 2: Verify file tồn tại và đọc đúng

```bash
cat ai_rules/logging.md | head -20
````

Expected: thấy header "# Logging" và section "## HTTP Request Logging: logixlysia"

### Step 3: Chạy verification

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 64/64 pass, no errors. (Chỉ documentation thay đổi — không ảnh hưởng TypeScript hay tests.)

### Step 4: Commit

```bash
git add ai_rules/logging.md
git commit -m "docs(repo): add ai_rules/logging.md — logixlysia convention for Elysia services"
```

---

## Task 2: Cập nhật `CLAUDE.md` — thêm JIT trigger

**Files:**

- Modify: `CLAUDE.md` — section "Code Quality & Workflow"

### Step 1: Xác định vị trí chèn

Mở `CLAUDE.md`. Tìm section:

```markdown
### Code Quality & Workflow

- Formatting, linting, or TS config → read `ai_rules/code-style.md`
- Writing commit or creating PR → read `ai_rules/commit-conventions.md`
- Need commands for build/test/run → read `ai_rules/commands.md`
```

### Step 2: Thêm trigger line

Thêm dòng này vào **cuối** block Code Quality & Workflow (sau dòng commands.md):

```markdown
- `console.log`, `console.error`, `logger`, `logixlysia` → read `ai_rules/logging.md`
```

File sau khi sửa (section Code Quality & Workflow):

```markdown
### Code Quality & Workflow

- Formatting, linting, or TS config → read `ai_rules/code-style.md`
- Writing commit or creating PR → read `ai_rules/commit-conventions.md`
- Need commands for build/test/run → read `ai_rules/commands.md`
- `console.log`, `console.error`, `logger`, `logixlysia` → read `ai_rules/logging.md`
```

### Step 3: Verify nội dung đúng

```bash
grep -n "logging" CLAUDE.md
```

Expected: thấy dòng chứa `ai_rules/logging.md`

### Step 4: Chạy verification

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 64/64 pass, no errors.

### Step 5: Commit

```bash
git add CLAUDE.md
git commit -m "docs(repo): add logging trigger to CLAUDE.md — routes to ai_rules/logging.md"
```

---

## Task 3: Cập nhật `AGENTS.md` — thêm inline critical rules

**Files:**

- Modify: `AGENTS.md` — block "Critical Rules"

### Step 1: Xác định vị trí chèn

Mở `AGENTS.md`. Tìm block Critical Rules:

```markdown
## Critical Rules (inline — safety-critical, not JIT-loaded)

- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
- Always use `import type` for type-only imports
- Prefix unused vars with `_` (enforced by ESLint)
- **Never** commit `.env`, tokens, or secrets
- **Never** use `any` type without explicit justification comment
```

### Step 2: Thêm 2 rules vào cuối block

Thêm sau dòng `any` type:

```markdown
- **Never** use `console.log` or `console.error` in Elysia route handlers or `app.ts` — use logixlysia plugin instead
- logixlysia is the HTTP logging plugin; add to `app.ts` with `NODE_ENV !== 'test'` guard; see `ai_rules/logging.md`
```

File sau khi sửa (Critical Rules block đầy đủ):

```markdown
## Critical Rules (inline — safety-critical, not JIT-loaded)

- TypeScript ESM strict mode only — never plain JS
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
- Always use `import type` for type-only imports
- Prefix unused vars with `_` (enforced by ESLint)
- **Never** commit `.env`, tokens, or secrets
- **Never** use `any` type without explicit justification comment
- **Never** use `console.log` or `console.error` in Elysia route handlers or `app.ts` — use logixlysia plugin instead
- logixlysia is the HTTP logging plugin; add to `app.ts` with `NODE_ENV !== 'test'` guard; see `ai_rules/logging.md`
```

### Step 3: Verify nội dung đúng

```bash
grep -n "logixlysia\|console.log" AGENTS.md
```

Expected: thấy 2 dòng mới trong Critical Rules block.

### Step 4: Chạy verification

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 64/64 pass, no errors.

### Step 5: Commit

```bash
git add AGENTS.md
git commit -m "docs(repo): add logixlysia critical rules to AGENTS.md — enforce no console.log in handlers"
```

---

## Task 4: Final verification

### Step 1: Chạy full test suite từ root

```bash
bun test && bun run typecheck && bun run lint
```

Expected: 64/64 pass, no errors.

### Step 2: Verify trigger chain hoạt động

Simulate: một AI agent đọc `CLAUDE.md` và thấy trigger `console.log`:

```bash
grep -n "console.log\|logging" CLAUDE.md
grep -n "logixlysia\|console" AGENTS.md
grep -c "." ai_rules/logging.md
```

Expected:

- `CLAUDE.md` có dòng trigger dẫn đến `ai_rules/logging.md`
- `AGENTS.md` có 2 critical rules
- `ai_rules/logging.md` tồn tại và có nội dung

### Step 3: Kiểm tra consistency giữa logging.md và code thực tế

```bash
grep -n "NODE_ENV" packages/translator/src/app.ts
grep -n "NODE_ENV" packages/webhook-logger/src/app.ts
```

Expected: thấy `env.NODE_ENV !== 'test'` guard — khớp với template trong `logging.md`.

---

## Summary

| Task   | Files                 | Mô tả                                                     |
| ------ | --------------------- | --------------------------------------------------------- |
| Task 1 | `ai_rules/logging.md` | Tạo mới — 4 sections: why, template, deferred, test guard |
| Task 2 | `CLAUDE.md`           | Thêm 1 trigger line trong Code Quality & Workflow         |
| Task 3 | `AGENTS.md`           | Thêm 2 inline critical rules trong Critical Rules block   |
| Task 4 | —                     | Final verification                                        |

**Tổng cộng: 3 files thay đổi, 3 commits**

**Key design decisions:**

- JIT trigger (không inline toàn bộ) — nhất quán với CLAUDE.md pattern hiện tại
- Inline trong AGENTS.md Critical Rules — Codex đọc ngay, không cần JIT
- `ai_rules/logging.md` là single source of truth — CLAUDE.md và AGENTS.md chỉ reference
