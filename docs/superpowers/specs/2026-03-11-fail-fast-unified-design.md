# Design: Fail-Fast Thống Nhất + Bug Fix Ctrl-Z

**Date**: 2026-03-11
**Status**: Approved
**Source**: PLAN.md + bug report (messages vẫn gửi sau Ctrl-Z)

---

## 1. Vấn Đề Cần Giải Quyết

### Bug: Ctrl-Z không dừng containers

**Root cause**: Ctrl-Z gửi `SIGTSTP` (suspend) tới foreground shell process (`docker compose up`), nhưng Docker containers vẫn chạy dưới Docker daemon vì:

- Containers là processes độc lập do daemon quản lý, không phải child process của terminal
- Policy `restart: unless-stopped` khiến chúng auto-restart nếu crash
- `DATASET_AUTORUN=true` đã được inject vào container env khi start → dataset-runner tiếp tục gửi messages

**Hệ quả**: Dataset-runner gửi tin nhắn đến Chatwork room ngay cả sau khi dev tưởng đã tắt.

### Gap: Không có fail-fast

- Không có `--abort-on-container-exit` → 1 container crash, 2 container còn lại tiếp tục
- Webhook-logger luôn trả 200 dù translator không reachable → lỗi bị che giấu
- Dataset-runner không exit non-zero khi gặp lỗi hard → không trigger stack shutdown

---

## 2. Quyết Định Thiết Kế

| Hạng mục              | Quyết định                                                   |
| --------------------- | ------------------------------------------------------------ |
| Fail-fast flag        | Không cần env flag — luôn fail-fast                          |
| Fail-fast scope       | Cả `dev` và `dev:dataset`                                    |
| Restart policy        | `restart: 'no'` cho tất cả containers                        |
| Stop command khi fail | `docker compose down --remove-orphans`                       |
| cursor-proxy cleanup  | Dừng theo cùng trap handler                                  |
| zrok cleanup          | Dừng theo `docker compose down`                              |
| Webhook 5xx           | Trả 5xx khi translator không reachable                       |
| Dataset hard-stop     | `exit(1)` ngay khi Chatwork retry exhausted hoặc ACK timeout |
| Log format            | Service + event + lý do + stack trace + request IDs          |
| Ctrl-C behavior       | SIGINT → trap → cleanup_local_proxy + docker compose down    |

---

## 3. Kiến Trúc Thay Đổi

### 3.1 `scripts/dev.sh`

**Thêm `trap` handler cho tất cả exit signals:**

```sh
# Gọi trước exec docker compose up
trap_cleanup() {
  echo "[dev] caught signal — shutting down stack..."
  docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
  # Dừng cursor-proxy nếu đang chạy
  if [ "$AI_PROVIDER" = "cursor" ] && is_local_host "$CURSOR_API_HOST"; then
    cleanup_local_proxy || true
  fi
  # Print red-flag summary nếu có exit code
  if [ -n "$FAIL_SERVICE" ]; then
    echo ""
    echo "============================================="
    echo " ❌ FAIL-FAST TRIGGERED"
    echo " Service  : $FAIL_SERVICE"
    echo " Reason   : $FAIL_REASON"
    echo " Time     : $(date '+%Y-%m-%d %H:%M:%S')"
    echo " Next     :"
    echo "   docker compose -f docker-compose.dev.yml logs <service>"
    echo "   bun run dev"
    echo "============================================="
  fi
}
trap trap_cleanup EXIT INT TERM
```

**Thêm `--abort-on-container-exit` vào docker compose up:**

```sh
# start_docker_only
exec docker compose -f docker-compose.dev.yml up --remove-orphans --abort-on-container-exit

# start_proxy_and_docker
exec bunx concurrently \
  --names "cursor-proxy,docker" \
  --prefix-colors "cyan,green" \
  --kill-others \         # <-- thêm: 1 process die → kill hết
  "bun run cursor-proxy" \
  "docker compose -f docker-compose.dev.yml up --remove-orphans --abort-on-container-exit"
```

**Lưu ý `exec`**: Khi dùng `exec`, shell bị replaced → trap không chạy được. Cần bỏ `exec` và wait thủ công hoặc dùng cách khác để trap hoạt động.

### 3.2 `scripts/dev-dataset.sh`

Tương tự dev.sh — inherit trap từ `sh scripts/dev.sh up` cuối script. Không cần thay đổi riêng ngoài việc dev.sh đã có trap.

### 3.3 `docker-compose.dev.yml`

**Đổi restart policy cho tất cả services:**

```yaml
# Trước
restart: unless-stopped

# Sau — bỏ hoàn toàn (default là 'no')
# hoặc explicit:
restart: 'no'
```

