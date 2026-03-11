# Dataset Auto-Injection Sidecar Design

**Status:** Approved for implementation  
**Date:** 2026-03-10  
**Source:** Derived from [`PLAN.md`](../../PLAN.md) and repo inspection

---

## Summary

The current dev stack already brings up every runtime component with a single command:
`bun run dev` (or `bun run dev:down && bun run dev`).

The missing manual step is message injection into the Chatwork original room. This design adds a
new local-only sidecar service, `@chatwork-bot/dataset-runner`, that reads JSONL datasets from a
local input directory, sends them into the original room through the real Chatwork API, and then
waits for an internal callback ACK from `translator` before dequeuing the next item. HTTP routes
stay as thin adapters; queue orchestration and durable ACK handling live in the runner service. The
existing `output/` files remain valuable as audit/debug artifacts, but they stop being the primary
synchronization primitive.

The system remains hybrid:

- Manual Chatwork messages continue to work unchanged.
- Automation is opt-in via `DATASET_AUTORUN=true`.
- The sidecar is always started by `bun run dev`, but idles safely when automation is disabled.
- Replay/reset is available through one-shot startup env vars, so reruns do not require manual file
  surgery under `input/state/` and `input/archive/`.

## Goals

- Preserve the real production-like E2E path:
  `Chatwork send -> webhook-logger -> translator -> output write -> destination send`
- Keep one-command local startup.
- Guarantee sequential processing with resume-safe state.
- Prevent duplicate sends after restart.
- Use an explicit service-to-service completion signal instead of file polling.
- Allow rerunning a file from the start or from a checkpoint line through explicit startup config.
- Keep the translator as the source of truth for translation completion.
- Expose only low-noise operational status: structured logs plus an internal status endpoint.

## Non-Goals

- No quality scoring or expected-translation assertions in v1.
- No production support for dataset automation.
- No direct bypass to `/internal/translate` in v1.
- No automatic cleanup of original-room source messages.
- No HTTP/UI control API in v1; replay/reset stays startup-only through env configuration.

## Existing System Constraints

The design must fit the current repo and flow:

- `packages/webhook-logger` receives Chatwork webhook events and forwards them fire-and-forget to
  `POST /internal/translate`.
- `packages/translator` runs the pipeline, writes JSON to `output/<date>/<message_id>.json`, then
  sends the translated message to the destination room.
- `packages/core` already exposes `ChatworkClient`, which can send messages to arbitrary rooms.
- `docker-compose.dev.yml` already binds the full repo into each service container, so `output/`
  and the new `input/` directory are naturally shared across services.
- Root workspaces auto-pick new packages under `packages/*`, and `scripts/verify-standards.ts`
  already validates package scripts generically.

## Chosen Architecture

### New package

Add a new workspace package:

- `packages/dataset-runner`

Responsibilities:

- Validate automation env.
- Apply one-shot reset/replay directives before entering the queue loop.
- Poll `input/pending/*.jsonl` in deterministic FIFO order.
- Manage lock, checkpoint, ACK state, retries, and DLQ files under `input/state/` and
  `input/failed/`.
- Send source messages to the original Chatwork room.
- Expose an internal callback endpoint that receives translator delivery ACKs.
- Advance the queue only after the matching ACK is durably recorded.
- Expose internal-only `/health` and `/status`.

It must not:

- Call provider plugins directly.
- Call translator internals directly for real processing.
- Change webhook-logger behavior.

### Translator change

The runner needs a reliable completion signal for "full workflow finished". The production-ready
place to emit that signal is an internal service callback, not filesystem polling. The translator
will therefore:

- append `origin` and `delivery` metadata to `OutputRecord`
- call an internal dataset-runner callback endpoint when `origin.type='automation'`
- keep `output/` as an audit/debug artifact rather than the primary orchestration signal

This keeps the translator as the authoritative owner of:

- translation output
- destination send outcome
- final completion state

### Hybrid behavior

Manual messages and automation messages coexist.

- Translator continues to process every incoming Chatwork message event.
- The runner tracks only the `message_id` values returned by its own Chatwork API sends.
- The runner writes an automation source-map entry per sent source message under
  `input/state/source-map/`.
