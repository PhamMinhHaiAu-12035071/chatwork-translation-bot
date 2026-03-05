# Design: AI Rules — Logging Convention Documentation

**Date**: 2026-03-05
**Status**: Approved
**Scope**: `AGENTS.md`, `CLAUDE.md`, `ai_rules/logging.md` (create new) — không thay đổi source code

---

## Problem Statement

logixlysia đã được implement thành công vào `packages/translator` và `packages/webhook-logger`, nhưng không có AI rule nào được cập nhật. Kết quả:

- Future AI agents (Cursor, Claude Code, Codex) sẽ viết `console.log`/`console.error` vì không có rule nào cấm
- Không có trigger nào dẫn AI đến logging convention khi thấy `console.log` trong codebase
- AGENTS.md (dùng bởi Codex, CI agents) không có inline rule về logging

---

## Decision: JIT trigger + inline critical rule

**Tại sao JIT trigger thay vì inline toàn bộ:**

- Nhất quán với pattern hiện tại của CLAUDE.md (`.test.ts → test-colocation.md`, `interface → type-organization.md`)
- Giảm bloat trong CLAUDE.md/AGENTS.md
- Cho phép logging.md mở rộng mà không chỉnh sửa CLAUDE.md

**Tại sao thêm inline rule trong AGENTS.md Critical Rules:**

- Codex và CI agents đọc AGENTS.md để lấy hard constraints
- Critical Rules là "safety-critical, không JIT-load" — logging sai là pattern error rõ ràng
- Inline rule ngắn gọn (1-2 dòng) không gây bloat

---

## File Changes

### 1. Tạo `ai_rules/logging.md` (new)

Content gồm 4 sections:

**Why logixlysia:**

- logixlysia là Elysia-native HTTP logging plugin — tích hợp trực tiếp Elysia lifecycle (onRequest, onAfterHandle, onError)
- Thay thế manual `.onError` handler trước đây
- Tự động tính durationMs, structured output, TTY color detection

**Code template (app.ts pattern):**

```typescript
import logixlysia from 'logixlysia'

export function createApp() {
  const app = new Elysia({ name: 'service-name' })

  // Guard: không chạy logixlysia trong test — tránh log noise trong test runner
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
  // ...
}
```

**Explicitly deferred (không dùng logixlysia):**
| File | Lý do |
|---|---|
| `*/src/webhook/router.ts` | fire-and-forget `.catch()` — không có Elysia route context |
| `*/src/routes/webhook.ts` | Cùng lý do trên |
| `*/src/index.ts` (startup logs) | Informational, one-time — không cần structured format |

**Test guard:**

- `NODE_ENV !== 'test'` guard đồng bộ với `NODE_ENV === 'development'` swagger pattern
- `app.test.ts` mock `env.NODE_ENV = 'test'` → guard hoạt động tự động

### 2. Sửa `CLAUDE.md` — Code Quality & Workflow section

Thêm 1 dòng trigger:

```markdown
- `console.log`, `console.error`, `logger`, `logixlysia` → read `ai_rules/logging.md`
```

### 3. Sửa `AGENTS.md` — Critical Rules block

Thêm 2 dòng vào Critical Rules (inline — không JIT):

```markdown
- **Never** use `console.log` or `console.error` in route handlers — use logixlysia plugin in `app.ts`
- logixlysia is the HTTP logging plugin for Elysia services; requires `NODE_ENV !== 'test'` guard
```

---

## Scope rõ ràng

**logixlysia chỉ dùng ở:**

- `packages/translator/src/app.ts`
- `packages/webhook-logger/src/app.ts`

**Không dùng logixlysia ở:**

- Fire-and-forget `.catch()` callbacks (không có Elysia context)
- Startup logs trong `index.ts`
- `packages/core/**`

---

## Verification

```bash
# Không có source code thay đổi — chỉ documentation
# Verify bằng cách check AI agents đọc đúng file
bun test && bun run typecheck && bun run lint
```

---

## Summary

| File                  | Action                                                   |
| --------------------- | -------------------------------------------------------- |
| `ai_rules/logging.md` | Create — 4 sections: why, template, deferred, test guard |
| `CLAUDE.md`           | Add 1 trigger line in Code Quality section               |
| `AGENTS.md`           | Add 2 inline critical rules                              |
