# Remove Webhook Signature Verification — Design Spec

**Version:** 1.0
**Date:** 2026-03-27
**Prepared by:** AI-assisted (Claude Code + user collaboration)
**Status:** Approved

---

## Objective

Remove the entire HMAC webhook signature verification mechanism from the system. After this change, the system permanently bypasses signature checking — all incoming webhook requests are accepted and processed without validating the `X-ChatWorkWebhookSignature` header.

## Motivation

The HMAC verification mechanism adds operational complexity (per-room secrets, encryption/decryption, internal API round-trips) that is not needed for the current use case. Removing it simplifies the architecture and reduces the number of env vars, internal APIs, and moving parts.

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

All remaining tests pass. No new tests need to be written — only existing tests are deleted or updated.

## Scope

### In Scope

- Remove `verifyWebhookSignature` function and `ChatworkWebhookSignatureError` from `@chatwork-bot/chatwork`
- Remove signature verification logic from `@chatwork-bot/webhook-logger` webhook handler
- Remove room secret cache and `fetchRoomSecret()` from webhook-logger
- Remove `/internal/room-secret` endpoint from `@chatwork-bot/translator`
- Remove `encryptedWebhookSecret` from room config schema, store, and API contracts
- Remove `webhookSecret` field from dashboard create/edit forms
- Simplify webhook stepper from 6 steps to 5 steps
- Remove env vars: `CHATWORK_SKIP_SIGNATURE_VERIFY`, `INTERNAL_API_SECRET`, `TRANSLATOR_INTERNAL_URL`
- Delete `data/room-configs.json` (start fresh with new schema)
- Update docs: `ai_rules/security.md`, `.env.example`, `docker-compose.yml`, `docker-compose.dev.yml`, `docs/manual-e2e-test.md`

### Out of Scope (Non-Goals)

- Translation pipeline changes
- AI provider logic changes
- `aiApiToken` encryption (kept — `encryption.ts` and `ROOM_CONFIG_ENCRYPTION_KEY` remain)
- Authentication / authorization (dashboard remains open access)
- Any new security mechanism to replace HMAC

## Constraints

- Bun v1.1+ runtime
- Existing test coverage must not regress on remaining tests
- `TRANSLATOR_URL` env var stays (still needed for `/internal/translate` forwarding)

---

## Architecture After Change

### Webhook Flow (Simplified)

**Before:**

```
Chatwork POST /webhook
  → webhook-logger: check signature header (422 if missing)
  → webhook-logger: call GET /internal/room-secret (translator)
  → webhook-logger: verify HMAC with fetched secret (422 if mismatch)
  → webhook-logger: POST /internal/translate (translator)
```

**After:**

```
Chatwork POST /webhook
  → webhook-logger: normalize payload
  → webhook-logger: POST /internal/translate (translator)
```

Webhook-logger becomes a **pure forwarder**. Room existence is checked by translator (already does room lookup for translation). Room-not-found remains a silent failure (200 OK, log warning) — only the detection point shifts from webhook-logger to translator.

---

## Package-by-Package Changes

### `@chatwork-bot/chatwork`

**Delete files:**

- `src/services/verify-webhook-signature.ts`
- `src/services/verify-webhook-signature.test.ts`
- `src/errors/chatwork-webhook-signature-error.ts`

**Update files:**

- `src/errors/index.ts` — remove `ChatworkWebhookSignatureError` export
- `src/index.ts` — remove `verifyWebhookSignature` and `ChatworkWebhookSignatureError` exports

---

### `@chatwork-bot/webhook-logger`

**`src/env.ts`** — remove fields:

- `CHATWORK_SKIP_SIGNATURE_VERIFY`
- `TRANSLATOR_INTERNAL_URL`
- `INTERNAL_API_SECRET`

**`src/routes/webhook.ts`** — remove:

- `ROOM_SECRET_TTL_MS` constant
- `CachedRoomSecret` interface
- `roomSecretCache` Map
- `resetRoomSecretCacheForTest()` export
- `getCachedRoomSecret()` function
- `fetchRoomSecret()` function (~90 lines total cache layer)
- `.derive()` rawBody capture hook (only used for HMAC)
- Signature header extraction + 422 response for missing header
- `skipVerify` logic + `verifyWebhookSignature` call + 422 response for invalid signature

**Result:** Handler flow becomes: extract room_id → normalize payload → forward to `/internal/translate`.

**`src/routes/webhook.test.ts`** — remove:

- `makeSignature()` helper
- `INTERNAL_API_SECRET` mock
- `TRANSLATOR_INTERNAL_URL` mock
- All signature verification test cases
- All room secret cache test cases
- `resetRoomSecretCacheForTest()` calls

**`src/env.test.ts`** — remove: `INTERNAL_API_SECRET` and `TRANSLATOR_INTERNAL_URL` assertions

**`src/app.test.ts`** — remove: `INTERNAL_API_SECRET` and `TRANSLATOR_INTERNAL_URL` from mock env

---

### `@chatwork-bot/translator`

**Delete files:**

- `src/routes/internal-room-secret.ts`
- `src/routes/internal-room-secret.test.ts`

**`src/app.ts`** — remove:

- `createInternalRoomSecretRoute` import
- Route registration: `.use(createInternalRoomSecretRoute(...))`

**`src/env-schema.ts`** — remove:

- `INTERNAL_API_SECRET` field

**`src/types/room-config.ts`** — remove:

- `encryptedWebhookSecret: z.string().min(1)` from `RoomConfigSchema`
- `webhookSecret: z.string().min(1)` from `CreateRoomRequestSchema`
- `webhookSecret: z.string().min(1).optional()` from `UpdateRoomRequestSchema`
- Update `RoomConfigPublic = Omit<RoomConfig, 'encryptedAiApiToken'>` (no longer needs to omit `encryptedWebhookSecret`)
- Simplify `redactRoomConfig()` — only redacts `encryptedAiApiToken`

**`src/services/room-config-store.ts`** — remove:

- `encrypt(params.webhookSecret, ...)` call in `create()`
- `encryptedWebhookSecret` field in create payload
- Conditional re-encrypt of `webhookSecret` in `update()`
- `decryptWebhookSecret()` method

**`src/services/room-config-store.test.ts`** — remove: `webhookSecret` from all test fixtures

**`src/routes/rooms.test.ts`** — remove: `webhookSecret` from all test inputs

**`src/webhook/handler.test.ts`** — remove: `webhookSecret` from test data

**`src/env.test.ts`** — remove: `INTERNAL_API_SECRET` assertions

**`src/app.test.ts`** — remove: `INTERNAL_API_SECRET` from mock env

**Data:**

- Delete `data/room-configs.json` (fresh start, new schema without `encryptedWebhookSecret`)

---

### Scripts

**`scripts/dev.test.ts`** — remove:

- Line 404: assertion `expect(webhookLoggerBlock).toContain('TRANSLATOR_INTERNAL_URL=http://translator:3000')`

---

### `@chatwork-bot/dashboard`

**`src/lib/room-schema.ts`** — remove:

- `webhookSecret` field from `roomCreateSchema`
- `webhookSecret` field from `roomEditSchema`

**`src/lib/api-types.ts`** — remove:

- `webhookSecret: string` from `CreateRoomInput`
- `webhookSecret?: string` from `UpdateRoomInput`

**`src/pages/room-create.tsx`** — remove:

- `webhookSecret: ''` default value
- `BrutalInput` for Webhook Secret (label, type, hint, error, register)
- Page description reference to "webhook secret before saving"
- "Manual Step Required" sticker card (or update to remove secret reference)

**`src/pages/room-detail.tsx`** — remove:

- `webhookSecret: ''` default values (3 occurrences)
- Conditional check `data.webhookSecret !== ''` in submit handler
- `BrutalInput` for Webhook Secret

**`src/components/molecules/webhook-stepper.tsx`** — update:

- Step 5 "Save & Copy Secret" → "Save Webhook": "Click Save. Chatwork will activate the webhook. No secret needed."
- Remove Step 6 "Save Secret on Dashboard"
- Stepper total: 6 steps → 5 steps

**`src/pages/webhook-guide.tsx`** — update:

- Replace: _"Once the webhook secret is saved in the room configuration and the room is enabled, no further manual steps are needed."_
- With: _"Once the webhook URL is saved in Chatwork and the room is enabled, translation runs automatically."_

**Test updates:**

- `src/lib/room-schema.test.ts` — remove 2 test cases for `webhookSecret` validation
- `src/lib/api-client.test.ts` — remove test "sends webhookSecret in createRoom requests"
- `src/stores/room-store.test.ts` — remove `webhookSecret` from sample data
- `src/pages/room-create.test.tsx` — remove assertion about `register('webhookSecret')`
- `src/pages/room-detail.test.tsx` — remove assertions about `webhookSecret`
- `src/components/molecules/webhook-stepper.test.tsx` — update: expect new step 5 text, remove assertions for "Save & Copy Secret" / "Webhook Secret field"
- `src/pages/webhook-guide.test.tsx` — update text assertions to match new guide content

---

## Environment Variable Changes

### Removed

| Variable                         | Removed From                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `CHATWORK_SKIP_SIGNATURE_VERIFY` | `.env.example`, `webhook-logger/src/env.ts`                                                            |
| `INTERNAL_API_SECRET`            | `.env.example`, `webhook-logger/src/env.ts`, `translator/src/env-schema.ts`, `docker-compose.yml` (×2) |
| `TRANSLATOR_INTERNAL_URL`        | `.env.example`, `webhook-logger/src/env.ts`, `docker-compose.yml`, `docker-compose.dev.yml`            |

### Kept

| Variable                     | Reason                                       |
| ---------------------------- | -------------------------------------------- |
| `TRANSLATOR_URL`             | Used for forwarding to `/internal/translate` |
| `ROOM_CONFIG_ENCRYPTION_KEY` | Used for encrypting `aiApiToken`             |

### `.env.example` text updates

- Remove "Webhook signature verification" comment block (lines 7-10)
- Remove `INTERNAL_API_SECRET` entry (lines 17-19)
- Remove `TRANSLATOR_INTERNAL_URL` entry (line 42)
- Simplify TRANSLATOR_URL comment (no longer needs to explain the URL vs internal URL split)
- Update "=== Removed ===" section: change `CHATWORK_WEBHOOK_SECRET → roomConfig.encryptedWebhookSecret` to `CHATWORK_WEBHOOK_SECRET → removed (signature verification eliminated)`

---

## Documentation Updates

| File                      | Change                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ai_rules/security.md`    | Remove "Webhook Signature Verification" section, remove `CHATWORK_WEBHOOK_SECRET` and `CHATWORK_SKIP_SIGNATURE_VERIFY` entries |
| `docs/manual-e2e-test.md` | Remove step "Save and copy the webhook token (this is the webhookSecret)"                                                      |

---

## Risks & Trade-offs

| Risk                                                     | Mitigation                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Any HTTP client can now send webhooks to `/webhook`      | Acceptable for current use case (dev/research context, no auth required per spec) |
| `room-configs.json` deleted — existing room configs lost | Accepted by user; rooms need to be recreated via dashboard                        |
| Removing `INTERNAL_API_SECRET` as required env var       | Remove from env schema validation — startup will no longer fail if not set        |

---

## Explicit Decisions

| Decision                                              | Source                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Remove room pre-check from webhook-logger entirely    | User selected "Xóa hoàn toàn"                               |
| Delete room-configs.json, no migration                | User stated "xoá hết file room-configs.json tạo lại từ đầu" |
| Keep `encryption.ts` and `ROOM_CONFIG_ENCRYPTION_KEY` | Still needed for `aiApiToken` encryption                    |
| Stepper: 5 steps, not 4                               | Step 5 reworded, Step 6 deleted                             |
| No replacement security mechanism                     | Explicitly out of scope                                     |