Áp dụng cho: `translator`, `webhook-logger`, `dataset-runner`, `zrok`.

### 3.4 `packages/webhook-logger` — Route forward

**Hiện tại**: Luôn trả `200` dù translator fail.

**Thay đổi**:

```ts
// packages/webhook-logger/src/routes/webhook.ts
const response = await fetch(translatorUrl, { ... })
  .catch((err) => {
    // translator không reachable
    return new Response(null, { status: 503 })
  })

if (!response.ok) {
  return new Response(`Translator error: ${response.status}`, { status: 502 })
}

return new Response('OK', { status: 200 })
```

**Test mới**: `webhook.test.ts` — case translator unreachable → trả 502/503.

### 3.5 `packages/dataset-runner` — Hard-stop paths

**Thêm `exit(1)` cho 2 hard-stop cases:**

```ts
// Case 1: Chatwork API retry exhausted
if (sendAttempt >= this.config.maxRetries) {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'chatwork_api_retry_exhausted',
    sendAttempt,
    sourceMessageId,
    datasetFile: meta.fileName,
    datasetItemId: meta.itemId,
    datasetLineNumber: meta.lineNumber,
  })
  process.exit(1)
}

// Case 2: ACK timeout
if (!ack) {
  this.logEvent('error', 'dataset_hard_stop', {
    reason: 'ack_timeout',
    sourceMessageId,
    datasetFile: meta.fileName,
    datasetItemId: meta.itemId,
    datasetLineNumber: meta.lineNumber,
    timeoutMs: this.config.timeoutMs,
  })
  process.exit(1)
}
```

**Test mới**: `queue-runner.test.ts` — hard-stop path với cả 2 triggers.

---

## 4. Flow Khi Fail-Fast Trigger

```
Container crash / exit(1)
      │
      ▼
docker compose --abort-on-container-exit nhận tín hiệu
      │
      ▼
docker compose down --remove-orphans  (dừng tất cả containers: translator, webhook-logger, dataset-runner, zrok)
      │
      ▼
trap_cleanup() trong dev.sh chạy
      │
      ├─ cleanup_local_proxy() nếu cursor provider (dừng cursor-proxy process)
      │
      └─ In red-flag summary block
           ❌ FAIL-FAST TRIGGERED
           Service: dataset-runner
           Reason: ack_timeout / chatwork_api_retry_exhausted / ...
           Next: docker logs dataset-runner / bun run dev
```

---

## 5. Files Thay Đổi

| File                                                        | Thay đổi                                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scripts/dev.sh`                                            | Thêm trap handler; bỏ `exec` trước docker compose up; thêm `--abort-on-container-exit`; thêm `--kill-others` cho concurrently |
| `docker-compose.dev.yml`                                    | `restart: unless-stopped` → bỏ/`no` cho tất cả services                                                                       |
| `packages/webhook-logger/src/routes/webhook.ts`             | Await fetch translator; trả 5xx khi fail                                                                                      |
| `packages/webhook-logger/src/routes/webhook.test.ts`        | Thêm test case 5xx                                                                                                            |
| `packages/dataset-runner/src/services/queue-runner.ts`      | Thêm `process.exit(1)` cho 2 hard-stop paths                                                                                  |
| `packages/dataset-runner/src/services/queue-runner.test.ts` | Thêm test case hard-stop                                                                                                      |

**Tổng: 6 files** → Cần breakdown subtasks theo GLOBAL_RULE.md.

---

## 6. Kiểm Thử

```bash
# Unit tests
bun test packages/webhook-logger
bun test packages/dataset-runner

# Type check
bun run typecheck

# Lint
bun run lint

# Manual integration
bun run dev:dataset   # Giả lập translator unreachable → verify stack dừng
Ctrl-C                 # Verify docker ps không còn container nào
```

---

## 7. Edge Cases

| Case                                 | Handling                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| cursor-proxy khi fail-fast           | `cleanup_local_proxy` trong trap                                       |
| zrok tunnel bị stale                 | docker compose down dừng container → zrok CLI tự cleanup tunnel        |
| Artifacts khi dataset-runner exit(1) | `input/state`, `input/failed`, `output` được giữ nguyên để replay      |
| Ctrl-Z từ user                       | Containers vẫn chạy (không fix hành vi Ctrl-Z) — hướng dẫn dùng Ctrl-C |
| `exec` trong dev.sh                  | Phải bỏ `exec` để trap hoạt động; thay bằng `wait $!` pattern          |

---

## 8. Không Thay Đổi

- Semantic nghiệp vụ translation core
- Chatwork API client
- Provider logic (gemini, openai, cursor)
- zrok entrypoint script