- Translator uses that source-map to classify each output as `manual` or `automation` for
  observability.
- No filtering or prioritization of manual messages is added to translator.
- Manual interleaving may affect latency, but it does not change queue correctness because the
  runner only advances on matching automation ACKs.

## Filesystem Layout

Use a dedicated local artifact tree:

```text
input/
  samples/                              ← git-tracked seed batches
    001-vfa-thinhntt-2026-03-10.jsonl
  pending/                              ← gitignored, runtime only
    001-vfa-thinhntt-2026-03-10.jsonl
    010-regression-suite.jsonl
  archive/
    001-vfa-thinhntt-2026-03-10.jsonl
  failed/
    001-vfa-thinhntt-2026-03-10.failed.jsonl
  state/
    runner.lock
    001-vfa-thinhntt-2026-03-10.state.json
    acks/
      2083178724156780544.json
    source-map/
      2083178724156780544.json

output/
  2026-03-10/
    2083178724156780544.json
```

Rules:

- `input/samples/` contains git-tracked seed JSONL batches. Developers copy files from here to
  `input/pending/` before starting a run. This directory is **not** gitignored.
- `input/pending/` contains immutable source JSONL files for the current run.
- Process order is `file name ASC`, then `line number ASC`.
- `input/state/*.json` stores resume/checkpoint state per pending file.
- `input/state/acks/*.json` stores durable completion ACKs keyed by `sourceMessageId`.
- `input/archive/` stores fully processed source files. When a file is moved to `input/archive/`,
  its corresponding `input/state/source-map/` entries are deleted.
- `input/failed/*.failed.jsonl` stores failed items only.
- `output/` remains translator-owned.

`.gitignore` must exclude `input/pending/`, `input/archive/`, `input/failed/`, and `input/state/`,
but must **not** exclude `input/samples/`.

## Data Contracts

### Dataset item schema

Each JSONL line is one item:

```json
{
  "id": "vfa-001",
  "message": "ありがとう",
  "originalRoomId": 424846369,
  "metadata": {
    "caseNo": 1,
    "title": "Dịch từ đơn/Cụm từ thông dụng",
    "expectedText": "Cảm ơn",
    "category": "functional",
    "tags": ["jp-basic", "sheet-import"],
    "source": "spreadsheet-import"
  }
}
```

Rules:

- `id`: required, stable, unique within a file
- `message`: required, non-empty, sent verbatim
- `originalRoomId`: optional override
- `metadata`: optional object, never sent to Chatwork

Recommended application-level schema:

```ts
type DatasetItem = {
  id: string
  message: string
  originalRoomId?: number
  metadata?: {
    caseNo?: number
    title?: string
    expectedText?: string
    expectedRule?: string
    category?: string
    tags?: string[]
    notes?: string
    source?: string
  }
}
```

Field semantics:

- `id`: stable business key for dedupe, resume, DLQ, and trace
- `message`: the exact payload posted to Chatwork
- `originalRoomId`: per-item override for special routing cases
- `metadata.caseNo`: original row number from the manual test sheet
- `metadata.title`: human-readable test case title
- `metadata.expectedText`: exact expected translation when the expectation is deterministic
- `metadata.expectedRule`: free-text expectation when the assertion is qualitative
- `metadata.category`: coarse grouping such as `functional`, `normalization`, `proper-noun`, `noise`
- `metadata.tags`: search/filter labels for later reporting
- `metadata.notes`: local runner note, never sent to Chatwork
- `metadata.source`: origin of the case such as `spreadsheet-import`

### Example pending file

Recommended file name:

```text
input/pending/001-vfa-thinhntt-2026-03-10.jsonl
```

Example content:

```jsonl
{"id":"vfa-001","message":"ありがとう","metadata":{"caseNo":1,"title":"Dịch từ đơn/Cụm từ thông dụng","expectedText":"Cảm ơn","category":"functional","tags":["jp-basic","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-002","message":"私はベトナム人です。","metadata":{"caseNo":2,"title":"Hệ thống chữ viết hỗn hợp","expectedText":"Tôi là người Việt Nam.","category":"functional","tags":["sentence","jp-basic"],"source":"spreadsheet-import"}}
{"id":"vfa-014","message":"Đoạn văn 1000 chữ","metadata":{"caseNo":14,"title":"Thời gian phản hồi (Response Time)","expectedRule":"Phản hồi nhận về < 2000ms.","category":"performance","tags":["response-time","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-017","message":"100 requests/giây","metadata":{"caseNo":17,"title":"Tải đồng thời (Concurrency)","expectedRule":"Hệ thống không bị timeout hoặc lỗi 5xx.","category":"concurrency","tags":["load","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-019","message":"東京スカイツリー","originalRoomId":424846369,"metadata":{"caseNo":19,"title":"Địa danh & Tên riêng cố định","expectedText":"Tokyo Skytree","category":"proper-noun","tags":["location","fixed-name"],"source":"spreadsheet-import"}}
{"id":"vfa-037","message":"あざす (Azasu)","metadata":{"caseNo":37,"title":"Viết tắt kết hợp sai chính tả","expectedRule":"Nhận diện ありがとうございます : Cảm ơn","category":"normalization","tags":["slang","misspelling","sheet-import"],"source":"spreadsheet-import"}}
```

Important JSONL rules:

- one JSON object per physical line
- multiline Chatwork content must be encoded inside the JSON string with `\n`
- `message` is the exact text sent to Chatwork
- `metadata` stays local to the runner and must never be posted to Chatwork
- prefer zero-padded file prefixes such as `001-`, `010-`, `020-` so FIFO ordering is obvious
- blank lines may be ignored by the loader, but canonical dataset files should avoid them
- unknown top-level keys should fail validation rather than being silently accepted

### Mapping from the manual test sheet

When importing from the spreadsheet-style test matrix, map columns like this:

| Spreadsheet column                          | JSONL field                                        |
| ------------------------------------------- | -------------------------------------------------- |
| `No`                                        | `metadata.caseNo`                                  |
| `Test Case Detail`                          | `metadata.title`                                   |
| `Data Input`                                | `message`                                          |
| `Expected result`                           | `metadata.expectedText` or `metadata.expectedRule` |
| `Project`, `Document`, `Creator`, `Created` | file-level provenance, not per-item payload        |
| `Test date`, `Tester`, `Test result`        | execution/reporting data, not input JSONL          |

Import rules:

- deterministic expectations should go to `expectedText`
- qualitative expectations should go to `expectedRule`
- rows `14` and `17` are still imported into the canonical JSONL batch because the user wants the
  spreadsheet rows used as input directly
- performance and concurrency semantics live in `metadata.category`, `metadata.tags`, and
  `metadata.expectedRule`; the queue remains sequential and does not change control flow based on
  those rows

### Initial canonical input source

The first seed batch should be imported directly from the VFA ThinhNTT spreadsheet dated
`2026/3/10`.

Recommended initial batch file:

```text
input/pending/001-vfa-thinhntt-2026-03-10.jsonl
```

Import scope:

- include rows `1-33` and `35-37`
- omit row `34` because it is blank
- total imported items: `36`

The first imported batch must include these raw `Data Input` values:

- `1` -> `ありがとう`
- `2` -> `私はベトナム人です。`
- `3` -> `2026年3月10日`
- `4` -> `箸で食べる`
- `5` -> `いらっしゃいませ`
- `6` -> `食べさせられた`
- `7` -> `日本語は面白いです。`
- `8` -> `スマートフォン`
- `9` -> `Đoạn văn > 5000 ký tự`
- `10` -> `歩かせられた`
- `11` -> `食べぬく`
- `12` -> `あげる vs くれる`
- `13` -> `「こんにちは」...！？`
- `14` -> `Đoạn văn 1000 chữ`
- `15` -> `こんにちは &%^#*`
- `16` -> `Sugoi! (Romaji)`
- `17` -> `100 requests/giây`
- `18` -> `100万円`
- `19` -> `東京スカイツリー`
- `20` -> `あかん (Kansai-ben)`
- `21` -> `arigto hoặc ありかと`
- `22` -> `konniitwa`
- `23` -> `スタバ (Sutaba)`
- `24` -> `おめ (Ome)`
- `25` -> `スペック / スペ`
- `26` -> `レポ`
- `27` -> `アプリ`
- `28` -> `コミニュ`
- `29` -> `パソ`
- `30` -> `エンビ / プレ / 本番`
- `31` -> `ロギ / ログ`
- `32` -> `落ちる / 鯖落ち`
- `33` -> `バグる`
- `35` -> `ごはんたべる`
- `36` -> `笑 hoặc www`
- `37` -> `あざす (Azasu)`

