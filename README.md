# Chatwork Translation Bot

A webhook-based bot that listens for Chatwork messages, parses `/translate` commands, translates text, and replies back to the chat room.

## Features

- Receives Chatwork webhook events with HMAC-SHA256 signature verification
- Parses `/translate <lang> <text>` commands (handles Chatwork markup stripping)
- Pluggable translation service via `ITranslationService` interface
- Async fire-and-forget processing (returns 200 immediately)
- Health check endpoint (`GET /health`)
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

| Variable                      | Required | Default       | Description                                         |
| ----------------------------- | -------- | ------------- | --------------------------------------------------- |
| `CHATWORK_API_TOKEN`          | Yes      | —             | Chatwork API token for sending messages             |
| `CHATWORK_WEBHOOK_SECRET`     | Yes      | —             | Secret for verifying webhook signatures             |
| `PORT`                        | No       | `3000`        | HTTP server port                                    |
| `NODE_ENV`                    | No       | `development` | `development` \| `production` \| `test`             |
| `CHATWORK_ORIGINAL_ROOM_ID`   | Dev only | —             | Room for dataset injection (dataset-runner sidecar) |
| `DATASET_AUTORUN`             | No       | `false`       | Enable dataset-runner queue (idle by default)       |
| `DATASET_INPUT_DIR`           | No       | `./input`     | Root dir for pending/archive/failed/state           |
| `DATASET_RUNNER_CALLBACK_URL` | No       | —             | ACK callback URL (set automatically in Docker dev)  |

### 3. Run the bot

```bash
bun run dev
```

The server starts at `http://localhost:3000` with hot-reload enabled.

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
├── core/            # @chatwork-bot/core — shared types, interfaces, utils, services
├── translation-prompt/  # @chatwork-bot/translation-prompt — 4-phase pipeline prompts + Zod schemas
├── provider-gemini/ # @chatwork-bot/provider-gemini — Gemini provider plugin
├── provider-openai/ # @chatwork-bot/provider-openai — OpenAI provider plugin
├── provider-cursor/ # @chatwork-bot/provider-cursor — Cursor provider (LOCAL DEV ONLY)
├── translator/      # @chatwork-bot/translator — HTTP server, webhook handler
├── webhook-logger/  # @chatwork-bot/webhook-logger — webhook receiver, forwards to translator
└── dataset-runner/  # @chatwork-bot/dataset-runner — ACK-driven queue runner sidecar (LOCAL DEV ONLY)
```

### Dataset Testing

Drop JSONL batch files into `input/pending/` to run automated translation tests:

```bash
cp input/samples/001-vfa-thinhntt-2026-03-10.jsonl input/pending/
# set DATASET_AUTORUN=true in .env
bun run dev
```

Output `origin.type` field distinguishes `manual` (real webhook) from `automation` (dataset-runner) runs.
See `docs/operations/dataset-runner.md` for replay/reset options.

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
```

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
4. Copy the webhook token and set it as `CHATWORK_WEBHOOK_SECRET`

## License

Private
