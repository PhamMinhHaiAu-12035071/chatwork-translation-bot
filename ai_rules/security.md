# Security

## Environment Variables

### Required

| Variable                     | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `CHATWORK_API_TOKEN`         | Chatwork REST API authentication token                            |
| `CHATWORK_BOT_ACCOUNT_ID`    | Bot account ID used as room admin when creating destination rooms |
| `ROOM_CONFIG_ENCRYPTION_KEY` | AES-256-GCM key for encrypting per-room AI API tokens at rest     |

### Per-Room Provider Secrets

- AI provider selection, model selection, translation style, and API tokens are stored per room
  in encrypted room config managed by the dashboard and translator.
- No global webhook secret is required.
- No global provider API key is required for OpenAI or Gemini rooms.

### Optional

| Variable            | Default                 | Purpose                                                 |
| ------------------- | ----------------------- | ------------------------------------------------------- |
| `PORT`              | `3000`                  | Translator HTTP server port                             |
| `LOGGER_PORT`       | `3001`                  | Webhook logger HTTP server port                         |
| `NODE_ENV`          | `development`           | Runtime environment                                     |
| `TRANSLATOR_URL`    | `http://localhost:3000` | Translator URL used by webhook-logger to forward events |
| `ZROK_ENABLE_TOKEN` | —                       | zrok account enable token (Docker dev tunnel only)      |
| `ZROK_UNIQUE_NAME`  | —                       | Reserved zrok share name (Docker dev tunnel only)       |

### Dataset Automation (Local Dev Only)

| Variable                      | Default   | Purpose                                                                |
| ----------------------------- | --------- | ---------------------------------------------------------------------- |
| `CHATWORK_ORIGINAL_ROOM_ID`   | —         | **Required for dataset automation** — the room to inject messages into |
| `DATASET_AUTORUN`             | `false`   | Enable dataset-runner queue processing (idle when `false`)             |
| `DATASET_INPUT_DIR`           | `./input` | Root directory for pending/archive/failed/state subdirectories         |
| `DATASET_RESET_MODE`          | `resume`  | Replay mode: `resume` / `from-start` / `from-line`                     |
| `DATASET_RESET_FILE`          | —         | Target JSONL filename for `from-start` / `from-line` modes             |
| `DATASET_RESET_LINE`          | —         | Line number for `from-line` mode                                       |
| `DATASET_CLEAR_FAILED`        | `false`   | Delete previous `failed.jsonl` before run                              |
| `DATASET_CLEAR_OUTPUT`        | `false`   | Delete previous output files before run                                |
| `DATASET_COOLDOWN_MS`         | `2000`    | Wait between items to avoid rate limiting                              |
| `DATASET_MAX_RETRIES`         | `3`       | Max retries per item before moving to DLQ                              |
| `DATASET_ITEM_TIMEOUT_MS`     | `900000`  | Max wait time for ACK per item (15 minutes)                            |
| `DATASET_RUNNER_CALLBACK_URL` | —         | ACK callback URL injected into translate requests (used by translator) |

> **Dataset automation is local-only.** `CHATWORK_ORIGINAL_ROOM_ID` must never be set in
> production. The callback ACK endpoint (`/internal/delivery-acks` on port 3002) is internal
> to the Docker network — no external exposure, no host port published.

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

## Secrets Management

- **Never** commit `.env`, API tokens, or credentials to git
- `.env` is in `.gitignore` — verify before staging
- For CI/CD, use repository secrets (GitHub Actions secrets)
- When adding new env vars, add them to `.env.example` with a placeholder value
