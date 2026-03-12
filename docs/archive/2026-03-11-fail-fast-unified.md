# Fail-Fast Unified + Bug Fix Ctrl-Z Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai fail-fast thống nhất cho cả `bun run dev` và `bun run dev:dataset`, fix bug containers chạy ngầm sau Ctrl-Z, đảm bảo toàn stack dừng sạch khi bất kỳ service nào gặp lỗi hard.

**Architecture:** Shell scripts dùng trap handler thay vì `exec` để cleanup cursor-proxy + docker compose khi exit; Docker Compose chạy với `--abort-on-container-exit` và `restart: 'no'`; webhook-logger await fetch translator và trả 5xx khi không reachable; dataset-runner gọi `process.exit(1)` sau khi ghi lỗi cho 2 hard-stop path.

**Tech Stack:** sh (POSIX), Docker Compose v2, Bun, TypeScript, Elysia, bun:test

---

## Chunk 1: Infrastructure — dev.sh + docker-compose.dev.yml

### Task 1: Refactor dev.sh — bỏ `exec` cho `up`, thêm trap handler

**Files:**

- Modify: `scripts/dev.sh`

**Context quan trọng:**

Hiện tại `dev.sh` dùng `exec` để replace shell process → trap không chạy được sau `exec`. Cần chuyển `start_docker_only` và `start_proxy_and_docker` sang dùng background process + `wait`.

Pattern mới:

```sh
some_command &
CHILD_PID=$!
wait $CHILD_PID
```

Trap chạy khi shell thoát (bao gồm EXIT, INT, TERM) → chạy `docker compose down` + `cleanup_local_proxy`.

- [ ] **Step 1: Đọc dev.sh hiện tại để hiểu toàn bộ flow**

  Xem: `scripts/dev.sh`. Lưu ý:
  - `start_docker_only()` dùng `exec docker compose ...`
  - `start_proxy_and_docker()` dùng `exec bunx concurrently ...`
  - Pass-through action (else branch ở cuối) vẫn dùng `exec` — **đây là OK**, giữ nguyên

- [ ] **Step 2: Thêm biến `COMPOSE_FILE` ở đầu phần `up` logic**

  Thêm vào ngay trước `if [ "$ACTION" = "up" ]`:

  ```sh
  COMPOSE_FILE="docker-compose.dev.yml"
  ```

- [ ] **Step 3: Thêm `trap` cleanup function và đăng ký trap**

  Thêm hàm `trap_cleanup` và đăng ký TRƯỚC khi gọi docker compose up. Đặt ngay sau hàm `start_proxy_and_docker`:

  ```sh
  DEV_FAIL_SERVICE=""
  DEV_FAIL_REASON=""

  trap_cleanup() {
    echo "[dev] shutting down stack..." >&2
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    if [ "$AI_PROVIDER" = "cursor" ] && is_local_host "$CURSOR_API_HOST"; then
      cleanup_local_proxy 2>/dev/null || true
    fi
    if [ -n "$DEV_FAIL_SERVICE" ]; then
      echo "" >&2
      echo "=============================================" >&2
      echo " FAIL-FAST TRIGGERED" >&2
      echo " Service : $DEV_FAIL_SERVICE" >&2
      echo " Reason  : $DEV_FAIL_REASON" >&2
      echo " Time    : $(date '+%Y-%m-%d %H:%M:%S')" >&2
      echo " Next steps:" >&2
      echo "   docker compose -f $COMPOSE_FILE logs $DEV_FAIL_SERVICE" >&2
      echo "   bun run dev" >&2
      echo "=============================================" >&2
    fi
  }
  ```

  Đăng ký trap (đặt sau dòng `ACTION="${1:-up}"`):

  ```sh
  trap trap_cleanup EXIT INT TERM
  ```

