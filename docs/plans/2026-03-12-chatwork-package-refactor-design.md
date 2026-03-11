# Chatwork Package Refactor Design

**Date:** 2026-03-12

## Goal

Refactor all Chatwork-specific concerns out of `@chatwork-bot/core` into a dedicated
`@chatwork-bot/chatwork` package, so the monorepo keeps a cleaner boundary between domain
contracts and third-party integration code while improving webhook security and making future
Chatwork API expansion safer.

## Current Problems

- `@chatwork-bot/core` currently mixes generic shared contracts with Chatwork-specific schemas,
  interfaces, and the REST client.
- `translator`, `webhook-logger`, and `dataset-runner` all know too much about Chatwork shapes
  and low-level integration details.
- `translator` depends on raw `ChatworkWebhookEvent` instead of a neutral application DTO.
- Webhook security guidance says signatures must be verified, but the current inbound flow does
  not perform real signature verification.
- Future Chatwork API growth would continue to widen coupling if the current structure remains.

## Approved Direction

Adopt a dedicated integration package, `@chatwork-bot/chatwork`, and treat it as an
anti-corruption layer for Chatwork.

This refactor is approved with these key decisions:

- `@chatwork-bot/chatwork` owns inbound and outbound Chatwork-specific logic.
- `@chatwork-bot/core` stays Chatwork-free and holds only neutral shared contracts.
- `translator` receives a neutral ingress DTO, not raw Chatwork webhook types.
- `webhook-logger` verifies the webhook signature from the raw request body before parsing JSON.
- `translator` keeps message composition logic; the Chatwork package only handles integration.
- Chatwork public APIs are exposed as intent-oriented use cases, not a raw client.
- Migration is done in one pass with no compatibility re-exports from `core`.
- Scope includes both refactor and selected hardening/expansion for message-related Chatwork APIs.

## Package Responsibilities

### `@chatwork-bot/chatwork`

Owns all Chatwork-specific integration concerns:

- webhook signature verification
- webhook payload parsing, normalization, and validation
- mapping Chatwork webhook payloads to neutral translator ingress DTOs
- Chatwork REST API execution
- typed Chatwork errors and rate-limit metadata parsing
- message-focused use cases:
  - send room message
  - delete room message
  - get room members
  - resolve room member display name
  - get a room message
  - list room messages

### `@chatwork-bot/core`

Owns only neutral shared contracts and policies:

- translator ingress DTOs
- source snapshot metadata contracts
- existing provider registry and translation policies
- no Chatwork schemas, interfaces, clients, or helpers

### `@chatwork-bot/webhook-logger`

Acts as an HTTP ingress adapter only:

- reads raw request body and headers
- calls Chatwork verification and normalization use cases
- maps inbound webhook payload to a neutral DTO
- forwards the DTO to `translator`

### `@chatwork-bot/translator`

Acts as an application service only:

- receives a neutral ingress DTO
- cleans/translates business text
- composes translated outbound content
- calls Chatwork intent use cases for member display-name resolution and message delivery
- does not depend on Chatwork webhook shapes

### `@chatwork-bot/dataset-runner`

Uses Chatwork message-send use cases instead of a low-level Chatwork client.

## Public API Design

The new package exposes intent-oriented use cases. The public surface for v1 should include:

- `verifyWebhookSignature(...)`
- `normalizeWebhookPayload(...)`
- `mapWebhookToTranslationCommand(...)`
- `sendRoomMessage(...)`
- `deleteRoomMessage(...)`
- `getRoomMessage(...)`
- `listRoomMessages(...)`
- `getRoomMembers(...)`
- `resolveRoomMemberDisplayName(...)`

The package must not publicly expose:

- a raw `ChatworkClient`
- endpoint path builders
- header construction details
- raw response parsing helpers
- internal fetch wrappers

## Neutral DTO Strategy

`translator` must not receive `ChatworkWebhookEvent`. Instead, `webhook-logger` and
`@chatwork-bot/chatwork` map inbound Chatwork data into a neutral DTO stored in `core`.

The neutral contract should carry the data that the translator truly needs, for example:

- source system identifier
- source message ID
- source room ID
- sender account ID
- raw source body
- translatable text
- send/update timestamps
- metadata for audit/debug output

The DTO should also carry an opaque source snapshot for audit use so downstream code can keep
debugging visibility without depending on Chatwork-specific fields for business logic.

## Inbound Flow

New inbound flow:

1. `webhook-logger` receives raw request body and webhook headers.
2. `verifyWebhookSignature(...)` validates `X-ChatWorkWebhookSignature` against the raw body.
3. If valid, the raw body is parsed and normalized with `normalizeWebhookPayload(...)`.
4. `mapWebhookToTranslationCommand(...)` produces a neutral translator ingress DTO.
5. `webhook-logger` forwards the DTO to `translator`.
6. `translator` processes the DTO without knowledge of Chatwork webhook schemas.

