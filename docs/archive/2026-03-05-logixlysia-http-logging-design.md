# Design: HTTP Request Logging với logixlysia

**Date**: 2026-03-05
**Status**: Approved
**Scope**: `packages/translator`, `packages/webhook-logger` — không đụng `packages/core`

---

## Problem Statement

Hiện tại cả 2 services dùng `console.log`/`console.error` thuần túy, rải rác:

```typescript
// Không có level, không có format, không có context
console.error(`[app] Error [${String(code)}]:`, error instanceof Error ? error.message : error)
console.log('[handler] Translated: ...')
```

Vấn đề:

- HTTP request/response không được log → không trace được latency, status code
- `onError` trong Elysia thiếu `path`, `method`, `durationMs`
- Không phân biệt log level (INFO vs ERROR)
- Plain text không parse được trong Docker/production

---

## Decision: logixlysia

Dùng [`logixlysia`](https://github.com/PunGrumpy/logixlysia) — Elysia-native HTTP logging plugin.

**Tại sao logixlysia thay vì custom logger:**

- Tích hợp trực tiếp Elysia lifecycle (onRequest, onAfterHandle, onError) — không cần viết lại
- Tự động tính `durationMs` qua `process.hrtime.bigint()`
- Colourized TTY output cho dev, structured output cho prod
- Zero config cần thiết, chỉ 2 dòng trong app.ts

**Tại sao không đặt logger trong core:**

- `packages/core` không có và không nên có Elysia dependency
- Business logic logging trong `handler.ts` → xóa bỏ (HTTP-layer logging đủ)
- Core giữ nguyên framework-agnostic

---

## Architecture

```
Request vào webhook-logger
  └── logixlysia plugin: log "POST /webhook 200 12ms"
       └── forward đến translator (fire-and-forget fetch)
            └── logixlysia plugin: log "POST /internal/translate 200 832ms"
```

---

## File Changes

### Thêm dependency

| Package                                | Thay đổi                      |
| -------------------------------------- | ----------------------------- |
| `packages/translator/package.json`     | Thêm `"logixlysia": "^6.2.0"` |
| `packages/webhook-logger/package.json` | Thêm `"logixlysia": "^6.2.0"` |

### Sửa app.ts (cả 2 services)

```typescript
// BEFORE: manual onError
return app
  .use(healthRoutes)
  .use(translateRoutes)
  .onError(({ code, error }) => {
    console.error(`[app] Error [${String(code)}]:`, ...)
  })

// AFTER: logixlysia handles request + response + error
import logixlysia from 'logixlysia'

export function createApp() {
  const app = new Elysia({ name: '...' })
    .use(logixlysia({
      config: {
        showStartupMessage: false,
        ip: false,
      }
    }))
  // ...rest stays the same, onError removed
}
```

### Xóa console.\* trong handler.ts

```typescript
// Xóa hoàn toàn các dòng này:
console.log('[handler] Skipping non-message event:', event.webhook_event_type)
console.log('[handler] Skipping empty message after markup strip')
console.log(`[handler] Translated: ${result.sourceLang} → ${result.targetLang} ...`)
console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)
console.error('[handler] Unexpected error:', error)
```

HTTP request log từ logixlysia đủ để biết request thành công hay thất bại.

### Test guard cho logixlysia

Logixlysia gây noise trong test output (mỗi `app.handle()` call trong test sẽ emit log). Fix bằng cách wrap trong `NODE_ENV !== 'test'` guard — nhất quán với pattern `NODE_ENV === 'development'` đã có cho swagger:

```typescript
// app.ts — pattern thực tế cần dùng
if (env.NODE_ENV !== 'test') {
  app.use(
    logixlysia({
      config: { showStartupMessage: false, ip: false },
    }),
  )
}
```

`app.test.ts` mock `env.NODE_ENV = 'test'`, nên guard này đảm bảo logixlysia không chạy trong test runner.

### Sửa app.ts (cả 2 services)

```typescript
// BEFORE: manual onError
return app
  .use(healthRoutes)
  .use(translateRoutes)
  .onError(({ code, error }) => {
    console.error(`[app] Error [${String(code)}]:`, ...)
  })

// AFTER: logixlysia handles request + response + error (với test guard)
import logixlysia from 'logixlysia'

export function createApp() {
  const app = new Elysia({ name: '...' })

  if (env.NODE_ENV !== 'test') {
    app.use(logixlysia({
      config: { showStartupMessage: false, ip: false },
    }))
  }

  // ...rest stays the same, onError removed
}
```

### Xóa console.\* trong handler.ts

```typescript
// Xóa hoàn toàn các dòng này:
console.log('[handler] Skipping non-message event:', event.webhook_event_type)
console.log('[handler] Skipping empty message after markup strip')
console.log(`[handler] Translated: ${result.sourceLang} → ${result.targetLang} ...`)
console.error(`[handler] TranslationError [${error.code}]: ${error.message}`)
console.error('[handler] Unexpected error:', error)
```

HTTP request log từ logixlysia đủ để biết request thành công hay thất bại.

### Giữ nguyên (explicitly deferred)

| File                                   | Lý do giữ                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translator/src/webhook/router.ts`     | `console.error` trong fire-and-forget `.catch()` — logixlysia's pino không accessible ngoài Elysia route context. Thay thế được nhưng ngoài scope lần này. |
| `webhook-logger/src/routes/webhook.ts` | Cùng lý do — xử lý ở task riêng nếu cần structured format cho background errors.                                                                           |
| `*/src/index.ts` (startup logs)        | Informational, one-time, không cần structured format.                                                                                                      |
| `packages/core`                        | Không đụng.                                                                                                                                                |

---

## Output Examples

**Development (TTY colorized):**

```
🦊 2026-03-05 08:30:00.000 INFO  832.50ms POST /internal/translate 200
🦊 2026-03-05 08:30:01.000 ERROR  12.00ms POST /internal/translate 500 Unhandled error
```

**Production (non-TTY, structured):**

```
🦊 2026-03-05T08:30:00.000Z INFO 832.50ms POST /internal/translate 200
```

---

## Test Impact

**Không cần sửa test nào** — logixlysia là additive plugin, không thay đổi route behavior. Các test hiện tại mock `./env` và test response status, không liên quan đến logging middleware.

`app.test.ts` mock `env.NODE_ENV = 'test'` — guard `NODE_ENV !== 'test'` trong app.ts đảm bảo logixlysia không chạy trong test runner. Test output sạch, không có log noise.

---

## Constraints

- logixlysia `^6.2.0` — peer dep: `elysia ^1.4.22` (compatible với `elysia ^1.4.27` đang dùng)
- Runtime deps thêm vào mỗi service: `chalk`, `pino`, `pino-pretty`
- `packages/core` không thay đổi

---

## Verification

```bash
bun test && bun run typecheck && bun run lint
```

**Dev smoke test:**

```bash
cd packages/translator && bun run dev
# Gửi request → thấy: 🦊 [timestamp] INFO [duration]ms POST /health 200
curl http://localhost:3000/health
```

**Production format verification** (non-TTY → no ANSI color codes):

```bash
# Pipe output removes isTTY → logixlysia outputs plain text format
CHATWORK_API_TOKEN=fake AI_PROVIDER=openai OPENAI_API_KEY=fake \
  bun packages/translator/src/index.ts 2>&1 | head -5
# Expected: plain timestamp + level + path, NO \e[ escape sequences
```
