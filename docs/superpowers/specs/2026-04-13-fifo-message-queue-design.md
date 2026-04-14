---
Version: 1.0
Date: 2026-04-13
Prepared by: Claude Sonnet 4.6 (AI-assisted), reviewed by user
Status: APPROVED — Ready for implementation planning
---

# Design Spec: FIFO Message Queue for Chatwork Translation Bot

## 1. Objective

Giải quyết vấn đề 5/6 messages bị mất khi user gửi burst messages vào free room. Root cause: `KagiBrowserService` internal queue timeout 15s quá ngắn so với thời gian translation (~70s browser automation), không có buffer ở tầng translator.

**Success Criteria**: Gửi 6 messages liên tiếp vào free room trong 20s → tất cả 6 bản dịch xuất hiện đúng thứ tự trong destination room (từ 1/6 → 6/6).

---

## 2. Scope

### In-Scope

- Package mới `@chatwork-bot/message-queue` với 3 components: `TranslationQueue`, `RoomQueue`, `QueuePersistence`
- Thay thế `Promise.allSettled` fire-and-forget trong `translator/src/webhook/router.ts` bằng `queue.enqueue()`
- App bootstrap integration trong `translator/src/index.ts`
- 4 env variables mới trong `translator/src/env-schema.ts`
- `docker-compose.yml` update: env vars + `stop_grace_period: 35s`
- Kagi sidecar: đổi `KAGI_MAX_QUEUE_WAIT_MS` default `15000 → 120000`
- `/status` endpoint extension: thêm `queue` field vào `TranslatorStatusSnapshot`
- Unit tests cho tất cả 3 components (real file I/O, tmp directories)

### Non-Goals (Out-of-Scope)

- External message broker (Redis, BullMQ, RabbitMQ) — không thêm external infra
- Message replay sau process crash — Chatwork webhook không retry, accepted
- Distributed/multi-process queue — single-process only
- User-facing error notification khi queue full — silent drop + log
- Retry ở queue level — handler's built-in exponential backoff là đủ
- Per-room concurrency reconfiguration without restart
- Message deduplication

---

## 3. Architecture

### Pattern: Per-Room In-Process FIFO Queue + File Persistence

Queue nằm **trong process** của translator service, **trước** dispatch. Mỗi `sourceRoomId` có một `RoomQueue` riêng (SQS Message Group pattern). Queue là transparent với handlers — chúng không biết về queue.

```
Webhook Logger → Router → TranslationQueue.enqueue()
                                    ↓ (async consumer, per room)
                          RoomQueue → processor(command, opts)
                                              ↓
                          Promise.allSettled([handleTranslate, handleFreeTranslate])
```

**Key Trade-off đã chọn:**

- In-process vs external: chọn in-process vì blast radius nhỏ nhất, không thêm infra, consistent với project constraint "no database"
- File persistence vs in-memory only: chọn file để có audit trail, consistent với `FreeRoomConfigStore.writeAtomic()` pattern

---

## 4. Data Model

### QueueItem (persisted to disk)

```typescript
interface QueueItem {
  id: string // UUID, unique per item
  sourceRoomId: number // Room ID (= tên thư mục cha)
  sourceMessageId: string // Message ID gốc từ Chatwork
  traceId: string // Trace ID cho observability
  command: TranslationIngressCommand // Full command payload (từ @chatwork-bot/core)
  enqueuedAt: string // ISO 8601 timestamp
}
```

### File Naming Convention

```
{enqueuedAt-epoch-ms}-{sourceMessageId}.json
```

- VD: `1744567864305-2095550881998311424.json`
- Sắp xếp directory listing alphabetically = FIFO ordering (epoch prefix)
- Unique vì `sourceMessageId` là Chatwork sequential ID — không bao giờ collision

### Disk Layout

```
data/
├── room-configs.json               (existing)
├── free-room-configs.json          (existing)
└── queue/
    ├── pending/
    │   ├── 424846369/              (sourceRoomId)
    │   │   ├── 1744567864305-msg001.json
    │   │   └── 1744567866410-msg002.json
    │   └── 433504432/
    │       └── 1744567865100-msg003.json
    └── archived/
        └── 2026-04-13T14:51:04/   (ISO timestamp on startup archive)
            └── 424846369/
                └── 1744567864305-msg001.json
```

---

## 5. API Contract

### Package Export (src/index.ts)

```typescript
export { TranslationQueue } from './translation-queue'
export type { EnqueueResult, QueueHealthSnapshot, QueueRoomSnapshot } from './types'
```

### EnqueueResult