Environment policy for verification:

- `production`: verification always required
- `development` and `local`: verification enabled by default, with explicit opt-out only
- `test`: verification supported with fixtures instead of hidden bypass behavior

## Outbound Flow

New outbound flow:

1. `translator` receives the neutral DTO.
2. `translator` composes the translated outbound message text.
3. When sender display data is needed, `translator` calls
   `resolveRoomMemberDisplayName(...)`, not `getRoomMembers(...)` directly.
4. `translator` sends the final message with `sendRoomMessage(...)`.
5. `dataset-runner` injects dataset messages with the same send use case.
6. Future cleanup/moderation flows can call `deleteRoomMessage(...)`.

This keeps Chatwork integration concerns inside the Chatwork package while preserving message
composition as translator-owned business behavior.

## Error Model

Outbound Chatwork use cases throw typed errors instead of returning a `Result` union.

Planned error types:

- `ChatworkApiError`
- `ChatworkRateLimitError`
- `ChatworkWebhookSignatureError`
- `ChatworkWebhookPayloadError`

The typed error model should include structured metadata where relevant:

- HTTP method
- endpoint path
- status and status text
- parsed Chatwork error messages
- rate-limit headers

Consumers catch and map these errors at their adapter layer:

- `webhook-logger` maps signature/payload errors to ingress responses and logs
- `translator` maps outbound failures to delivery metadata/logging
- `dataset-runner` maps outbound failures to retry and DLQ behavior

## Compatibility Requirements

Even though the translator moves to a neutral DTO, output and observability formats should stay
as close as practical to the current shapes.

Approved compatibility rules:

- preserve the current output/log format as much as possible
- keep source snapshot metadata available for audit/debug
- avoid breaking dataset correlation and existing operational inspection flows

This means internal contracts change first, while output files and key log fields remain largely
stable.

## Scope of API Expansion

The approved expansion scope is message-centered rather than “entire Chatwork API”.

v1 focus:

- inbound webhook verification/normalization/mapping
- send room messages
- delete room messages
- read room message(s)
- get room members
- resolve member display names
- typed errors and rate-limit metadata

Out of scope for v1 unless implementation reveals a hard dependency:

- contacts APIs
- tasks APIs
- files APIs
- broader room management beyond current message-centric needs

## Testing Strategy

Testing is split by boundary.

### `@chatwork-bot/chatwork`

- unit tests for signature verification
- unit tests for payload normalization and mapping
- unit tests for typed error construction
- unit tests for rate-limit header parsing
- outbound API tests for send/delete/get/list message flows
- tests for member lookup and display-name resolution

### `@chatwork-bot/webhook-logger`

- route tests for raw-body signature success/failure
- route tests for invalid payload handling
- route tests for forwarding the neutral DTO to translator

### `@chatwork-bot/translator`

- replace Chatwork webhook-based tests with neutral DTO tests
- verify translation flow still produces equivalent delivery/output behavior
- verify translator uses Chatwork intent use cases instead of raw Chatwork contracts

### `@chatwork-bot/dataset-runner`

- replace direct client usage with send-message use-case mocks
- preserve retry and failure handling semantics

## Migration Rules

- remove Chatwork-specific code from `core` in the same refactor
- do not keep temporary compatibility re-exports in `core`
- use workspace package imports only
- keep intra-package imports on `~/`
- preserve strict typing and avoid `any`

## Expected Affected Areas

- `packages/core/src/index.ts`
- `packages/core/src/types/`
- `packages/core/src/interfaces/`
- `packages/core/src/chatwork/`
- `packages/webhook-logger/src/routes/webhook.ts`
- `packages/translator/src/webhook/router.ts`
- `packages/translator/src/webhook/handler.ts`
- `packages/translator/src/services/chatwork-sender.ts`
- `packages/dataset-runner/src/services/item-processor.ts`
- `packages/dataset-runner/src/services/queue-runner.ts`
- new package: `packages/chatwork/`

## Success Criteria

The refactor is complete when:

- all Chatwork-specific logic lives in `@chatwork-bot/chatwork`
- `@chatwork-bot/core` no longer exports Chatwork contracts or clients
- `translator` depends on a neutral DTO instead of Chatwork webhook types
- `webhook-logger` performs real signature verification on raw request bodies
- message-related Chatwork use cases are exposed via intent-oriented APIs
- current delivery/output behavior remains materially intact
- the full verification suite passes:
  - `bun test`
  - `bun run typecheck`
  - `bun run lint`
