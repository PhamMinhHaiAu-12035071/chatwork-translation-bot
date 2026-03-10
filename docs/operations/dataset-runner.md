# Dataset Runner

## Purpose

Local-only sidecar that reads JSONL files from `input/pending/` and injects them into the original Chatwork room for translation testing.

## Quick start

1. Copy seed batch: `cp input/samples/001-vfa-thinhntt-2026-03-10.jsonl input/pending/`
2. Set `DATASET_AUTORUN=true` in `.env`
3. Run `bun run dev`

## Replay / reset

- **Resume from checkpoint** (default): `DATASET_RESET_MODE=resume`
- **Replay from start**:
  - `DATASET_RESET_MODE=from-start`
  - `DATASET_RESET_FILE=001-vfa-thinhntt-2026-03-10.jsonl`
- **Replay from line N**:
  - `DATASET_RESET_MODE=from-line`
  - `DATASET_RESET_FILE=001-vfa-thinhntt-2026-03-10.jsonl`
  - `DATASET_RESET_LINE=14`
- Optional cleanup:
  - `DATASET_CLEAR_FAILED=true` — delete previous failed.jsonl
  - `DATASET_CLEAR_OUTPUT=true` — delete previous output/ files

## File layout

```
input/
  samples/      ← git-tracked seed batches (copy to pending/ to run)
  pending/      ← gitignored, processed in FIFO order
  archive/      ← gitignored, moved here when fully processed
  failed/       ← gitignored, DLQ for failed items
  state/        ← gitignored, checkpoints and ACK records
    acks/
    source-map/
```

## Observability

- `origin.type` in output JSON: `manual` (webhook-triggered) or `automation` (dataset-runner)
- Logs expose dataset file, item id, and source message id — not message body
- `/status` HTTP endpoint returns runner mode, active item, and counts
- Internal callback ACK (not polling) advances the queue

## Result

- Success: pending file moves to `archive/`, source-map entries cleaned up
- Failure after retries: item appended to `failed/*.failed.jsonl`
- Monitor: `docker compose -f docker-compose.dev.yml logs dataset-runner`
