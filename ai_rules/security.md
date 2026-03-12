# Security

## Environment Variables

### Required

| Variable                  | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `CHATWORK_API_TOKEN`      | Chatwork REST API authentication token                |
| `CHATWORK_WEBHOOK_SECRET` | Secret for verifying webhook signatures               |
| `AI_PROVIDER`             | Translation provider: `gemini`, `openai`, or `cursor` |

### Provider-Specific (required per AI_PROVIDER)

| Variable                       | Provider | Purpose                          |
| ------------------------------ | -------- | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | gemini   | Google AI API key                |
| `OPENAI_API_KEY`               | openai   | OpenAI API key                   |
| `CURSOR_API_URL`               | cursor   | Local proxy URL (localhost only) |

### Optional

| Variable                         | Default       | Purpose                                                                       |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `PORT`                           | `3000`        | HTTP server port                                                              |
| `NODE_ENV`                       | `development` | Runtime environment                                                           |
| `AI_MODEL`                       | per provider  | Override default model (any string accepted; unsupported models log warning)  |
| `CHATWORK_SKIP_SIGNATURE_VERIFY` | `false`       | Bypass webhook signature verification (development only, no-op in production) |
| `ZROK_ENABLE_TOKEN`              | —             | zrok account enable token (Docker dev tunnel only)                            |
| `ZROK_UNIQUE_NAME`               | —             | Reserved zrok share name (Docker dev tunnel only)                             |

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

## Webhook Signature Verification

All incoming webhooks are verified with HMAC-SHA256 before processing:

1. Chatwork sends `X-ChatWorkWebhookSignature` header with every request
2. Raw body is captured via Elysia `.derive()` + `request.clone().text()` before JSON parsing
3. Bot computes HMAC-SHA256 of raw body using `CHATWORK_WEBHOOK_SECRET`
4. Signatures are compared using constant-time comparison (timing-attack safe)
5. Requests with missing or invalid signatures are rejected with **422**

Implementation: `packages/webhook-logger/src/routes/webhook.ts`

## Cursor Provider — LOCAL DEV ONLY

The `cursor` provider uses `cursor-api-proxy` which runs a local HTTP proxy.
This is intentionally restricted:

- `CURSOR_API_URL` must point to `localhost` or `127.0.0.1` (enforced by Zod schema)
- `cursor-api-proxy` must **never** be installed or run in production
- Startup guards verify the proxy is reachable before the server starts
