# Translator Observability

## Purpose

The translator exposes metadata-only observability so you can tell:

- which request is active
- which phase it is in
- whether a phase is slow or over budget
- whether delivery or dataset ACK callback failed

This is intended for local debugging and production-safe operational tracing. It does not log raw
source text, prompts, translated content, or full model payloads.

## Primary tools

### `GET /status`

`GET http://localhost:3000/status`

Returns:

- `activeRequests[]` — in-flight translations with current phase, round, elapsed time, and budgets
- `recentResults[]` — recent completed, failed, or aborted requests
- `updatedAt`

Key fields:

- `sourceMessageId` — end-to-end correlation key across all services
- `originType` — `manual` or `automation`
- `phase` — `analysis`, `translation`, `review`, `delivery`, `ack_callback`
- `phaseRound` — only present for review rounds
- `elapsedMs` / `phaseElapsedMs`
- `phaseBudgetMs`
- `overBudget`
- `datasetFile`, `datasetItemId`, `datasetLineNumber` — only for automation-origin requests

### Structured logs

All observability logs are JSON and metadata-only.

Translator events:

- `translation_request_received`
- `translation_phase_started`
- `translation_phase_completed`
- `translation_phase_failed`
- `translation_phase_heartbeat`
- `translation_escalation_started`
- `translation_escalation_completed`
- `translation_delivery_started`
- `translation_delivery_completed`
- `translation_delivery_failed`
- `translation_output_persisted`
- `translation_ack_callback_started`
- `translation_ack_callback_completed`
- `translation_ack_callback_failed`
- `translation_request_completed`
- `translation_request_failed`
- `translation_request_aborted`

Webhook-logger events:

- `webhook_received`
- `translation_forward_started`
- `translation_forward_completed`
- `translation_forward_failed`

Dataset-runner events:

- `dataset_item_send_started`
- `dataset_item_send_completed`
- `dataset_item_send_failed`
- `dataset_ack_wait_started`
- `dataset_ack_wait_heartbeat`
- `dataset_ack_received`
- `dataset_ack_failed`
- `dataset_ack_timeout`

## Phase budgets

Budgets are soft observability deadlines. They do not cancel work.

Environment variables:

- `TRANSLATOR_PHASE_HEARTBEAT_MS`
- `TRANSLATOR_TRANSLATION_BUDGET_MS`
- `TRANSLATOR_DELIVERY_BUDGET_MS`
- `TRANSLATOR_ACK_CALLBACK_BUDGET_MS`
- `TRANSLATOR_STATUS_HISTORY_LIMIT`

When a phase runs past its budget:

- the translator emits `translation_phase_heartbeat`
- `overBudget=true` appears in logs and `/status`

## Debugging flow

1. Start with `sourceMessageId`.
2. Check `GET /status` on the translator.
3. Tail service logs and filter by that message id.

Example:

```bash
curl -s http://localhost:3000/status | jq
docker compose -f docker-compose.dev.yml logs -f translator webhook-logger dataset-runner | rg '2083'
```

Interpretation:

- if translator shows `phase=review`, the model pipeline is still progressing
- if heartbeat events appear, the request is slow but not necessarily stuck
- if the final translator event is `translation_delivery_failed`, translation finished but destination send failed
- if the final translator event is `translation_ack_callback_failed`, the destination send succeeded or failed, but dataset-runner was not notified successfully

## Data safety

Forbidden from logs/status:

- raw message body
- cleaned text
- prompt text
- translated text
- full provider request/response payloads

Allowed:

- message ids
- room ids
- provider/model names
- dataset file and item ids
- timing and phase metadata

## Trace Correlation (Phase 3+)

### Request Lifecycle

Every translation request flows through multiple services with a shared `traceId`:

```
webhook-logger → translator → AI provider → Chatwork API
   (generate)      (propagate)    (include)     (include)
```

### Finding Related Logs

**By Trace ID:**

```bash
# Find all logs for a specific request
TRACE_ID="abc123-def456"

docker logs webhook-logger 2>&1 | grep "$TRACE_ID"
docker logs translator 2>&1 | grep "$TRACE_ID"
```

**By Message ID:**

```bash
# Find trace from Chatwork message ID
MESSAGE_ID="1234567890"

# First, find traceId from webhook-logger
docker logs webhook-logger 2>&1 | grep "message_id\":\"$MESSAGE_ID" | jq -r '.traceId'

# Then use traceId to find all related logs
```

### Trace File Structure

Detailed traces are saved to `output/traces/YYYY-MM-DD/trace-{traceId}.json`:

```json
{
  "traceId": "abc123-def456",
  "requestId": "req-001",
  "sourceMessageId": "1234567890",
  "timing": {
    "webhookReceivedAt": "2026-04-05T10:00:00.000Z",
    "translatorReceivedAt": "2026-04-05T10:00:00.050Z",
    "preprocessing": 150,
    "llmCall": 15000,
    "postprocessing": 200,
    "delivery": 2150,
    "totalEndToEnd": 17550
  },
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.0-flash-exp",
    "tokens": { "input": 450, "output": 180, "total": 630 }
  },
  "performance": {
    "isSlowRequest": false,
    "bottleneckStage": "llmCall",
    "bottleneckPercentage": 85.4
  }
}
```

### Log Entry Schema

**TranslatorLogEntry fields:**

```typescript
{
  level: 'info' | 'warn' | 'error',
  event: string,              // Event name (e.g., 'translation_started')
  traceId?: string,            // Request correlation ID
  requestId?: string,          // Sequential request counter
  timestamp: string,           // ISO 8601
  durationMs?: number,         // Operation duration
  [key: string]: unknown       // Event-specific data
}
```

### Async Logging (Phase 1+)

**Buffered logging:**
- Logs are buffered in memory (default: 50 entries)
- Flushed every 100ms or when buffer is full
- Non-blocking writes reduce overhead from 4-6ms to <1ms

**Graceful shutdown:**
- Server flushes buffer on SIGTERM/SIGINT
- Ensures no log loss during restart
