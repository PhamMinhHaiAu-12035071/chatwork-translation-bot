# Chatwork Translation Bot

A webhook-based bot that listens for Chatwork messages, parses `/translate` commands, translates text, and replies back to the chat room.

## Features

- Receives Chatwork webhook events and forwards to translation pipeline
- Parses `/translate <lang> <text>` commands (handles Chatwork markup stripping)
- Pluggable translation service via `ITranslationService` interface
- Async fire-and-forget processing (returns 200 immediately)
- Health check endpoint (`GET /health`)
- Translator status endpoint (`GET /status`) for active/recent request phases
- Dataset automation sidecar for translation testing (`input/pending/*.jsonl`, local dev only)

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) v1.1+
- **Language**: TypeScript 5.4+ (strict mode)
- **HTTP Server**: Bun.serve() (native)
- **Validation**: Zod
- **Container**: Docker (distroless runtime)

## Prerequisites

- [Bun](https://bun.sh) v1.1 or later
- A [Chatwork](https://www.chatwork.com) account with API token and webhook configured

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable                            | Required | Default       | Description                                           |
| ----------------------------------- | -------- | ------------- | ----------------------------------------------------- |
| `CHATWORK_API_TOKEN`                | Yes      | —             | Chatwork API token for sending messages               |
| `PORT`                              | No       | `3000`        | HTTP server port                                      |
| `NODE_ENV`                          | No       | `development` | `development` \| `production` \| `test`               |
| `TRANSLATOR_PHASE_HEARTBEAT_MS`     | No       | `30000`       | Heartbeat interval after a phase crosses budget       |
| `TRANSLATOR_TRANSLATION_BUDGET_MS`  | No       | `60000`       | Soft observability budget for translation phase       |
| `TRANSLATOR_DELIVERY_BUDGET_MS`     | No       | `45000`       | Soft observability budget for Chatwork delivery       |
| `TRANSLATOR_ACK_CALLBACK_BUDGET_MS` | No       | `10000`       | Soft observability budget for dataset ACK callback    |
| `TRANSLATOR_STATUS_HISTORY_LIMIT`   | No       | `20`          | Number of finished requests kept in `/status`         |
| `CHATWORK_ORIGINAL_ROOM_ID`         | Dev only | —             | Room for dataset injection (dataset-runner sidecar)   |
| `DATASET_AUTORUN`                   | No       | `false`       | Enable dataset-runner queue (idle by default)         |
| `DATASET_INPUT_DIR`                 | No       | `./input`     | Root dir for pending/archive/failed/state             |
| `DATASET_RESET_MODE`                | No       | `resume`      | Replay mode: `resume` \| `from-start` \| `from-line`  |
| `DATASET_RESET_CONFIRM`             | No       | —             | One-shot confirmation token required for replay modes |
| `DATASET_RUNNER_CALLBACK_URL`       | No       | —             | ACK callback URL (set automatically in Docker dev)    |

### 3. Run the bot

```bash
bun run dev
```

The server starts at `http://localhost:3000` with hot-reload enabled.

Useful local endpoints:

- `GET /health` — translator process health
- `GET /health/provider` — registered provider health snapshot
- `GET /status` — active translation phases and recent completed/failed requests
- `POST /internal/translate` — internal webhook forward target from `webhook-logger`

## Usage

Send a message in Chatwork with the following format:

```
/translate en こんにちは世界
```

The bot will reply with the translated text in the same room.

## Project Structure

Bun workspaces monorepo:

```
packages/
├── chatwork/          # @chatwork-bot/chatwork — Anti-corruption layer for Chatwork API
├── core/              # @chatwork-bot/core — Shared types, interfaces, utils, services
├── dashboard/         # @chatwork-bot/dashboard — React SPA for multi-room management
├── dataset-runner/    # @chatwork-bot/dataset-runner — ACK-driven queue runner sidecar (LOCAL DEV ONLY)
├── kagi-sidecar/      # @chatwork-bot/kagi-sidecar — Kagi translation sidecar service
├── provider-cursor/   # @chatwork-bot/provider-cursor — Cursor provider (LOCAL DEV ONLY)
├── provider-gemini/   # @chatwork-bot/provider-gemini — Gemini provider plugin
├── provider-kagi/     # @chatwork-bot/provider-kagi — Kagi provider plugin
├── provider-openai/   # @chatwork-bot/provider-openai — OpenAI provider plugin
├── translation-prompt/# @chatwork-bot/translation-prompt — Translation prompts and schemas
├── translator/        # @chatwork-bot/translator — HTTP server, webhook handler
└── webhook-logger/    # @chatwork-bot/webhook-logger — Webhook receiver, forwards to translator
```

### Dataset Testing

Drop JSONL batch files into `input/pending/` to run automated translation tests:

```bash
cp input/samples/001-vfa-thinhntt-2026-03-10.jsonl input/pending/
# dev (manual flow only)
bun run dev

# dataset automation flow
bun run dev:dataset
```

Output `origin.type` field distinguishes `manual` (real webhook) from `automation` (dataset-runner) runs.
See `docs/operations/dataset-runner.md` for replay/reset options.

### Observability

Translator, webhook-logger, and dataset-runner now emit structured JSON lifecycle logs keyed by
`sourceMessageId`. Logs are metadata-only: they do not include raw message text, prompts,
translations, or full provider payloads.

When a translation is in flight:

- `GET /status` on the translator shows the current phase, round, elapsed time, and whether the
  phase is over budget
- translator logs emit `translation_phase_started`, `translation_phase_completed`,
  `translation_phase_failed`, and `translation_phase_heartbeat`
- webhook-logger logs emit `webhook_received` and translation forward events
- dataset-runner logs emit send/ACK wait/ACK result events for automation traffic

See `docs/operations/translator-observability.md` for the full event contract and debugging flow.

## Observability & Tracing

### Request Tracing

Every translation request is assigned a `traceId` that flows through the entire pipeline:

```bash
# In webhook-logger logs
{"level":"info","event":"webhook_forward","traceId":"abc123",...}

# In translator logs
{"level":"info","event":"translation_started","traceId":"abc123",...}
{"level":"info","event":"translation_completed","traceId":"abc123",...}
```

### Trace Correlation

Use `x-trace-id` to correlate logs across services:

```bash
# Grep logs by trace ID
docker logs webhook-logger | grep "abc123"
docker logs translator | grep "abc123"
```

### Performance Traces

Detailed timing traces are saved to `output/traces/YYYY-MM-DD/`:

```json
{
  "traceId": "abc123",
  "timing": {
    "webhookReceivedAt": "2026-04-05T10:00:00.000Z",
    "totalEndToEnd": 17500,
    "preprocessing": 150,
    "llmCall": 15000,
    "postprocessing": 200,
    "delivery": 2150
  },
  "performance": {
    "bottleneckStage": "llmCall",
    "isSlowRequest": false
  }
}
```

See [`docs/operations/performance-monitoring.md`](docs/operations/performance-monitoring.md) for analysis tools.

## Scripts

```bash
# Development
bun run dev              # Run translator bot with hot-reload
bun run logger           # Run webhook-logger with hot-reload

# Build
bun run build            # Bundle to dist/server.js (minified, target bun)

# Type checking
bun run typecheck        # Typecheck root config files + all packages

# Linting & formatting
bun run lint             # ESLint across all packages (workspace-native)
bun run lint:fix         # ESLint with auto-fix
bun run format           # Prettier across all packages + root docs/configs

# Testing
bun test                 # Run all tests

# Quality (combined)
bun run quality          # lint + typecheck + test
bun run quality:ci       # quality + prettier --check on docs/configs
bun run verify:standards # Verify all packages meet script/config standards

# Performance analysis
bun run analyze:traces output/traces/YYYY-MM-DD # Analyze translation performance
bun run report:daily [YYYY-MM-DD]               # Generate daily performance report
```

## Performance Optimization

The translation bot includes comprehensive performance optimizations and observability features:

### Key Optimizations

- **Async Non-Blocking Delivery**: Fire-and-forget message delivery with exponential backoff retry
- **HTTP Connection Pooling**: Keep-alive connections to Chatwork API using `undici`
- **Circuit Breaker**: Auto-recovery from transient external service failures
- **Async Buffered Logging**: Non-blocking JSON logging with automatic flushing
- **Keyword Processing Cache**: LRU cache for compiled regex patterns
- **Optimized Prompts**: Token-efficient prompts (-41% tokens, -38% response time)

### Performance Monitoring

Translation traces are automatically generated for every request, capturing:

- Per-stage timing (preprocessing, LLM call, postprocessing, delivery)
- Token usage and cost analysis
- Bottleneck identification
- Optimization opportunities

See [Analyzing Traces Guide](./docs/operations/analyzing-traces.md) and [Performance Monitoring](./docs/operations/performance-monitoring.md) for details.

### Trace Analysis

```bash
# Analyze traces for a specific day
bun run analyze:traces output/traces/2026-04-05

# Generate daily performance report
bun run report:daily 2026-04-05
```

### Configuration

Performance features can be configured via environment variables:

| Variable                | Default | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| `USE_ASYNC_LOGGING`     | `true`  | Enable async buffered logging                        |
| `ENABLE_ASYNC_DELIVERY` | `false` | Enable fire-and-forget delivery (TODO: update tests) |
| `ENABLE_HTTP_KEEPALIVE` | `true`  | Enable HTTP connection pooling                       |
| `ENABLE_KEYWORD_CACHE`  | `true`  | Enable keyword pattern caching                       |
| `TRACE_OUTPUT_ENABLED`  | `true`  | Enable trace persistence                             |

See `.env.example` for all available options.

## Docker

```bash
# Build and run with Docker Compose
docker compose up

# Or build manually
docker build -t chatwork-translation-bot .
docker run -p 3000:3000 --env-file .env chatwork-translation-bot
```

The Docker image uses a multi-stage build with `oven/bun:1.1-distroless` for a minimal runtime image.

## Webhook Setup

1. Go to Chatwork Admin > Webhooks
2. Set the webhook URL to `https://<your-domain>/webhook`
3. Select **Room Event** → **Message Created**

## License

Private