```typescript
type EnqueueResult = { accepted: true } | { accepted: false; reason: 'QUEUE_FULL' | 'WRITE_ERROR' }
```

- `enqueue()` **không bao giờ throw** — luôn trả về result object
- `QUEUE_FULL`: depth (pending + active) đã đạt `maxDepth`
- `WRITE_ERROR`: file system write fail

### Processor Callback

```typescript
type Processor = (command: TranslationIngressCommand, opts: { traceId: string }) => Promise<void>
```

Translator inject single callback chứa cả dual-dispatch logic:

```typescript
const processor: Processor = async (command, opts) => {
  await Promise.allSettled([
    handleTranslateRequest(command, opts),
    handleFreeTranslateRequest(command, opts),
  ])
}
```

### ResolveConcurrency Callback

```typescript
type ResolveConcurrency = (roomId: number) => number
```

Called **một lần** khi `RoomQueue` được khởi tạo (lazy creation). Translator inject:

```typescript
const resolveConcurrency: ResolveConcurrency = (roomId) => {
  if (freeStore.getByOriginalRoomId(roomId)) return env.QUEUE_FREE_CONCURRENCY
  if (store.getByOriginalRoomId(roomId)) return env.QUEUE_STANDARD_CONCURRENCY
  return env.QUEUE_STANDARD_CONCURRENCY // default
}
```

### QueueHealthSnapshot

```typescript
interface QueueHealthSnapshot {
  totalPending: number
  totalActive: number
  rooms: QueueRoomSnapshot[]
}

interface QueueRoomSnapshot {
  roomId: number
  pending: number
  active: number
}
```

---

## 6. Component Design

### 6.1 TranslationQueue (Facade)

**File**: `src/translation-queue.ts`

**Trách nhiệm**: Entry point public. Quản lý `Map<number, RoomQueue>`. Lifecycle management.

```typescript
interface TranslationQueueOptions {
  dataDir: string // base dir, default './data/queue'
  maxDepth: number // default 10
  processor: Processor
  resolveConcurrency: ResolveConcurrency
}

class TranslationQueue {
  enqueue(
    roomId: number,
    command: TranslationIngressCommand,
    traceId: string,
  ): Promise<EnqueueResult>
  startup(): Promise<void> // archive pending files from last session
  shutdown(): Promise<void> // graceful drain (30s timeout)
  getSnapshot(): QueueHealthSnapshot
}
```

**Shutdown algorithm:**

```
1. this.accepting = false (stop new enqueues)
2. Poll every 100ms: check getTotalActiveCount() === 0
3. Timeout: 30,000ms
4. Return (Docker kills process after 35s total)
```

**Startup algorithm:**

```
1. QueuePersistence.archiveAll() — move pending/ → archived/{timestamp}/
2. In-memory state starts empty
3. Return (ready for new messages)
```

### 6.2 RoomQueue (FIFO + Concurrency Semaphore)

**File**: `src/room-queue.ts`

**Trách nhiệm**: FIFO queue cho 1 room. Concurrency semaphore. Consumer loop.

```typescript
class RoomQueue {
  private items: QueueItem[] // in-memory ordered list
  private activeCount: number // in-flight count
  private depth: number // pending + active (in-memory counter)
  private running: boolean // consumer loop flag
  private readonly concurrency: number
  private readonly maxDepth: number
  private readonly roomId: number

  enqueue(item: QueueItem): Promise<EnqueueResult>
  size(): number // pending count (items.length)
  isProcessing(): boolean // activeCount > 0
  getSnapshot(): QueueRoomSnapshot
}
```

**Critical: Race-free depth counting**

```typescript
// SYNCHRONOUS block — no interleave possible in JS single-threaded
if (this.depth >= this.maxDepth) {
  return { accepted: false, reason: 'QUEUE_FULL' }
}
this.depth++
this.items.push(item) // in-memory first

// ASYNC — if fails, rollback
try {
  await persistence.writeItem(this.roomId, item)
} catch {
  this.depth--
  this.items.pop()
  return { accepted: false, reason: 'WRITE_ERROR' }
}

this.startConsumerIfNeeded()
return { accepted: true }
```

**Consumer loop:**

```typescript
private async runConsumer(): Promise<void> {
  this.running = true

  while (this.items.length > 0) {
    // Take items up to concurrency slots
    const available = this.concurrency - this.activeCount
    const batch = this.items.splice(0, available)
    this.activeCount += batch.length

    await Promise.allSettled(
      batch.map(item =>
        this.processor(item.command, { traceId: item.traceId })
          .catch(err => log error)
          .finally(async () => {
            this.activeCount--
            this.depth--
            await persistence.removeItem(this.roomId, item.id)
          })
      )
    )
    // Loop continues — picks up items added during processing
  }

  this.running = false
}

private startConsumerIfNeeded(): void {
  if (!this.running) void this.runConsumer()
}
```

