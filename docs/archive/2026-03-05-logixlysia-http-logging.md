# logixlysia HTTP Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Thêm HTTP request/response/error logging qua logixlysia vào translator và webhook-logger, đồng thời dọn sạch console.\* không cần thiết trong handler.ts.

**Architecture:** Dùng logixlysia plugin trong mỗi Elysia app — plugin tự động hook vào onRequest/onAfterHandle/onError lifecycle, log method, path, status, duration. packages/core không bị động đến. Business logic logs trong handler.ts bị xóa vì HTTP-level log đủ thông tin.

**Tech Stack:** logixlysia ^6.2.0, Elysia ^1.4.27, Bun test

---

## Context: Codebase hiện tại

**Packages:**

- `packages/translator` — HTTP server dịch thuật, port 3000
- `packages/webhook-logger` — nhận Chatwork webhook, forward sang translator, port 3001
- `packages/core` — shared types/services, KHÔNG đụng

**Files giữ nguyên (explicitly deferred):**

- `packages/translator/src/webhook/router.ts` — `console.error` trong fire-and-forget `.catch()`. logixlysia's pino không accessible ngoài Elysia route context mà không thêm pino làm direct dep — ngoài scope lần này.
- `packages/webhook-logger/src/routes/webhook.ts` — cùng lý do trên.
- `packages/**/src/index.ts` — startup console.log informational, one-time, đủ rõ.
- `packages/core/**` — không đụng.

**Verification command (chạy sau mỗi task):**

```bash
cd /path/to/chatwork-translation-bot
bun test && bun run typecheck && bun run lint
```

---

## Task 1: Thêm logixlysia vào translator

**Files:**

- Modify: `packages/translator/package.json`
- Modify: `packages/translator/src/app.ts`

### Step 1: Thêm logixlysia dependency vào translator

Mở `packages/translator/package.json`, thêm `logixlysia` vào dependencies:

```json
{
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@elysiajs/swagger": "^1.3.1",
    "elysia": "^1.4.27",
    "logixlysia": "^6.2.0",
    "zod": "^4.3.6"
  }
}
```

### Step 2: Install dependencies

```bash
cd packages/translator
bun install
```

Expected: logixlysia và các transitive deps (chalk, pino, pino-pretty) được install.

### Step 3: Sửa app.ts — thêm plugin, xóa onError thủ công

File hiện tại `packages/translator/src/app.ts`:

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { translateRoutes } from './webhook/router'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'translator' })

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Translator API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(translateRoutes)
    .onError(({ code, error }) => {
      console.error(
        `[app] Error [${String(code)}]:`,
        error instanceof Error ? error.message : error,
      )
    })
}
```

Thay thành:

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { translateRoutes } from './webhook/router'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'translator' })

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

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Translator API', version: '1.0.0' },
        },
      }),
    )
  }

  return app.use(healthRoutes).use(translateRoutes)
}
```

**Thay đổi chính:**

- Thêm `import logixlysia from 'logixlysia'`
- `if (env.NODE_ENV !== 'test')` guard — nhất quán với `if (env.NODE_ENV === 'development')` swagger pattern đã có
- Xóa `.onError(...)` thủ công — logixlysia đã handle

### Step 4: Chạy tests để verify

```bash
cd /path/to/chatwork-translation-bot
bun test packages/translator
```

Expected: tất cả tests pass, **không có logixlysia output** trong test runner (guard hoạt động đúng).

```bash
bun run typecheck && bun run lint
```

Expected: không có lỗi.

### Step 5: Commit

> **Lưu ý:** `bun install` update `bun.lock` ở root monorepo — phải add vào commit.

```bash
git add packages/translator/package.json packages/translator/src/app.ts bun.lock
git commit -m "feat(translator): add logixlysia HTTP request logging plugin"
```

---

## Task 2: Thêm logixlysia vào webhook-logger

**Files:**

- Modify: `packages/webhook-logger/package.json`
- Modify: `packages/webhook-logger/src/app.ts`

### Step 1: Thêm logixlysia dependency vào webhook-logger

Mở `packages/webhook-logger/package.json`, thêm `logixlysia`:

```json
{
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@elysiajs/swagger": "^1.3.1",
    "elysia": "^1.4.27",
    "logixlysia": "^6.2.0",
    "zod": "^4.3.6"
  }
}
```

### Step 2: Install dependencies

```bash
cd packages/webhook-logger
bun install
```

### Step 3: Sửa app.ts — thêm plugin, xóa onError thủ công

File hiện tại `packages/webhook-logger/src/app.ts`:

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { webhookRoutes } from './routes/webhook'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'webhook-logger' })

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Webhook Logger API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(webhookRoutes)
    .onError(({ code, error }) => {
      console.error(
        `[app] Error [${String(code)}]:`,
        error instanceof Error ? error.message : error,
      )
    })
}
```

Thay thành:

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { webhookRoutes } from './routes/webhook'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'webhook-logger' })

  // Guard: không chạy logixlysia trong test — tránh log noise trong test runner.
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

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Webhook Logger API', version: '1.0.0' },
        },
      }),
    )
  }

  return app.use(healthRoutes).use(webhookRoutes)
}
```

### Step 4: Chạy tests

```bash
bun test packages/webhook-logger
bun run typecheck && bun run lint
```

Expected: tất cả tests pass, không có logixlysia output.