- [ ] **Step 4: Refactor `start_docker_only` — bỏ `exec`, thêm `--abort-on-container-exit`**

  Thay thế hàm `start_docker_only`:

  ```sh
  start_docker_only() {
    docker compose -f "$COMPOSE_FILE" up --remove-orphans --abort-on-container-exit
  }
  ```

  Lưu ý: bỏ `exec` — shell process không bị replace nên trap vẫn chạy khi docker compose kết thúc.

- [ ] **Step 5: Refactor `start_proxy_and_docker` — bỏ `exec`, thêm `--kill-others`**

  Thay thế hàm `start_proxy_and_docker`:

  ```sh
  start_proxy_and_docker() {
    bunx concurrently \
      --names "cursor-proxy,docker" \
      --prefix-colors "cyan,green" \
      --kill-others \
      "bun run cursor-proxy" \
      "docker compose -f $COMPOSE_FILE up --remove-orphans --abort-on-container-exit"
  }
  ```

  Lưu ý: `--kill-others` trong `concurrently` đảm bảo nếu docker process die thì cursor-proxy cũng bị kill và ngược lại.

- [ ] **Step 6: Verify file kết quả trông hợp lý**

  Kiểm tra:
  - `trap trap_cleanup EXIT INT TERM` có mặt
  - `start_docker_only` không còn `exec`
  - `start_proxy_and_docker` không còn `exec`
  - Pass-through `exec docker compose -f docker-compose.dev.yml "$@"` ở else branch vẫn còn `exec` — đúng vì đây không phải `up`
  - `down` action: `exec docker compose -f docker-compose.dev.yml down --remove-orphans` vẫn dùng `exec` — OK vì trap đã cleanup trước

- [ ] **Step 7: Commit**

  ```bash
  git add scripts/dev.sh
  git commit -m "fix(dev): replace exec with background+wait for trap-compatible shutdown"
  ```

---

### Task 2: Sửa `docker-compose.dev.yml` — bỏ restart policy

**Files:**

- Modify: `docker-compose.dev.yml`

**Context:**

Policy `restart: unless-stopped` mask lỗi: container crash → tự restart thay vì để docker compose nhận exit code và trigger `--abort-on-container-exit`. Cần bỏ restart để 1 container die = toàn stack nhận tín hiệu.

- [ ] **Step 1: Xóa `restart: unless-stopped` khỏi `translator` service**

  Xóa dòng:

  ```yaml
  restart: unless-stopped
  ```

  trong section `translator:`.

- [ ] **Step 2: Xóa `restart: unless-stopped` khỏi `webhook-logger` service**

  Tương tự cho section `webhook-logger:`.

- [ ] **Step 3: Xóa `restart: unless-stopped` khỏi `dataset-runner` service**

  Tương tự cho section `dataset-runner:`.

- [ ] **Step 4: Xóa `restart: on-failure` khỏi `zrok` service (nếu có) hoặc giữ nguyên**

  Xem `zrok` service — hiện có `restart: on-failure`. Đổi thành `restart: 'no'` explicit:

  ```yaml
  restart: 'no'
  ```

  Lý do: zrok cũng cần dừng khi stack fail-fast, không muốn nó tự restart mask lỗi.

- [ ] **Step 5: Manual smoke test**

  ```bash
  # Kiểm tra docker-compose.dev.yml hợp lệ
  docker compose -f docker-compose.dev.yml config --quiet
  ```

  Expected: no error output.

- [ ] **Step 6: Commit**

  ```bash
  git add docker-compose.dev.yml
  git commit -m "fix(docker): remove restart policies for fail-fast support"
  ```

---

### Task 3: Verify Chunk 1

- [ ] **Step 1: Test Ctrl-C dừng sạch**

  ```bash
  bun run dev  # hoặc bun run dev:dataset
  # Đợi services healthy
  # Nhấn Ctrl-C
  ```

  Expected:
  - In `[dev] shutting down stack...`
  - Docker containers dừng (verify: `docker ps` → không còn chatwork-\* containers)
  - Không còn cursor-proxy trên port 8765 (nếu dùng cursor provider)