**Invariant**: `this.running = false` và check `items.length > 0` đều trong synchronous context sau `await` — no interleave between them.

### 6.3 QueuePersistence (File I/O Layer)

**File**: `src/queue-persistence.ts`

**Trách nhiệm**: Atomic file I/O. Directory management. Archive on startup.

```typescript
class QueuePersistence {
  writeItem(roomId: number, item: QueueItem): Promise<void>
  // atomic: write to {id}.tmp → rename to {filename}.json

  readPendingItems(roomId: number): Promise<QueueItem[]>
  // readdir + sort alphabetically (FIFO) + parse JSON

  removeItem(roomId: number, itemId: string): Promise<void>
  // delete file matching itemId

  archiveAll(): Promise<void>
  // move data/queue/pending/ → data/queue/archived/{ISO timestamp}/
  // no-op if pending/ does not exist

  listRoomDirs(): Promise<number[]>
  // return list of roomId dirs under pending/
}
```

**Atomic write pattern** (consistent với `FreeRoomConfigStore`):

```
1. Ghi vào {itemId}.tmp
2. rename({itemId}.tmp → {filename}.json)  ← atomic on same filesystem
```

---

## 7. Integration Points

### 7.1 Router (1-line change)

**File**: `packages/translator/src/webhook/router.ts`

**Before:**

```typescript
void Promise.allSettled([
  handleTranslateRequest(body.command, { traceId }).catch(...),
  handleFreeTranslateRequest(body.command, { traceId }).catch(...),
])
return 'OK'
```

**After:**

```typescript
const result = await queue.enqueue(body.command.sourceRoomId, body.command, traceId)
if (!result.accepted) {
  console.error(
    JSON.stringify({
      level: 'error',
      service: 'translator',
      event: 'queue_item_rejected',
      timestamp: new Date().toISOString(),
      traceId,
      sourceRoomId: body.command.sourceRoomId,
      reason: result.reason,
    }),
  )
}
return 'OK'
```

Router vẫn return `'OK'` ngay lập tức kể cả khi reject — webhook logger không cần biết.

### 7.2 App Bootstrap

**File**: `packages/translator/src/index.ts`

```typescript
// After store/freeStore init:
const queue = new TranslationQueue({
  dataDir: join(env.ROOM_CONFIG_DATA_DIR, 'queue'),
  maxDepth: env.QUEUE_MAX_DEPTH_PER_ROOM,
  processor: async (command, opts) => {
    await Promise.allSettled([
      handleTranslateRequest(command, opts),
      handleFreeTranslateRequest(command, opts),
    ])
  },
  resolveConcurrency: (roomId) => {
    if (freeStore.getByOriginalRoomId(roomId)) return env.QUEUE_FREE_CONCURRENCY
    if (store.getByOriginalRoomId(roomId)) return env.QUEUE_STANDARD_CONCURRENCY
    return env.QUEUE_STANDARD_CONCURRENCY
  },
})
await queue.startup()

// Inject queue into router
initTranslateRoutes({ queue }) // or pass via server factory

// Shutdown (before asyncLogger):
async function shutdown() {
  await queue.shutdown() // ← NEW: drain first
  await asyncLogger.shutdown()
  const { httpAgent } = await import('@chatwork-bot/chatwork')
  await httpAgent?.close()
  void server.stop()
  process.exit(0)
}
```

### 7.3 Env Schema

**File**: `packages/translator/src/env-schema.ts`

```typescript
// Queue configuration
QUEUE_MAX_DEPTH_PER_ROOM:    z.coerce.number().int().positive().default(10),
QUEUE_STANDARD_CONCURRENCY:  z.coerce.number().int().positive().default(3),
QUEUE_FREE_CONCURRENCY:      z.coerce.number().int().positive().default(1),
```

> **Note**: Queue data dir được derive tự động từ `ROOM_CONFIG_DATA_DIR + '/queue'` trong bootstrap — không cần env var riêng (consistent với data directory pattern hiện tại, DEC-008).

### 7.4 Docker Compose

**File**: `docker-compose.yml`

