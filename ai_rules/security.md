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

| Variable   | Default       | Purpose                                                                      |
| ---------- | ------------- | ---------------------------------------------------------------------------- |
| `PORT`     | `3000`        | HTTP server port                                                             |
| `NODE_ENV` | `development` | Runtime environment                                                          |
| `AI_MODEL` | per provider  | Override default model (any string accepted; unsupported models log warning) |

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

## Secrets Management

- **Never** commit `.env`, API tokens, or credentials to git
- `.env` is in `.gitignore` — verify before staging
- For CI/CD, use repository secrets (GitHub Actions secrets)
- When adding new env vars, add them to `.env.example` with a placeholder value

## Webhook Signature Verification

All incoming webhooks are verified with HMAC-SHA256 before processing:

1. Chatwork sends `X-ChatWorkWebhookSignature` header with every request
2. Bot computes HMAC-SHA256 of request body using `CHATWORK_WEBHOOK_SECRET`
3. Signatures are compared using constant-time comparison (timing-attack safe)
4. Requests with invalid signatures are rejected with 400

Implementation: `packages/webhook-logger/src/routes/webhook.ts`

## Cursor Provider — LOCAL DEV ONLY

The `cursor` provider uses `cursor-api-proxy` which runs a local HTTP proxy.
This is intentionally restricted:

- `CURSOR_API_URL` must point to `localhost` or `127.0.0.1` (enforced by Zod schema)
- `cursor-api-proxy` must **never** be installed or run in production
- Startup guards verify the proxy is reachable before the server starts
