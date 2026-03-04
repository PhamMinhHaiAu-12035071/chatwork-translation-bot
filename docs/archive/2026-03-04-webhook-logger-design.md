# Webhook Logger & Core Refactoring Design

## Overview

Tạo package `@chatwork-bot/webhook-logger` — Bun HTTP server chuyên nhận Chatwork webhook events và log chi tiết ra terminal. Đồng thời refactor `@chatwork-bot/core` để share Chatwork REST client và HMAC signature verify giữa bot và logger.

## Motivation

- Cần một tool dev/test để verify webhook payload format trước khi bot xử lý
- Chatwork không cung cấp API CRUD cho webhooks — phải tạo thủ công qua Web UI
- Signature verify hiện tại dùng sai header (`X-Hub-Signature` hex) — cần fix thành `x-chatworkwebhooksignature` (Base64)
- Bot và logger cùng cần Chatwork client + HMAC verify → DRY bằng cách đưa vào core

## Architecture

```
packages/
├── core/             ← REFACTORED: + chatwork-client, + webhook-verify
├── bot/              ← UPDATED: import client & verify từ core
├── webhook-logger/   ← NEW: Bun server nhận event + log terminal
```

### Dependency Graph

```
@chatwork-bot/core  ←── @chatwork-bot/bot
                    ←── @chatwork-bot/webhook-logger
```

## Part 1: Core Refactoring

### 1a. Chatwork REST Client

Chuyển `sendMessage()` từ `packages/bot/src/chatwork/client.ts` vào core, mở rộng thành class:

```
packages/core/src/chatwork/client.ts
```

```typescript
interface ChatworkClientConfig {
  apiToken: string
  baseUrl?: string // default: https://api.chatwork.com/v2
}

class ChatworkClient {
  constructor(config: ChatworkClientConfig)
  sendMessage(params: {
    roomId: number
    message: string
    unread?: boolean
  }): Promise<{ message_id: string }>
  getRooms(): Promise<ChatworkRoom[]>
  getRoomById(roomId: number): Promise<ChatworkRoom>
}
```

### 1b. Webhook Signature Verify

Chuyển + fix `verifyWebhookSignature()` từ `packages/bot/src/webhook/verify.ts`:

```
packages/core/src/webhook/verify.ts
```

**Thay đổi so với code cũ:**

| Aspect | Cũ (sai)          | Mới (đúng theo Chatwork docs) |
| ------ | ----------------- | ----------------------------- |
| Header | `X-Hub-Signature` | `x-chatworkwebhooksignature`  |
| Secret | Raw string        | Base64 decode trước khi dùng  |
| Output | Hex compare       | Base64 encode + compare       |
| Crypto | `crypto.subtle`   | `crypto.subtle` (giữ nguyên)  |

```typescript
export async function verifyWebhookSignature(
  body: string,
  signature: string, // từ header x-chatworkwebhooksignature
  secret: string, // webhook token (Base64 encoded)
): Promise<boolean>
```

### 1c. Impact lên bot

- `bot/src/chatwork/client.ts` → xóa, import `ChatworkClient` từ `@core/chatwork/client`
- `bot/src/webhook/verify.ts` → xóa, import `verifyWebhookSignature` từ `@core/webhook/verify`
- `bot/src/webhook/router.ts` → update header name `x-chatworkwebhooksignature`
- `bot/src/webhook/handler.ts` → dùng `ChatworkClient` instance

### 1d. New core structure

```
packages/core/src/
├── chatwork/
│   └── client.ts          ← NEW
├── webhook/
│   └── verify.ts          ← NEW
├── types/
│   ├── chatwork.ts        ← UPDATED: thêm types cho client
│   └── command.ts
├── interfaces/
│   └── translation.ts
├── services/
│   └── mock-translation.ts
├── utils/
│   ├── parse-command.ts
│   └── parse-command.test.ts
└── index.ts               ← UPDATED: re-export client + verify
```

## Part 2: webhook-logger Package

### Package Structure