```yaml
translator:
  stop_grace_period: 35s # ← NEW (was default 10s)
  environment:
    QUEUE_MAX_DEPTH_PER_ROOM: ${QUEUE_MAX_DEPTH_PER_ROOM:-10}
    QUEUE_STANDARD_CONCURRENCY: ${QUEUE_STANDARD_CONCURRENCY:-3}
    QUEUE_FREE_CONCURRENCY: ${QUEUE_FREE_CONCURRENCY:-1}

kagi-sidecar:
  environment:
    KAGI_MAX_QUEUE_WAIT_MS: ${KAGI_MAX_QUEUE_WAIT_MS:-120000} # ← was 15000
```

### 7.5 Status Endpoint

**File**: `packages/translator/src/types/observability.ts`

```typescript
interface TranslatorStatusSnapshot {
  status: 'ok'
  updatedAt: string
  activeRequests: ActiveTranslatorRequest[]
  recentResults: TranslatorRecentResult[]
  queue?: QueueHealthSnapshot // ← NEW (optional for backward compat)
}
```

`createServer()` hoặc bootstrap inject `queue.getSnapshot` vào status handler.

### 7.6 tsconfig Updates

**Translator** `packages/translator/tsconfig.json` — thêm message-queue vào paths:

```json
"~/*": [
  "packages/translator/src/*",
  "packages/core/src/*",
  "packages/chatwork/src/*",
  "packages/translation-prompt/src/*",
  "packages/message-queue/src/*"   // ← NEW
]
```

**New package** `packages/message-queue/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/message-queue/src/*", "packages/core/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 8. New Package Structure

```
packages/message-queue/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  (exports)
    ├── translation-queue.ts      (TranslationQueue facade)
    ├── room-queue.ts             (RoomQueue + consumer loop)
    ├── queue-persistence.ts      (QueuePersistence file I/O)
    ├── types.ts                  (QueueItem, EnqueueResult, QueueHealthSnapshot, callbacks)
    ├── translation-queue.test.ts
    ├── room-queue.test.ts
    └── queue-persistence.test.ts
