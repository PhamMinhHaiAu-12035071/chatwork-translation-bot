# Design: Dataset Runner — Automated Cleanup & Auto-Shutdown

**Date**: 2026-03-12
**Status**: Approved
**Scope**: `packages/dataset-runner`, `scripts/dev-dataset.sh`

---

## 1. Context

The `bun run dev:dataset` workflow automates end-to-end translation testing:

1. Send message → original Chatwork room
2. Webhook triggers translator
3. AI provider translates
4. Translated message sent → destination room
5. ACK callback received by dataset-runner

Previously, two steps required **manual intervention** after each run:

- **Cleanup**: User had to manually delete messages from both original and destination rooms
- **Shutdown**: User had to press Ctrl+C to stop the Docker stack

This spec adds both steps as automated phases.

---

## 2. Requirements

| #   | Requirement                                | Decision                                                             |
| --- | ------------------------------------------ | -------------------------------------------------------------------- |
| R1  | Delete source message after each item      | ✅ After each item (not batch)                                       |
| R2  | Delete destination message after each item | ✅ Both rooms cleaned per item                                       |
| R3  | Cleanup on failed items too                | ✅ Always attempt cleanup                                            |
| R4  | Delete error handling                      | Log `warn` + continue (never block pipeline)                         |
| R5  | Cleanup location                           | `dataset-runner` (has all message IDs post-ACK)                      |
| R6  | Auto-shutdown trigger                      | When all pending files are archived (queue empty after work)         |
| R7  | Shutdown mechanism                         | `process.exit(0)` → existing `--abort-on-container-exit` in `dev.sh` |
| R8  | Feature control                            | Always on — no env var needed                                        |
| R9  | Completion log                             | Summary table printed to terminal before shutdown                    |
| R10 | No changes to `dev-dataset.sh`             | `dev.sh` already has `--abort-on-container-exit`                     |

---

## 3. Architecture

### 3.1 New Module: `message-cleaner.ts`

**File**: `packages/dataset-runner/src/services/message-cleaner.ts`

Single responsibility: delete a pair of Chatwork messages (source + destination), logging warnings on failure without throwing.

```
cleanupMessages(pair, apiToken)
  ├── deleteRoomMessage(sourceRoomId, sourceMessageId, token)  → @chatwork-bot/chatwork
  │     └── error → logEvent('warn', 'dataset_cleanup_failed', ...) + continue
  └── if destRoomId && destMessageId:
        deleteRoomMessage(destRoomId, destMessageId, token)
          └── error → logEvent('warn', 'dataset_cleanup_failed', ...) + continue
```

**Interface**:

```typescript
export interface MessageCleanupPair {
  sourceRoomId: number
  sourceMessageId: string
  destRoomId?: number
  destMessageId?: string
}

export async function cleanupMessages(pair: MessageCleanupPair, apiToken: string): Promise<void>
```

**Test file**: `packages/dataset-runner/src/services/message-cleaner.test.ts`

Test cases:

- Deletes source + destination when both present
- Skips destination delete when `destRoomId`/`destMessageId` absent
- Continues (no throw) when source delete fails
- Continues (no throw) when destination delete fails
- Logs structured JSON warning on each delete failure

---

### 3.2 Changes to `queue-runner.ts`

Three targeted additions only. No structural changes.

#### Addition A — Cleanup after success path

After `clearDeliveryAck` in the success branch:

```typescript
// Current (after clearDeliveryAck):
workingState = await this.markRecordSucceeded(...)
await clearDeliveryAck(this.config.inputDir, sourceMessageId)

// Add after clearDeliveryAck:
await cleanupMessages({
  sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
  sourceMessageId,
  destRoomId: ack.destinationRoomId,
  destMessageId: ack.destinationMessageId,
}, this.config.apiToken)
```

#### Addition B — Cleanup before hard-stop `process.exit(1)` paths

Three existing hard-stop paths, two require cleanup:

| Hard-stop reason            | Available IDs                                | Cleanup scope                             |
| --------------------------- | -------------------------------------------- | ----------------------------------------- |
| Send retry exhausted        | No `sourceMessageId` (send never succeeded)  | **No cleanup** — message was never posted |
| ACK timeout                 | `sourceMessageId` (message was sent, no ACK) | Source room only                          |
| Translation delivery failed | `ack` present → both IDs available           | Both rooms                                |

For the ACK timeout path:

```typescript
// Before process.exit(1):
await cleanupMessages(
  {
    sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
    sourceMessageId,
  },
  this.config.apiToken,
)
process.exit(1)
```

For the translation delivery failed path (`ack.status === 'failed'`):

```typescript
// Note: ack.destinationRoomId is always present (required field).
// ack.destinationMessageId may be absent if translation failed before posting.
// cleanupMessages handles undefined destMessageId by skipping destination delete.
await cleanupMessages(
  {
    sourceRoomId: record.item.originalRoomId ?? this.config.defaultOriginalRoomId,
    sourceMessageId,
    destRoomId: ack.destinationRoomId,
    destMessageId: ack.destinationMessageId,
  },
  this.config.apiToken,
)
process.exit(1)
```

