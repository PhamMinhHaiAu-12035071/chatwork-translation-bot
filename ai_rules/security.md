# Security

## Environment Variables

### Required

| Variable                  | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `CHATWORK_API_TOKEN`      | Chatwork REST API authentication token  |
| `CHATWORK_WEBHOOK_SECRET` | Secret for verifying webhook signatures |

### Optional

| Variable   | Default       | Purpose             |
| ---------- | ------------- | ------------------- |
| `PORT`     | `3000`        | HTTP server port    |
| `NODE_ENV` | `development` | Runtime environment |

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

Implementation: `packages/bot/src/webhook/router.ts`

## Runtime Endpoints

| Endpoint   | Method | Purpose                       |
| ---------- | ------ | ----------------------------- |
| `/health`  | GET    | Health check (returns 200 OK) |
| `/webhook` | POST   | Chatwork webhook receiver     |

Verify locally after startup: `curl http://localhost:3000/health`