### Output record extension

Extend `packages/translator/src/types/output.ts` with optional append-only blocks:

```ts
origin?: {
  type: 'manual' | 'automation'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

delivery?: {
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  sentAt: string
}
```

Design rules:

- Keep `translation` and `pipeline` unchanged.
- Do not redesign the output schema.
- Rewriting the same file is allowed, but writes must be atomic.

### State manifest

Each pending file gets a state manifest:

```json
{
  "fileName": "001-vfa-thinhntt-2026-03-10.jsonl",
  "nextLineNumber": 3,
  "completedItemIds": ["vfa-001", "vfa-002"],
  "failedItemIds": [],
  "inFlight": {
    "lineNumber": 3,
    "itemId": "vfa-003",
    "phase": "awaiting-ack",
    "attempt": 1,
    "sourceMessageId": "2083178724156780544",
    "startedAt": "2026-03-10T11:36:19.619Z"
  },
  "updatedAt": "2026-03-10T11:36:19.619Z"
}
```

Important points:

- Source JSONL files remain immutable.
- Resume relies on state files, not file rewriting.
- `inFlight.sourceMessageId` is the key that lets a restarted runner keep waiting instead of
  re-sending immediately.

### Automation source-map

Each source message sent by automation gets a small source-map file:

```json
{
  "sourceMessageId": "2083178724156780544",
  "datasetFile": "001-vfa-thinhntt-2026-03-10.jsonl",
  "datasetItemId": "vfa-003",
  "datasetLineNumber": 3,
  "sentAt": "2026-03-10T11:36:19.619Z"
}
```

Rules:

- dataset-runner writes the file immediately after Chatwork returns the source `message_id`
- translator treats the presence of a source-map file as `origin.type='automation'`
- if no source-map entry exists for a webhook `message_id`, translator writes `origin.type='manual'`
- source-map files are local observability artifacts and are never sent to Chatwork
- when a source JSONL file is moved to `input/archive/` (normal queue completion), all its
  source-map entries under `input/state/source-map/` must be deleted to keep the state tree clean;
  this cleanup is the responsibility of `QueueRunner` at the point of archiving, not of
  `reset-planner` (which handles startup replay only)

### Delivery ACK record

Each successful translator callback to dataset-runner persists a durable ACK record:

```json
{
  "sourceMessageId": "2083178724156780544",
  "status": "sent",
  "destinationRoomId": 55555,
  "destinationMessageId": "2083178724156780999",
  "ackedAt": "2026-03-10T11:36:24.000Z"
}
```

Rules:

- ACK records are keyed by `sourceMessageId`
- callback handling must be idempotent
- the HTTP callback route should remain a thin adapter and delegate ACK handling to the queue
  orchestration service
- the first durable ACK for a `sourceMessageId` wins; exact duplicates return `202` and are treated
  as success
- a divergent duplicate (same `sourceMessageId` but different `status`) is a data-integrity
  violation: `writeDeliveryAck` throws a descriptive `Error`; `QueueRunner.handleDeliveryAck`
  must catch this, emit a structured JSON error log (include `sourceMessageId`, stored status,
  received status, and full payloads), then re-throw so the runner stops; the HTTP route stays a
  thin adapter and must not swallow or transform this error
- queue advancement reads durable ACK state, not transient in-memory state alone
- an in-process ACK coordinator may be used for fast wake-up, but durable ACK state remains the
  recovery source of truth after restart
- `output/` and ACK files should agree, but ACK is the orchestration signal and `output/` is the
  audit artifact

### Status snapshot

The runner exposes a redacted read-only status model such as:

```json
{
  "mode": "running",
  "autorun": true,
  "pendingFiles": 2,
  "activeFile": "001-vfa-thinhntt-2026-03-10.jsonl",
  "activeItemId": "vfa-003",
  "activeLineNumber": 3,
  "activeSourceMessageId": "2083178724156780544",
  "waitingForAck": true,
  "completedCount": 12,
  "failedCount": 1,
  "lastResetMode": "from-start",
  "lastResetAt": "2026-03-10T11:35:00.000Z",
  "lastErrorCode": "CALLBACK_TIMEOUT",
  "updatedAt": "2026-03-10T11:40:00.000Z"
}
```

No message content should appear in status responses or logs by default.

### Automation-aware observability

To make manual interleaving visible without changing queue semantics:

- dataset-runner status must expose `activeFile`, `activeItemId`, `activeLineNumber`, and
  `activeSourceMessageId`
- dataset-runner logs should include dataset file, item id, line number, and source message id for
  `send`, `wait-for-ack`, `ack-received`, `retry`, and `dlq` events
- translator logs should include `origin.type=manual|automation`
- output records should include the `origin` block so manual and automation traffic can be filtered
  after the fact
- manual interleaving is expected to affect latency only, not correctness of queue sequencing

## Runtime Flow

### Startup

1. The sidecar starts with the rest of `docker-compose.dev.yml`.
2. It validates env.
3. It enforces local-only automation:
   `NODE_ENV` must be `development` or `local` when `DATASET_AUTORUN=true`.
4. It acquires the single-runner file lock under `input/state/runner.lock`.
5. If `DATASET_RESET_MODE !== 'resume'`, it applies a one-shot reset plan before entering the queue
   loop.
6. It performs best-effort preflight checks:
   - translator health reachable
   - webhook-logger health reachable
7. If `DATASET_AUTORUN=false`, it stays idle and serves `/health` and `/status`.

### Normal queue loop

For each next pending line in FIFO order:

1. Resolve `originalRoomId` from item override or `CHATWORK_ORIGINAL_ROOM_ID`.
2. Persist `inFlight` state before sending.
3. Send the source message through `ChatworkClient.sendMessage`.
4. Save `sourceMessageId` returned by Chatwork into state.
5. Write `input/state/source-map/<sourceMessageId>.json` for observability and downstream
   classification.
6. Update `inFlight.phase='awaiting-ack'`, expose `waitingForAck=true` in status, register an
   in-memory wait for `sourceMessageId`, and then await the matching internal callback ACK.
7. When `translator` finishes delivery for an automation-origin message, it `POST`s an idempotent
   ACK payload to dataset-runner.
8. The dataset-runner HTTP route delegates the payload to the queue orchestration service, which
   persists the first durable ACK to `input/state/acks/<sourceMessageId>.json`, notifies the
   in-process ACK coordinator, and resolves the waiting item.
9. On success:
   - advance checkpoint
   - clear `inFlight`
   - clear `waitingForAck`
   - archive fully processed source file when all lines are done
10. On failed delivery ACK or ACK timeout after reconciliation:

- append the item to DLQ
- clear `inFlight`
- clear `waitingForAck`
- continue to the next dataset item without resending the original Chatwork message

11. Sleep for cooldown (`DATASET_COOLDOWN_MS`) before the next item.

### Translator callback flow

For automation-origin messages only:

1. Translator resolves `origin.type='automation'` from the source-map.
2. Translator writes the output JSON.
3. Translator sends the destination message.
4. Translator rewrites output with the final `delivery` block. If this rewrite fails (disk full,
   permission error, etc.) the translator must log a detailed error (include path, error code, and
   item context) and stop processing for this message. Do not continue silently — a write failure
   is a bug that must be visible immediately in local dev.
5. Translator POSTs an ACK payload to dataset-runner.
6. If the callback fails transiently, translator retries the callback with a bounded exponential
   policy: `3` attempts, backoff `250ms → 500ms → 1000ms`.
7. If the callback still fails after all retries, translator logs a detailed error and marks the
   item as failed (DLQ). Dataset-runner is expected to always be healthy in the dev stack;
   a persistent callback failure means the runner is down, which is itself a bug.

### Reset and replay semantics