```
packages/webhook-logger/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           ← entry point: start server + startup logs
    ├── server.ts          ← Bun.serve() port 3001
    ├── env.ts             ← Zod: CHATWORK_WEBHOOK_SECRET, LOGGER_PORT
    └── routes/
        └── webhook.ts     ← POST /webhook handler: verify → log
```

### Webhook Route Flow

```
POST /webhook
  → rawBody = request.text()
  → signature = headers.get('x-chatworkwebhooksignature')
  → verifyWebhookSignature(rawBody, signature, secret) → 401 nếu sai
  → JSON.parse(rawBody)
  → Log: separator + timestamp + headers + full event JSON (colors)
  → return 200 OK

GET /health
  → { status: 'ok', timestamp }
```

### Log Output Format

```
------- WEBHOOK EVENT -------
Timestamp: 2026-03-04T10:30:00.000Z
Headers: {
  content-type: 'application/json',
  x-chatworkwebhooksignature: 'abc123...',
  ...
}
{
  webhook_setting_id: '123',
  webhook_event_type: 'message_created',
  webhook_event_time: 1709542200,
  webhook_event: {
    message_id: '456',
    room_id: 424846369,
    account_id: 789,
    body: 'xin chào mọi người',
    send_time: 1709542200,
    update_time: 1709542200
  }
}
-----------------------------
```

### Environment Variables

```bash
CHATWORK_WEBHOOK_SECRET=your_base64_secret  # required
LOGGER_PORT=3001                             # optional, default 3001
```

### package.json

```json
{
  "name": "@chatwork-bot/webhook-logger",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {
    "@chatwork-bot/core": "workspace:*"
  },
  "devDependencies": {
    "zod": "^3.23.0"
  }
}
```

## Part 3: Root Scripts & DX

### New scripts in root package.json

```json
{
  "logger": "bun run --hot packages/webhook-logger/src/index.ts",
  "tunnel:logger": "bunx localtunnel --port 3001 --subdomain chatwork-logger"
}
```

### Developer Flow

```bash
# Terminal 1: Start logger server
bun run logger
# → Webhook logger listening on http://0.0.0.0:3001

# Terminal 2: Expose via localtunnel
bun run tunnel:logger
# → your url is: https://chatwork-logger.loca.lt

# Manual step: Chatwork UI → Integrations → Webhook → Create
#   - Name: Logger Dev
#   - URL: https://chatwork-logger.loca.lt/webhook
#   - Event: Room Event
#   - Room ID: 424846369
#   - Checked: Message created

# Test: gõ tin nhắn trong room → thấy log trên terminal 1
```

### Updated .env.example

```bash
# Existing (bot)
CHATWORK_API_TOKEN=your_token
CHATWORK_WEBHOOK_SECRET=your_base64_secret
PORT=3000
NODE_ENV=development

# New (webhook-logger)
LOGGER_PORT=3001
```

## Testing Strategy

- Unit tests cho `ChatworkClient` methods (mock HTTP responses)
- Unit tests cho `verifyWebhookSignature()` với known test vectors (Base64)
- Unit tests cho webhook route handler (mock request → verify log output)
- Đảm bảo bot tests hiện tại vẫn pass sau refactor

## Implementation Order

1. **Core refactoring** — thêm chatwork client + verify vào core
2. **Bot update** — import từ core, xóa code local, fix signature header
3. **webhook-logger** — tạo package mới với server + logging
4. **Root scripts** — thêm logger + tunnel scripts
5. **Verification** — typecheck, lint, test toàn bộ monorepo

## Constraints

- Chatwork webhook limit: 5 webhooks per account
- Webhook creation: manual via Chatwork Web UI only (no API)
- localtunnel subdomain may be taken — fallback to random subdomain
- Logger is dev/test tool only, not for production use

## References

- [Chatwork API Docs](https://developer.chatwork.com/docs/getting-started)
- [Chatwork Webhook Docs](https://developer.chatwork.com/docs/webhook)
- Signature: `x-chatworkwebhooksignature` header, Base64(HMAC-SHA256(Base64Decode(token), body))