- [ ] **Step 2: Verify không còn containers sau khi thoát**

  ```bash
  docker ps --filter "name=chatwork" --format "table {{.Names}}\t{{.Status}}"
  ```

  Expected: empty (no running containers).

---

## Chunk 2: webhook-logger — Trả 5xx khi translator không reachable

### Task 4: Refactor `createForwardPayload` → async route handlers

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`

**Context:**

Hiện tại `createForwardPayload` là sync, dùng `void fetch(...)` fire-and-forget, luôn return `{ status: 200 }`. Cần:

1. Xóa `createForwardPayload` function (hoặc tách phần normalize ra riêng)
2. Route handlers trở thành `async`
3. `await fetch(...)` translator
4. Trả `502` nếu translator trả non-2xx
5. Trả `503` nếu network error (translator không reachable)

- [ ] **Step 1: Viết failing test trước**

  Thêm vào `packages/webhook-logger/src/routes/webhook.test.ts`, sau test cuối cùng:

  ```ts
  it('POST /webhook returns 503 when translator is not reachable (network error)', async () => {
    mockFetch.mockClear()
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('fetch failed')))

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )

    expect(res.status).toBe(503)
  })

  it('POST /webhook returns 502 when translator returns non-2xx', async () => {
    mockFetch.mockClear()
    mockFetch.mockImplementationOnce(() => Promise.resolve(new Response('error', { status: 500 })))

    const res = await app.handle(
      new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validEvent),
      }),
    )

    expect(res.status).toBe(502)
  })
  ```

- [ ] **Step 2: Run test để confirm nó fail**

  ```bash
  cd packages/webhook-logger && bun test src/routes/webhook.test.ts 2>&1 | tail -20
  ```

  Expected: test mới fail với `expected 503, received 200` và `expected 502, received 200`.

- [ ] **Step 3: Refactor `webhook.ts` — tách normalize, làm route async**

  Thay thế toàn bộ hàm `createForwardPayload` và route handlers bằng:

  ```ts
  export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
    .post('/webhook', ({ body }) => handleWebhook(body))
    .post('/', ({ body }) => handleWebhook(body))

  async function handleWebhook(body: unknown): Promise<Response> {
    const normalized = normalizeWebhookPayload(body)
    if (!normalized.ok) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'webhook_payload_invalid',
          timestamp: new Date().toISOString(),
          errorCode: 'WEBHOOK_PAYLOAD_INVALID',
          errorMessage: normalized.event.join('; '),
        }),
      )
      return new Response('Invalid webhook payload', { status: 422 })
    }

    const event = normalized.event
    const sourceMessageId = event.webhook_event.message_id
    const roomId = event.webhook_event.room_id

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'webhook-logger',
        event: 'webhook_received',
        timestamp: new Date().toISOString(),
        ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
      }),
    )

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'webhook-logger',
        event: 'translation_forward_started',
        timestamp: new Date().toISOString(),
        ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
      }),
    )

    let response: Response
    try {
      response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      })
    } catch (err: unknown) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'translation_forward_failed',
          timestamp: new Date().toISOString(),
          ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
          ...(roomId !== undefined ? { roomId } : {}),
          errorCode: err instanceof Error ? err.name : 'UnknownError',
          errorMessage: err instanceof Error ? err.message : String(err),
        }),
      )
      return new Response('Translator unavailable', { status: 503 })
    }

    if (!response.ok) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'translation_forward_failed',
          timestamp: new Date().toISOString(),
          ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
          ...(roomId !== undefined ? { roomId } : {}),
          errorCode: 'TRANSLATOR_HTTP',
          errorMessage: `Translator responded with ${String(response.status)}`,
          translatorStatus: response.status,
        }),
      )
      return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
    }

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'webhook-logger',
        event: 'translation_forward_completed',
        timestamp: new Date().toISOString(),
        ...(sourceMessageId !== undefined ? { sourceMessageId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
        translatorStatus: response.status,
      }),
    )

    return new Response('OK', { status: 200 })
  }
  ```

  **Lưu ý:** Xóa hàm `createForwardPayload` cũ hoàn toàn.

- [ ] **Step 4: Sửa test cũ `translation_forward_completed`**

  Test hiện tại `'POST /webhook forwards event to translator (fire-and-forget)'` dùng `await new Promise(resolve => setTimeout(resolve, 10))` để đợi fire-and-forget. Sau khi refactor thành async, test vẫn pass vì route await fetch và log `translation_forward_completed` trước khi return. Không cần sửa test này.

  Tuy nhiên, tên test "fire-and-forget" không còn đúng — đổi tên:

  ```ts
  it('POST /webhook forwards event to translator and logs completion', async () => {
  ```

- [ ] **Step 5: Run tests**

  ```bash
  cd /path/to/project && bun test packages/webhook-logger 2>&1
  ```

  Expected: tất cả pass, bao gồm 2 test mới (503, 502).

- [ ] **Step 6: Typecheck + lint**

  ```bash
  bun run typecheck && bun run lint
  ```

  Expected: 0 errors, 0 warnings mới.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/webhook-logger/src/routes/webhook.ts \
          packages/webhook-logger/src/routes/webhook.test.ts
  git commit -m "feat(webhook-logger): return 5xx when translator is not reachable"
  ```

---

## Chunk 3: dataset-runner — Hard-stop paths

### Task 5: Thêm `process.exit(1)` cho 2 hard-stop cases

**Files:**

- Modify: `packages/dataset-runner/src/services/queue-runner.ts`
- Modify: `packages/dataset-runner/src/services/queue-runner.test.ts`

**Context:**

Có 2 hard-stop paths trong `run()`:

1. **Retry exhaustion** (line ~315): `markRecordFailed` với `errorCode: 'CHATWORK_API'` → cần `process.exit(1)` sau khi ghi lỗi
2. **ACK timeout** (line ~363): `markRecordFailed` với `errorCode: 'CALLBACK_TIMEOUT'` → cần `process.exit(1)` sau khi ghi lỗi

Trước khi exit, cần log một `dataset_hard_stop` event với đủ context để debug.

**Tại sao không dùng throw?** `process.exit(1)` đảm bảo exit ngay lập tức với non-zero code → Docker daemon nhận tín hiệu → `--abort-on-container-exit` trigger → toàn stack dừng. `throw` có thể bị catch ở `runPromise.catch()` trong index.ts.

**Lưu ý:** Cần flush log trước khi exit vì Bun có thể buffer stdout. Dùng `console.error` (stderr không buffer) thay vì `console.log` cho hard-stop log.

- [ ] **Step 1: Viết failing tests**

  Thêm vào `packages/dataset-runner/src/services/queue-runner.test.ts`:

  ```ts
  import { mock, spyOn } from 'bun:test'
  import * as itemProcessor from './item-processor'

  describe('QueueRunner hard-stop paths', () => {
    it('calls process.exit(1) after Chatwork API retry exhaustion', async () => {
      const inputDir = join(baseDir, 'hard-stop-chatwork')
      // Create a minimal pending file
      await mkdir(join(inputDir, 'pending'), { recursive: true })
      await Bun.write(
        join(inputDir, 'pending', 'test.jsonl'),
        JSON.stringify({ id: 'item-1', original_room_id: 123, body: '/translate ja hello' }) + '\n',
      )

      // Mock processDatasetItem to always return error
      const processSpy = spyOn(itemProcessor, 'processDatasetItem').mockResolvedValue({
        status: 'error',
        errorCode: 'SEND_FAILED',
        errorMessage: 'network error',
      })

      const exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never)

      const runner = new QueueRunner({
        autorun: true,
        inputDir,
        outputBaseDir: join(baseDir, 'hard-stop-output'),
        defaultOriginalRoomId: 123,
        apiToken: 'test-token',
        cooldownMs: 0,
        maxRetries: 2,
        timeoutMs: 500,
        resetMode: 'resume',
        clearFailed: false,
        clearOutput: false,
      })

      await Promise.race([runner.run(), Bun.sleep(2000)])

      expect(exitSpy).toHaveBeenCalledWith(1)
      processSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('calls process.exit(1) after ACK timeout', async () => {
      const inputDir = join(baseDir, 'hard-stop-ack')
      await mkdir(join(inputDir, 'pending'), { recursive: true })
      await Bun.write(
        join(inputDir, 'pending', 'test.jsonl'),
        JSON.stringify({ id: 'item-1', original_room_id: 123, body: '/translate ja hello' }) + '\n',
      )

      // Mock processDatasetItem to succeed (returns sourceMessageId)
      const processSpy = spyOn(itemProcessor, 'processDatasetItem').mockResolvedValue({
        status: 'sent',
        sourceMessageId: 'msg-001',
      })

      const exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never)

      const runner = new QueueRunner({
        autorun: true,
        inputDir,
        outputBaseDir: join(baseDir, 'hard-stop-output'),
        defaultOriginalRoomId: 123,
        apiToken: 'test-token',
        cooldownMs: 0,
        maxRetries: 1,
        timeoutMs: 100, // very short timeout
        resetMode: 'resume',
        clearFailed: false,
        clearOutput: false,
      })

      // Don't send ACK → will timeout
      await Promise.race([runner.run(), Bun.sleep(2000)])

      expect(exitSpy).toHaveBeenCalledWith(1)
      processSpy.mockRestore()
      exitSpy.mockRestore()
    })
  })
  ```

- [ ] **Step 2: Run tests để confirm fail**

  ```bash
  bun test packages/dataset-runner/src/services/queue-runner.test.ts 2>&1 | tail -20
  ```

  Expected: 2 test mới fail (process.exit không được gọi).

- [ ] **Step 3: Sửa `queue-runner.ts` — thêm hard-stop sau retry exhaustion**

  Tìm đoạn code (khoảng line 315):

  ```ts
  if (!sourceMessageId) {
    workingState = await this.markRecordFailed(file.fileName, workingState, record, {
      errorCode: 'CHATWORK_API',
      errorMessage: 'Source-room send failed after retry exhaustion',
    })
    state = workingState
    continue
  }
  ```

  Thay thành:

  ```ts
  if (!sourceMessageId) {
    this.logEvent('error', 'dataset_hard_stop', {
      reason: 'chatwork_api_retry_exhausted',
      datasetFile: file.fileName,
      datasetItemId: record.item.id,
      datasetLineNumber: record.lineNumber,
      maxRetries: this.config.maxRetries,
    })
    workingState = await this.markRecordFailed(file.fileName, workingState, record, {
      errorCode: 'CHATWORK_API',
      errorMessage: 'Source-room send failed after retry exhaustion',
    })
    process.exit(1)
  }
  ```

  Lưu ý: xóa `state = workingState` và `continue` vì `process.exit(1)` terminate ngay.

- [ ] **Step 4: Sửa `queue-runner.ts` — thêm hard-stop sau ACK timeout**

  Tìm đoạn code (khoảng line 355):

  ```ts
  if (!ack) {
    this.logEvent('warn', 'dataset_ack_timeout', {
      ...
    })
    workingState = await this.markRecordFailed(file.fileName, workingState, record, {
      errorCode: 'CALLBACK_TIMEOUT',
      errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
    })
    await clearDeliveryAck(this.config.inputDir, sourceMessageId)
    state = workingState
    continue
  }
  ```

  Thay thành:

  ```ts
  if (!ack) {
    this.logEvent('error', 'dataset_hard_stop', {
      reason: 'ack_timeout',
      sourceMessageId,
      datasetFile: file.fileName,
      datasetItemId: record.item.id,
      datasetLineNumber: record.lineNumber,
      timeoutMs: this.config.timeoutMs,
    })
    workingState = await this.markRecordFailed(file.fileName, workingState, record, {
      errorCode: 'CALLBACK_TIMEOUT',
      errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
    })
    await clearDeliveryAck(this.config.inputDir, sourceMessageId)
    process.exit(1)
  }
  ```

  Lưu ý: giữ `clearDeliveryAck` trước `process.exit` để cleanup state.

- [ ] **Step 5: Run tests**

  ```bash
  bun test packages/dataset-runner 2>&1
  ```

  Expected: tất cả tests pass, bao gồm 2 test mới.

- [ ] **Step 6: Typecheck + lint**

  ```bash
  bun run typecheck && bun run lint
  ```

  Expected: 0 errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/dataset-runner/src/services/queue-runner.ts \
          packages/dataset-runner/src/services/queue-runner.test.ts
  git commit -m "feat(dataset-runner): exit(1) on hard-stop paths for fail-fast support"
  ```

---

## Chunk 4: Final Verification

### Task 6: Full test suite + integration check

- [ ] **Step 1: Run full test suite**

  ```bash
  bun test 2>&1
  ```

  Expected: all tests pass, no new failures.

- [ ] **Step 2: Typecheck toàn bộ project**

  ```bash
  bun run typecheck 2>&1
  ```

  Expected: 0 errors.

- [ ] **Step 3: Lint toàn bộ project**

  ```bash
  bun run lint 2>&1
  ```

  Expected: 0 errors mới (chỉ pre-existing nếu có).

- [ ] **Step 4: Kiểm tra docker-compose.yml hợp lệ**

  ```bash
  docker compose -f docker-compose.dev.yml config --quiet
  ```

  Expected: no errors.

- [ ] **Step 5: Test manual — Ctrl-C dừng sạch**

  ```bash
  bun run dev
  # Đợi healthy, gửi 1 webhook test, nhấn Ctrl-C
  docker ps --filter "name=chatwork"
  ```

  Expected: 0 containers running sau Ctrl-C.

---

## Edge Cases & Gotchas

| Tình huống                                    | Xử lý                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `exec` ở else branch của dev.sh               | Giữ nguyên — pass-through cho `logs`, `ps`, etc.                             |
| `exec docker compose down` ở down action      | Giữ — `down` action không cần trap vì nó tự cleanup                          |
| zrok cleanup                                  | `docker compose down --remove-orphans` cover zrok container                  |
| `process.exit(1)` trong test                  | Dùng `spyOn(process, 'exit').mockImplementation(...)` để prevent actual exit |
| `--abort-on-container-exit` + `restart: 'no'` | Hai layer: policy ngăn restart, flag trigger shutdown                        |
| concurrently kill-others                      | Nếu cursor-proxy die → docker cũng die → trap cleanup chạy                   |

## Files Changed Summary

| File                                                        | Thay đổi                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `scripts/dev.sh`                                            | Trap handler; bỏ exec cho up; `--abort-on-container-exit`; `--kill-others` |
| `docker-compose.dev.yml`                                    | Xóa `restart: unless-stopped` cho tất cả services                          |
| `packages/webhook-logger/src/routes/webhook.ts`             | Async handler; await fetch; 502/503 khi translator fail                    |
| `packages/webhook-logger/src/routes/webhook.test.ts`        | 2 test case mới: 503 (network error), 502 (non-2xx)                        |
| `packages/dataset-runner/src/services/queue-runner.ts`      | `process.exit(1)` cho 2 hard-stop paths                                    |
| `packages/dataset-runner/src/services/queue-runner.test.ts` | 2 test case mới: hard-stop paths                                           |