The runner supports one-shot startup reset behavior through explicit env vars.

Default mode:

- `DATASET_RESET_MODE=resume`
- keep state, archive, failed, and output untouched
- continue from the latest checkpoint if one exists

Supported reset modes:

- `from-start`
  - requires `DATASET_RESET_FILE`
  - deletes the target file state manifest
  - moves the target file from `input/archive/` back to `input/pending/` if it was already archived
  - clears any `inFlight` state so the file starts again at line `1`
- `from-line`
  - requires `DATASET_RESET_FILE`
  - requires `DATASET_RESET_LINE`
  - rewrites the target state manifest so `nextLineNumber = DATASET_RESET_LINE`
  - removes `inFlight`
  - truncates `completedItemIds` and `failedItemIds` to match the requested checkpoint

Optional reset flags:

- `DATASET_CLEAR_FAILED=true`
  - removes the matching `input/failed/<basename>.failed.jsonl` file before the run starts
- `DATASET_CLEAR_OUTPUT=true`
  - clears the local `output/` tree before the run starts
  - this is intentionally broad and should stay opt-in because output files are keyed by message id,
    not dataset item id

Reset rules:

- reset is startup-only and applied once per boot
- reset is allowed only in `NODE_ENV=development|local`
- reset never runs when `DATASET_AUTORUN=false`
- reset activity must be logged clearly and reflected in `/status`
- reset does not delete or clean up messages that were already posted to Chatwork rooms

## Failure Handling and Recovery

### Retry policy

Default v1 policy:

- send-phase max retries: `3`
- send-phase backoff: exponential `2s -> 4s -> 8s`
- completion-phase timeout: `15 minutes`

Retry rules:

- if source send fails before a `sourceMessageId` exists, retry the send phase
- if source send succeeds and `sourceMessageId` exists, do not resend immediately
- after send success, wait for internal ACK until timeout
- on timeout, perform at most one reconciliation probe using durable state or `output/` before
  classifying failure
- after a completion-phase timeout or failed delivery ACK, write the item to DLQ and require an
  explicit replay/reset to send the source message again

If still failing after max retries:

- append the failed item to `input/failed/<basename>.failed.jsonl`
- persist failure metadata in the state manifest
- continue with the next item

### Error taxonomy

Runner state and DLQ records should standardize to:

- `CHATWORK_API`
- `CALLBACK_TIMEOUT`
- `CALLBACK_DELIVERY_FAILED`
- `PROVIDER`
- `UNKNOWN`

Suggested mapping:

- source-room send fails -> `CHATWORK_API`
- no ACK before timeout and reconciliation cannot confirm completion -> `CALLBACK_TIMEOUT`
- callback endpoint returns unrecoverable invalid payload -> `CALLBACK_DELIVERY_FAILED`
- destination delivery acknowledged as failed -> `CHATWORK_API`
- unexpected parse/runtime issue -> `UNKNOWN`

### Duplicate prevention

Duplicate prevention comes from four layers:

- immutable source files
- persisted `inFlight` state with `sourceMessageId`
- explicit `inFlight.phase='awaiting-ack'` so resume logic knows it should keep waiting instead of
  sending again
- single-runner lock with heartbeat
- first-writer-wins ACK persistence keyed by `sourceMessageId`

### Locking

The lock file must include a heartbeat timestamp.

Rules:

- only one runner may dequeue items at a time
- heartbeat is refreshed during idle polling and while waiting for callback ACK
- a stale lock may be stolen only when the heartbeat age exceeds `30 seconds`

This avoids permanent blockage after a crash without allowing live concurrent processing.

### Graceful shutdown

The runner process must handle `SIGTERM` and `SIGINT` to release the file lock before exit. Docker
Compose sends `SIGTERM` on `docker compose down` or container restart. Without an explicit handler,
the lock file will not be released and the next boot will wait the full 30-second stale threshold
before acquiring the lock.

Required behavior:

- On `SIGTERM` or `SIGINT`: release the lock file, then exit `0`.
- If the runner is mid-item (awaiting ACK), release the lock and exit; the next boot will resume
  from the persisted `inFlight` state without resending.