### Step 5: Commit

> **Lưu ý:** `bun.lock` ở root đã được cập nhật lần 2 — add vào commit.

```bash
git add packages/webhook-logger/package.json packages/webhook-logger/src/app.ts bun.lock
git commit -m "feat(webhook-logger): add logixlysia HTTP request logging plugin"
```

---

## Task 3: Xóa console.\* trong handler.ts

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`

### Step 1: Xác định các dòng cần xóa

Mở `packages/translator/src/webhook/handler.ts`. Các dòng cần xóa:

```typescript
// Dòng 13 — xóa
console.log('[handler] Skipping non-message event:', event.webhook_event_type)

// Dòng 26 — xóa
console.log('[handler] Skipping empty message after markup strip')

// Dòng 39-43 — xóa
console.log(
  `[handler] Translated: ${result.sourceLang} → ${result.targetLang} | room:${roomId.toString()} | msg:${messageId}`,
)

// Dòng 45 — xóa
console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)

// Dòng 48 — xóa
console.error('[handler] Unexpected error:', error)
```

### Step 2: File sau khi sửa

`packages/translator/src/webhook/handler.ts` sau khi xóa console.\*:

```typescript
import {
  isChatworkMessageEvent,
  stripChatworkMarkup,
  TranslationServiceFactory,
  TranslationError,
} from '@chatwork-bot/core'
import type { ChatworkWebhookEvent } from '@chatwork-bot/core'
import { env } from '../env'
import { writeTranslationOutput } from '../utils/output-writer'

export async function handleTranslateRequest(event: ChatworkWebhookEvent): Promise<void> {
  if (!isChatworkMessageEvent(event)) {
    return
  }

  const {
    room_id: roomId,
    account_id: _accountId,
    message_id: messageId,
    body,
  } = event.webhook_event

  const cleanText = stripChatworkMarkup(body)
  if (!cleanText) {
    return
  }

  try {
    const service = TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)
    const result = await service.translate(cleanText)

    await writeTranslationOutput({
      ...event,
      translation: result,
    })
  } catch (error) {
    if (error instanceof TranslationError) {
      return
    }
    throw error
  }
}
```

**Lưu ý quan trọng:** Dòng `console.error('[handler] Unexpected error:', error)` trước đây swallow error. Sau khi xóa, unexpected errors được `throw` lại để `router.ts` catch (đã có `.catch()` ở đó).

### Step 3: Chạy full test suite

```bash
bun test
```

Expected: tất cả tests pass. Đặc biệt `handler.test.ts` vẫn pass vì tests không assert console output.

```bash
bun run typecheck && bun run lint
```

Expected: không có lỗi. Nếu có unused import warnings từ việc xóa code, fix theo gợi ý của linter.

### Step 4: Commit

```bash
git add packages/translator/src/webhook/handler.ts
git commit -m "refactor(translator): remove console.* from handler — logixlysia covers HTTP layer"
```

---

## Task 4: Final verification

### Step 1: Chạy full test suite từ root

```bash
bun test && bun run typecheck && bun run lint
```

Expected: tất cả pass.

### Step 2: Dev smoke test

Start translator service:

```bash
cd packages/translator && bun run dev
```

Gửi health check:

```bash
curl http://localhost:3000/health
```

Expected output trong terminal (có màu nếu TTY):

```
🦊 [timestamp] INFO [duration]ms GET /health 200
```

### Step 3: Production format verification

Logixlysia dùng `process.stdout.isTTY` để quyết định có output ANSI color codes hay không. Khi pipe output (non-TTY), phải là plain text — verify bằng cách pipe qua `grep`:

```bash
# Env vars tối thiểu để pass Zod validation
CHATWORK_API_TOKEN=fake AI_PROVIDER=openai OPENAI_API_KEY=fake \
  bun packages/translator/src/index.ts 2>&1 | head -5 &
SERVER_PID=$!

sleep 1
curl -s http://localhost:3000/health

# Kill background process
kill $SERVER_PID 2>/dev/null

# Verify: output không có ANSI escape sequences (ESC[...)
# Nếu có color codes, sẽ thấy ký tự ^[ trong output pipe
```

Expected: output dạng plain text, không có `\e[` hay `\u001b[` escape sequences.

### Step 4: Commit nếu chưa commit

Nếu chưa commit gì ở bước này, có thể bỏ qua. Tất cả changes đã được commit trong Task 1-3.

---

## Summary

| Task   | Files                                         | Mô tả                                         |
| ------ | --------------------------------------------- | --------------------------------------------- |
| Task 1 | translator/package.json, app.ts, bun.lock     | Thêm logixlysia dep + plugin (với test guard) |
| Task 2 | webhook-logger/package.json, app.ts, bun.lock | Thêm logixlysia dep + plugin (với test guard) |
| Task 3 | translator/src/webhook/handler.ts             | Xóa console.\*, unexpected errors throw lại   |
| Task 4 | —                                             | Final verification + production format check  |

**Tổng cộng: 5 files thay đổi + bun.lock, 3 commits**

**Key patterns trong code:**

- `if (env.NODE_ENV !== 'test')` — guard cho logixlysia, nhất quán với `if (env.NODE_ENV === 'development')` pattern cho swagger
- `throw error` thay vì `console.error` swallow — unexpected errors được propagate đến `router.ts` catch handler