#### Addition C — Auto-shutdown after queue drains

Add `processedFilesCount` counter declared **before the `for (;;)` loop** (so it persists across outer loop iterations). Increment by `1` per file **inside `for (const file of files)` after the archive step**. In the `files.length === 0` branch:

```typescript
// Declared before for (;;):
let processedFilesCount = 0

// Inside for (;;), inside for (const file of files), after archive step:
processedFilesCount += 1

// In the files.length === 0 branch:
if (files.length === 0) {
  this.status.mode = 'idle'

  // NEW: auto-shutdown after completing at least one batch
  if (processedFilesCount > 0) {
    this.printCompletionSummary()
    process.exit(0)
  }

  if (await this.sleepOrShutdown(2000)) return
  continue
}
```

**`printCompletionSummary()`**: Private method. Prints structured JSON log + human-readable table:

```
{"level":"info","service":"dataset-runner","event":"dataset_run_complete",...}

╔══════════════════════════════════╗
║     Dataset Run Complete         ║
╠══════════════════╦═══════════════╣
║ Total processed  ║ 5             ║
║ Succeeded        ║ 4             ║
║ Failed           ║ 1             ║
╚══════════════════╩═══════════════╝
→ Messages cleaned up. Shutting down...
```

---

### 3.3 Auto-Shutdown Flow (no script changes needed)

`dev.sh` already has `--abort-on-container-exit` in both `start_docker_only` and `start_proxy_and_docker` (lines 189, 193). The chain is:

```
queue-runner.ts: process.exit(0)
  → dataset-runner container exits
  → docker compose detects exit → stops all containers (--abort-on-container-exit)
  → docker compose up process exits
  → dev.sh EXIT trap fires: trap_cleanup()
    → docker compose down --remove-orphans
  → Terminal returns to prompt
```

No changes to `scripts/dev-dataset.sh` or `scripts/dev.sh` required.

---

## 4. Data Flow per Item

```
[queue-runner.ts]
│
├── processDatasetItem()          → sourceMessageId, originalRoomId
│     (item-processor.ts)
│
├── waitForTerminalAck()          → DeliveryAckRecord
│     DeliveryAckRecord contains:
│       .sourceMessageId
│       .status ('sent' | 'failed')
│       .destinationRoomId        ← used for cleanup
│       .destinationMessageId?    ← used for cleanup (optional)
│
├── markRecordSucceeded/Failed()
│
├── clearDeliveryAck()
│
└── cleanupMessages()             ← NEW (message-cleaner.ts)
      ├── deleteRoomMessage(originalRoomId, sourceMessageId)
      └── deleteRoomMessage(destinationRoomId, destinationMessageId?)
```

---

## 5. File Changes Summary

| File                                                           | Change type   | Description                                                      |
| -------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| `packages/dataset-runner/src/services/message-cleaner.ts`      | **New**       | Cleanup module — delete source + destination messages            |
| `packages/dataset-runner/src/services/message-cleaner.test.ts` | **New**       | Unit tests for cleanup module                                    |
| `packages/dataset-runner/src/services/queue-runner.ts`         | **Modify**    | 3 additions: cleanup calls, auto-shutdown logic, summary printer |
| `scripts/dev-dataset.sh`                                       | **No change** | Already calls `dev.sh up` which has `--abort-on-container-exit`  |
| `scripts/dev.sh`                                               | **No change** | `--abort-on-container-exit` already present (lines 189, 193)     |

---

## 6. Error Handling

| Scenario                                                              | Behavior                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Source delete fails (API error)                                       | `logEvent('warn', 'dataset_cleanup_failed')` + continue                                |
| Destination delete fails                                              | `logEvent('warn', 'dataset_cleanup_failed')` + continue                                |
| Destination message ID absent (failed ACK or failed delivery)         | Skip destination delete silently — `destMessageId` is optional in `MessageCleanupPair` |
| `ack.destinationRoomId` present but translation failed before posting | Delete attempt will 404, caught as warn-log + continue                                 |
| Queue empty on first check (no files ever processed)                  | Keep polling — do NOT auto-shutdown                                                    |

---

## 7. Definition of Done

- [ ] `message-cleaner.ts` implemented and exports `cleanupMessages`
- [ ] `message-cleaner.test.ts` passes — covers success + error paths
- [ ] `queue-runner.ts` calls cleanup after each item (success + failed)
- [ ] `queue-runner.ts` calls cleanup before `process.exit(1)` on ACK timeout path (source only)
- [ ] `queue-runner.ts` calls cleanup before `process.exit(1)` on translation failed path (source + dest)
- [ ] `queue-runner.ts` does NOT call cleanup on send-retry-exhausted path (no message was ever sent)
- [ ] `queue-runner.ts` prints summary + `process.exit(0)` when queue empties after work
- [ ] `bun test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] Manual smoke test: run `bun run dev:dataset` → verify messages deleted, stack shuts down automatically