- Signal handlers must be registered in `src/index.ts`, not inside `QueueRunner`, so that the HTTP
  server and queue loop both terminate cleanly.

## Operational Decisions

### Docker and startup

Add a new service to `docker-compose.dev.yml`:

- no host port published
- internal healthcheck on fixed port `3002`
- depends on healthy translator and webhook-logger
- uses the shared bind mount `.:/app`

`bun run dev` behavior remains unchanged from the user perspective: one command starts everything.

### Environment variables

Document these in `.env.example`:

- `CHATWORK_ORIGINAL_ROOM_ID`
- `DATASET_AUTORUN=false`
- `DATASET_INPUT_DIR=./input`
- `DATASET_RESET_MODE=resume`
- `DATASET_RESET_FILE=`
- `DATASET_RESET_LINE=`
- `DATASET_CLEAR_FAILED=false`
- `DATASET_CLEAR_OUTPUT=false`
- `DATASET_COOLDOWN_MS=2000`
- `DATASET_MAX_RETRIES=3`
- `DATASET_ITEM_TIMEOUT_MS=900000`

Internal defaults, not required in `.env.example`:

- dataset-runner port `3002`
- translator health URL `http://translator:3000/health`
- webhook-logger health URL `http://webhook-logger:3001/health`
- translator callback URL `http://dataset-runner:3002/internal/delivery-acks`

### Governance docs to update

This feature changes repo shape and runtime behavior, so these docs should be updated:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `ai_rules/project-structure.md`
- `ai_rules/commands.md`
- `ai_rules/security.md`
- `ai_rules/architecture-patterns.md`
- `docs/operations/dataset-runner.md`

Rationale:

- package count changes from 7 to 8
- dev stack behavior changes
- local-only automation rules must be explicit
- architecture docs need a new dataset-driven flow section

## Testing Strategy

### Unit tests

- dataset item parsing and validation
- pending-file discovery and FIFO ordering
- state manifest round-trip
- lock acquire / heartbeat / stale takeover / release
- ACK persistence and idempotent callback handling
- in-memory ACK waiter registration and timeout behavior

### Integration tests

- item success path through mocked Chatwork send + internal callback ACK
- destination-delivery failure -> callback ACK with failed status -> retry / DLQ
- restart with `inFlight.sourceMessageId` -> resume without duplicate send
- translator output rewrite preserves original record and appends origin + delivery status
- callback endpoint remains idempotent when the same ACK is delivered more than once

### Verification

Required:

```bash
bun test && bun run typecheck && bun run lint
```

Recommended manual smoke checks:

1. real E2E run with one-item JSONL
2. forced failure path that produces one DLQ entry
3. one-shot `from-start` reset replay for `001-vfa-thinhntt-2026-03-10.jsonl`
4. one-shot `from-line` reset replay from a mid-file checkpoint

## Acceptance Criteria

- `bun run dev` starts dataset-runner automatically as part of the dev stack.
- With `DATASET_AUTORUN=false`, the runner stays idle and does not touch Chatwork or input files.
- With `DATASET_AUTORUN=true`, the runner processes `input/pending/*.jsonl` sequentially.
- The initial canonical pending file imports all 36 non-empty rows from the VFA ThinhNTT sheet
  dated `2026/3/10`.
- The next dataset item never starts before dataset-runner receives a matching durable internal ACK.
- Restarting during an in-flight item does not cause an immediate duplicate send.
- Completion-phase failure never auto-resends a source message in the same run; replay is explicit.
- `DATASET_RESET_MODE=from-start` replays a target file from line `1` without manual edits under
  `input/state/` or `input/archive/`.
- `DATASET_RESET_MODE=from-line` resumes from an explicit checkpoint line without manual state
  editing.
- Output records classify message origin as `manual` or `automation`.
- Status and logs expose automation progress clearly enough that manual interleaving is observable
  without exposing message bodies.
- `output/` remains an audit artifact and is not the primary synchronization primitive.
- Failed items are written to DLQ after retry exhaustion, and the queue continues.
- Manual Chatwork messages still pass through the existing workflow unchanged.
- Translator output remains backward-compatible for existing consumers that do not read `origin` or
  `delivery`.