```

**package.json:**

```json
{
  "name": "@chatwork-bot/message-queue",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*"
  }
}
```

---

## 9. Observability (Log Events)

Tất cả logs dùng structured JSON, consistent với format hiện tại (`level`, `service`, `event`, `timestamp`, `traceId`).

| Event                       | Level | Khi nào                                           |
| --------------------------- | ----- | ------------------------------------------------- |
| `queue_item_enqueued`       | info  | Enqueue thành công                                |
| `queue_item_rejected`       | warn  | Queue full hoặc write error                       |
| `queue_consumer_started`    | debug | Consumer loop khởi động cho room                  |
| `queue_item_processing`     | debug | Bắt đầu xử lý 1 item                              |
| `queue_item_processed`      | info  | Item xử lý xong (kèm `durationMs`)                |
| `queue_item_failed`         | error | Processor throw (kèm `errorCode`, `errorMessage`) |
| `queue_consumer_stopped`    | debug | Consumer loop ngừng (queue rỗng)                  |
| `queue_archived_on_startup` | info  | Archived N messages từ session trước              |

Fields bắt buộc: `level`, `service: 'translator'`, `event`, `timestamp`, `traceId`, `sourceRoomId`.
Fields tùy chọn: `itemId`, `durationMs`, `queueDepth`, `reason`.

---

## 10. Testing Strategy

**Approach**: Unit tests + real file I/O với tmp directories (consistent với `free-room-config-store.test.ts` pattern).

### queue-persistence.test.ts

- `writeItem()` → file tồn tại với đúng content
- `writeItem()` → atomic: tmp file không tồn tại sau khi ghi
- `readPendingItems()` → trả về items đúng thứ tự FIFO
- `removeItem()` → file bị xóa
- `archiveAll()` → pending/ moved to archived/{timestamp}/
- `archiveAll()` → no-op khi pending/ không tồn tại

### room-queue.test.ts

- `enqueue()` → accepted khi dưới maxDepth
- `enqueue()` → rejected với `QUEUE_FULL` khi đạt maxDepth
- `enqueue()` → rejected với `WRITE_ERROR` khi disk fail (mock fs.rename)
- Consumer xử lý items theo FIFO order (track call order)
- Consumer với concurrency=3 → batch đúng (3 items cùng lúc)
- Consumer tự dừng khi queue rỗng
- Consumer tự restart khi item mới đến trong lúc consumer đang idle
- Failed processor → skip item, continue với item tiếp theo
- depth counter chính xác sau enqueue/process/fail

### translation-queue.test.ts

- `startup()` → archive existing pending files
- `startup()` → fresh state sau archive
- `enqueue()` → lazy-create RoomQueue
- Multi-room → xử lý song song (room A không block room B)
- `shutdown()` → đợi active completions
- `shutdown()` → timeout sau 30s nếu processor không finish
- `getSnapshot()` → accurate counts

---

## 11. Failure Mode Analysis

| Scenario                          | Behavior                                              | Recovery                                          |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| **Disk full** khi enqueue         | `WRITE_ERROR` → router log warn, message lost         | Operator monitor disk                             |
| **Processor throw**               | Consumer skip, log error, continue next item          | Handler's exponential backoff chạy trước          |
| **Process crash** mid-translation | Pending files survive → archived on next startup      | Messages lost (accepted)                          |
| **Queue full** (depth=10)         | `QUEUE_FULL` → router log warn                        | Drain trước khi messages mới accepted             |
| **Shutdown timeout** (30s)        | Active translations force-terminated                  | Docker kills process, pending archived on restart |
| **Concurrent enqueue same room**  | Synchronous depth check trước await → no TOCTOU       | In-memory counter không bao giờ race              |
| **Kagi anti-abuse**               | Processor throw → handler retry trước, queue skip sau | Queue unblocked, continues with next              |

---

## 12. Rollout

- **No feature flag**: Queue thay thế trực tiếp fire-and-forget. Không cần rollback path đặc biệt.
- **Deployment order**: Deploy translator + kagi-sidecar cùng lúc (KAGI_MAX_QUEUE_WAIT_MS change cần đồng bộ).
- **Backward compatibility**: `queue` field trong `/status` là optional — không break existing monitoring.
- **Volume mount**: `./data:/app/data` đã có trong docker-compose → `data/queue/` được tạo tự động.

---

## 13. Decision Log

| ID      | Decision                                      | Status      | Provenance        | Risk | Notes                            |
| ------- | --------------------------------------------- | ----------- | ----------------- | ---- | -------------------------------- |
| DEC-001 | Unit tests + real file I/O                    | accepted    | user-confirmed    | low  | Consistent with codebase pattern |
| DEC-002 | EnqueueResult return object (không throw)     | accepted    | user-confirmed    | low  | Control flow tường minh          |
| DEC-003 | Processor: single dual-dispatch callback      | accepted    | user-confirmed    | low  | Queue generic, no domain leak    |
| DEC-004 | Full observability (tất cả log events)        | accepted    | user-confirmed    | low  | Dễ debug consumer issues         |
| DEC-005 | getSnapshot() → /status endpoint              | accepted    | user-confirmed    | low  | /health nên chỉ liveness         |
| DEC-006 | Package domain-specific (dep on core)         | accepted    | user-confirmed    | low  | YAGNI — generic không cần thiết  |
| DEC-007 | In-memory depth counter (không readdir)       | ai-inferred | codebase analysis | low  | Giải quyết TOCTOU race condition |
| DEC-008 | QUEUE_DATA_DIR derive từ ROOM_CONFIG_DATA_DIR | ai-inferred | codebase pattern  | low  | Không cần env var riêng          |

---

## 14. Open Risks

Không có `[UNCONFIRMED - HIGH RISK]` items.

**Minor observations (không block implementation):**

- `Map<number, RoomQueue>` grow unbounded nếu nhiều rooms — acceptable vì mỗi empty RoomQueue ~vài trăm bytes
- Concurrency không re-resolve nếu room type thay đổi runtime — acceptable vì service restart reset tất cả
- Server.stop() hiện tại được gọi sau asyncLogger.shutdown() — pre-existing issue, không sửa trong scope này

---

## 15. Acceptance Criteria

1. Gửi 6 messages liên tiếp vào free room trong 20s → tất cả 6 bản dịch xuất hiện đúng FIFO order
2. Messages từ Room A không ảnh hưởng messages từ Room B
3. Standard room xử lý tối đa 3 messages đồng thời
4. Khi queue depth = 10, message thứ 11 bị reject + logged
5. Khi 1 message fail (processor throw), queue tiếp tục với message tiếp theo
6. Khi translator restart, pending messages từ session cũ được archived (không replay)
7. `GET /status` trả về `queue: { totalPending, totalActive, rooms: [...] }`
8. `bun test && bun run typecheck && bun run lint` pass toàn bộ

---

## 16. Scope Extension Backlog (Deferred)

Những items này được confirm là ngoài scope hiện tại, chưa estimate, chưa commit:

- Dead-letter queue cho failed messages
- Per-room queue pause/resume (operator control)
- Queue metrics dashboard trong translator UI
- Message deduplication by `sourceMessageId`
- Webhook logger-side buffering
- RoomQueue cleanup từ Map khi idle lâu
- Concurrency re-resolution on room config change (without restart)
