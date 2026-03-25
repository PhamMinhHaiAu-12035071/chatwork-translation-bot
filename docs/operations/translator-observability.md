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
