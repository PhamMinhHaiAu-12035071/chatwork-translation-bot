# Chatwork Structure Preservation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve portable Chatwork structure in translated destination messages, split source-only context into a separate metadata message, and support both `message_created` and `message_updated` without overwriting output records.

**Architecture:** Move Chatwork decoration parsing and rendering into `@chatwork-bot/chatwork`, extend the neutral ingress DTO with event identity and ordered translation inputs, and let `translator` orchestrate one structured translation call followed by two-stage delivery with partial-status handling.

**Tech Stack:** Bun workspaces, TypeScript ESM strict mode, Elysia, TypeBox, Zod, Bun test, ESLint, Prettier

---

> **Amendment (2026-03-25):** Nested quote handling is part of this work. The implementation must
> use per-node quote metadata/context, preserve nested quote depth recursively, render valid quote
> nodes with canonical `qtmeta`, and downgrade malformed/meta-less `qt` nodes to `[quote]`.

## Preconditions

- Read:
  - `docs/plans/2026-03-24-chatwork-structure-preservation-design.md`
  - `AGENTS.md`
  - `ai_rules/project-structure.md`
  - `ai_rules/type-organization.md`
  - `ai_rules/export-patterns.md`
  - `ai_rules/test-colocation.md`
  - `ai_rules/architecture-patterns.md`
  - `ai_rules/security.md`
- Execute in a dedicated git worktree before touching implementation code.

## Confirmed decisions

- Support `message_created` and `message_updated`
- `message_updated` creates a new destination pair
- `message 1` is metadata/context
- `message 2` preserves portable source structure
- Translate quote body and current body
- Preserve nested quotes recursively with no fixed depth cap
- Do not mirror raw source `qtmeta` payloads verbatim; re-render valid quote nodes canonically
- Downgrade malformed/meta-less `qt` nodes to `[quote]`
- Preserve `[code]...[/code]` exactly
- Move source-dependent tags to metadata message
- Use sender/room names when possible, with fallback to raw IDs
- If metadata succeeds and body fails, retry body only and persist `partial`

### Task 1: Extend neutral ingress contract for event identity and segment inputs

**Files:**

- Modify: `packages/core/src/types/translation-ingress.ts`
- Modify: `packages/core/src/types/translation-ingress.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/translator/src/webhook/router.test.ts`

**Step 1: Write the failing DTO test**

Add assertions that `TranslationIngressCommand` now requires:

- `sourceEventId`
- `sourceEventType`
- `translationInputs`

**Step 2: Run the focused test**

Run: `bun test packages/core/src/types/translation-ingress.test.ts`
Expected: FAIL because the new fields are missing.

**Step 3: Implement the neutral DTO changes**

Update `TranslationIngressCommandSchema` and type with:

```ts
sourceEventId: t.String()
sourceEventType: t.String()
translationInputs: t.Array(t.String())
```

Keep `audit.rawSourceSnapshot` as `Record<string, unknown>`.

**Step 4: Export the updated contract**

Update `packages/core/src/index.ts` if export wiring changes are needed.

**Step 5: Fix the translator route-schema test**

Update `packages/translator/src/webhook/router.test.ts` fixtures so they satisfy the new DTO.

**Step 6: Re-run the focused tests**

Run:

- `bun test packages/core/src/types/translation-ingress.test.ts`
- `bun test packages/translator/src/webhook/router.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/core/src/types/translation-ingress.ts packages/core/src/types/translation-ingress.test.ts packages/core/src/index.ts packages/translator/src/webhook/router.test.ts
git commit -m "feat(core): extend ingress contract for structured chatwork translation"
```

### Task 2: Support `message_updated` and add stable per-event identity

**Files:**

- Modify: `packages/chatwork/src/types/webhook.ts`
- Modify: `packages/chatwork/src/types/webhook.test.ts`
- Modify: `packages/chatwork/src/services/normalize-webhook-payload.ts`
- Modify: `packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- Modify: `packages/chatwork/src/services/map-webhook-to-translation-command.ts`
- Modify: `packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

**Step 1: Write failing webhook tests**

Add cases for:

- `message_updated` payload normalization
- rejection of unsupported events other than `message_created` and `message_updated`
- `sourceEventId` uniqueness between created and updated payloads for the same `message_id`
- mapping of `sourceEventType`

**Step 2: Run the focused tests**

Run:

- `bun test packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- `bun test packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

Expected: FAIL.

**Step 3: Update webhook schema and normalization**

Change `webhook_event_type` to:

```ts
t.Union([t.Literal('message_created'), t.Literal('message_updated')])
```

Normalization must accept both supported values and still reject others.

**Step 4: Add per-event identity in the mapper**

Derive:

```ts
const sourceEventId = `${event.message_id}:${payload.webhook_event_type}:${payload.webhook_event_time}`
```

Map:

- `sourceEventId`
- `sourceEventType`

Leave `translationInputs` temporarily as a single-element array containing the stripped text until
Task 3 lands.

**Step 5: Re-run the focused tests**

Run:

- `bun test packages/chatwork/src/services/normalize-webhook-payload.test.ts`
- `bun test packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

Expected: PASS.

**Step 6: Run the regression suite before committing**

Run: `bun test`
Expected: PASS — confirms the temporary single-element `translationInputs` stub does not break
current downstream behavior before Task 3 replaces it with the real extractor output.

**Step 7: Commit**

```bash
git add packages/chatwork/src/types/webhook.ts packages/chatwork/src/types/webhook.test.ts packages/chatwork/src/services/normalize-webhook-payload.ts packages/chatwork/src/services/normalize-webhook-payload.test.ts packages/chatwork/src/services/map-webhook-to-translation-command.ts packages/chatwork/src/services/map-webhook-to-translation-command.test.ts
git commit -m "feat(chatwork): support updated events and per-event identity"
```

### Task 3: Parse Chatwork message structure into translation inputs and a render snapshot

**Files:**

- Create: `packages/chatwork/src/types/message-decoration.ts`
- Create: `packages/chatwork/src/services/parse-message-decoration.ts`
- Create: `packages/chatwork/src/services/parse-message-decoration.test.ts`
- Create: `packages/chatwork/src/services/build-message-translation-source.ts`
- Create: `packages/chatwork/src/services/build-message-translation-source.test.ts`
- Modify: `packages/chatwork/src/services/map-webhook-to-translation-command.ts`
- Modify: `packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

**Step 1: Write failing parser tests**

Cover these cases:

- plain text message
- `[info][title]...[/title]...[/info]`
- `[code]...[/code]` remains opaque literal content
- `[qt][qtmeta ...][/qtmeta]...[/qt]`
- `[To:]`, `[cc:]`, `[rp ...]` are extracted as metadata hints, not body translation slots
- deferred tags such as `[picon:...]`, `[pname]`, and `[piconname:...]` are tolerated as literal
  text in v1
- unsupported non-canonical variants such as attribute-bearing mention forms are treated as literal
  text in v1
- unknown or malformed tags are tolerated as literals

**Step 2: Write failing translation-source tests**

Cover:

- `translationInputs` preserve order
- `translatableText` is the joined visible text
- zero-input case for literal-only content such as pure code block
- raw payload snapshot still survives under `audit.rawSourceSnapshot`
- structured snapshot is embedded under `audit.rawSourceSnapshot`

**Step 3: Run the focused tests**

Run:

- `bun test packages/chatwork/src/services/parse-message-decoration.test.ts`
- `bun test packages/chatwork/src/services/build-message-translation-source.test.ts`
- `bun test packages/chatwork/src/services/map-webhook-to-translation-command.test.ts`

Expected: FAIL.

**Step 4: Implement the parser**

Create a tolerant parser with these concepts:

- literal chunk
- translation slot
- code block literal
- quote wrapper
- metadata hint

Do not throw on malformed markup unless the input is fundamentally unusable. Unknown tags should
fall back to literal text.

**Step 5: Implement translation-source extraction**

`build-message-translation-source.ts` should return:

- `translationInputs: string[]`
- `translatableText: string`
- structured snapshot for later rendering

**Step 6: Wire the mapper to the new extractor**

`mapWebhookToTranslationCommand(...)` should:

- stop using regex stripping as the source of truth
- populate `translationInputs` from the extractor
- set `translatableText` from the extractor
- set `audit.rawSourceSnapshot` to an envelope like:

```ts
{
  webhookPayload: payload,
  decorationSnapshot: snapshot,
}
```

**Step 7: Re-run the focused tests**

Run the same three test commands from Step 3.
Expected: PASS.

**Step 8: Commit**

```bash
git add packages/chatwork/src/types/message-decoration.ts packages/chatwork/src/services/parse-message-decoration.ts packages/chatwork/src/services/parse-message-decoration.test.ts packages/chatwork/src/services/build-message-translation-source.ts packages/chatwork/src/services/build-message-translation-source.test.ts packages/chatwork/src/services/map-webhook-to-translation-command.ts packages/chatwork/src/services/map-webhook-to-translation-command.test.ts
git commit -m "feat(chatwork): parse message decoration into structured translation source"
```

### Task 4: Add room lookup and room-name resolution helpers

**Files:**

- Create: `packages/chatwork/src/types/room.ts`
- Modify: `packages/chatwork/src/interfaces/chatwork-api.ts`
- Modify: `packages/chatwork/src/http/chatwork-api-client.ts`
- Modify: `packages/chatwork/src/http/chatwork-api-client.test.ts`
- Create: `packages/chatwork/src/services/get-room.ts`
- Create: `packages/chatwork/src/services/get-room.test.ts`
- Create: `packages/chatwork/src/services/resolve-room-display-name.ts`
- Create: `packages/chatwork/src/services/resolve-room-display-name.test.ts`
- Modify: `packages/chatwork/src/index.ts`

**Step 1: Write failing HTTP-client tests**

Add a case for `GET /rooms/{room_id}` that returns a room object with `room_id` and `name`.

**Step 2: Write failing service tests**

Cover:

- `getRoom(...)` delegates to the client
- `resolveRoomDisplayName(...)` returns room name
- fallback is `Room #<roomId>` on not found or lookup failure
- room-name cache is reused inside a request

**Step 3: Run the focused tests**

Run:

- `bun test packages/chatwork/src/http/chatwork-api-client.test.ts`
- `bun test packages/chatwork/src/services/get-room.test.ts`
- `bun test packages/chatwork/src/services/resolve-room-display-name.test.ts`

Expected: FAIL.

**Step 4: Implement room types, client, and services**

Add `getRoom(roomId, token)` to the internal client and public package surface.

`resolveRoomDisplayName(...)` should mirror the member-display helper pattern and never throw when
fallback is possible.

**Step 5: Re-run the focused tests**

Run the same three commands from Step 3.
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/chatwork/src/types/room.ts packages/chatwork/src/interfaces/chatwork-api.ts packages/chatwork/src/http/chatwork-api-client.ts packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/get-room.ts packages/chatwork/src/services/get-room.test.ts packages/chatwork/src/services/resolve-room-display-name.ts packages/chatwork/src/services/resolve-room-display-name.test.ts packages/chatwork/src/index.ts
git commit -m "feat(chatwork): add room lookup and display-name resolution"
```

### Task 5: Add structured segment translation prompt support

**Files:**

- Modify: `packages/translation-prompt/src/schemas/review.schema.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/index.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`
- Modify: `packages/translator/src/pipeline/pipeline.ts`
- Modify: `packages/translator/src/pipeline/pipeline.test.ts`

**Step 1: Write failing prompt tests**

Add coverage for a structured prompt builder that:

- accepts `string[]`
- instructs the model to preserve array length and order
- returns JSON with `translatedSegments`

Add schema tests for:

- valid `{ sourceLang, translatedSegments }`
- empty array rejection
- segment-count mismatch detection in pipeline-level tests
- segment-count mismatch raises `TranslationError('INVALID_RESPONSE')` and does not trigger any
  delivery fallback

**Step 2: Run the focused tests**

Run:

- `bun test packages/translation-prompt/src/translation-prompt.test.ts`
- `bun test packages/translator/src/pipeline/pipeline.test.ts`

Expected: FAIL.

**Step 3: Implement structured prompt support**

Recommended shape:

```ts
const StructuredTranslationDraftSchema = z.object({
  sourceLang: z.string().min(1),
  translatedSegments: z.array(z.string().min(1)),
})
```

Add a new builder rather than replacing the plain-text builder:

- `buildSingleCallPrompts(text: string)`
- `buildStructuredTranslationPrompts(segments: string[])`

**Step 4: Update the pipeline**

Add a structured execution path:

- `translationInputs.length === 0`
  - skip LLM
  - return `translatedSegments: []`
- `translationInputs.length === 1`
  - call existing plain-text prompt path
  - wrap result as one translated segment
- `translationInputs.length > 1`
  - call structured prompt path
  - validate segment-count equality before returning

Keep `TranslationResult` unchanged in `core`. Use a translator-local pipeline result that carries:

- `translation: TranslationResult`
- `translatedSegments: string[]`

If the structured response length does not equal `translationInputs.length`, throw
`TranslationError('Translation segment count mismatch', 'INVALID_RESPONSE')` and stop before any
delivery call sites run.

**Step 5: Re-run the focused tests**

Run the same two commands from Step 2.
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/translation-prompt/src/schemas/review.schema.ts packages/translation-prompt/src/translation-prompt.ts packages/translation-prompt/src/index.ts packages/translation-prompt/src/translation-prompt.test.ts packages/translator/src/pipeline/pipeline.ts packages/translator/src/pipeline/pipeline.test.ts
git commit -m "feat(translator): add structured segment translation pipeline"
```

### Task 6: Compose the metadata message and translated body inside `@chatwork-bot/chatwork`

**Files:**

- Create: `packages/chatwork/src/services/compose-translated-message-pair.ts`
- Create: `packages/chatwork/src/services/compose-translated-message-pair.test.ts`
- Modify: `packages/chatwork/src/index.ts`

**Step 1: Write failing composition tests**

Cover:

- metadata message includes event type, sender, room, send/update time
- `To` / `cc` names appear in metadata message instead of message 2
- quote metadata appears as `Quote 1: ...`, `Quote 2: ...` lines ordered outer -> inner
- valid nested quotes render recursively with canonical `qtmeta`
- malformed/meta-less `qt` nodes downgrade to `[quote]` without flattening the whole chain
- metadata uses the shared `YYYY-MM-DD HH:mm` UTC formatter
- body message preserves `[info]`, `[title]`, `[hr]`, quote wrappers, and `[code]`
- code content remains byte-for-byte identical
- source-dependent tags nested inside quotes are absent from message 2 and appear on the correct
  quote-summary line in metadata
- fallback names use `#account_id` and `Room #roomId`
- zero-input code-only body renders message 2 directly from preserved literal structure with no
  extra wrapper added

**Step 2: Run the focused test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`
Expected: FAIL.

**Step 3: Implement composition**

`composeTranslatedMessagePair(...)` should:

- read the structured snapshot from `command.audit.rawSourceSnapshot`
- resolve sender, quoted sender, and room display names
- build a compact metadata message
- rebuild the translated body from literal chunks and `translatedSegments`
- summarize quote metadata per node instead of via a single global quote field
- render nested quotes recursively instead of consuming quote metadata globally

Recommended signature:

```ts
function composeTranslatedMessagePair(
  command: TranslationIngressCommand,
  params: {
    translatedSegments: string[]
    apiToken: string
    memberCache?: Map<number, string>
    roomCache?: Map<number, string>
  },
): Promise<{ metadataMessage: string; bodyMessage: string }>
```

Resolver caching should follow the existing stateless pattern in this repo:

- create fresh `Map` instances in request-scoped orchestration
- pass them through function parameters
- do not introduce module-level caches or service classes for this feature

**Step 4: Re-run the focused test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/chatwork/src/services/compose-translated-message-pair.ts packages/chatwork/src/services/compose-translated-message-pair.test.ts packages/chatwork/src/index.ts
git commit -m "feat(chatwork): compose metadata and translated body message pair"
```

### Task 7a: Update output persistence and delivery record shape

**Files:**

- Modify: `packages/translator/src/types/output.ts`
- Modify: `packages/translator/src/utils/output-writer.ts`
- Modify: `packages/translator/src/utils/output-writer.test.ts`

**Step 1: Write failing output tests**

Add cases for:

- `OutputDelivery.status` accepts `partial`
- delivery stores per-message details
- output file path uses `command.sourceEventId`
- rewritten output still preserves existing `command`, `translation`, and `origin` fields

**Step 2: Run the focused tests**

Run:

- `bun test packages/translator/src/utils/output-writer.test.ts`

Expected: FAIL.

**Step 3: Implement the output changes**

In `packages/translator/src/types/output.ts`:

- extend `OutputDelivery.status` to `sent | partial | failed`
- replace single-message fields with per-message delivery records

In `packages/translator/src/utils/output-writer.ts`:

- write output files as `{sourceEventId}.json`

**Step 4: Re-run the focused tests**

Run:

- `bun test packages/translator/src/utils/output-writer.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/types/output.ts packages/translator/src/utils/output-writer.ts packages/translator/src/utils/output-writer.test.ts
git commit -m "feat(translator): persist delivery records by source event id"
```

### Task 7b: Update sender delivery to two-stage message-pair semantics

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.ts`
- Modify: `packages/translator/src/services/chatwork-sender.test.ts`

**Step 1: Write failing sender tests**

Add cases for:

- two sends on success: metadata first, body second
- metadata success + body failure => `partial`
- metadata is not resent after a successful first-stage send
- zero `translationInputs` skips LLM but still delivers when the body has literal structure
- metadata message is not treated as a full success if body stage fails

**Step 2: Run the focused tests**

Run:

- `bun test packages/translator/src/services/chatwork-sender.test.ts`

Expected: FAIL.

**Step 3: Implement the sender changes**

In `chatwork-sender.ts`:

- replace wrapper-building logic with `composeTranslatedMessagePair(...)`
- send metadata and body as separate stages
- preserve existing retry classification
- retry body stage independently after metadata success
- return:
  - `sent` when both stages succeed
  - `partial` when metadata succeeds and body fails
  - `failed` otherwise

**Step 4: Re-run the focused tests**

Run:

- `bun test packages/translator/src/services/chatwork-sender.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/services/chatwork-sender.ts packages/translator/src/services/chatwork-sender.test.ts
git commit -m "feat(translator): send chatwork metadata and body as two-stage delivery"
```

### Task 7c: Wire handler, observability, and dataset ACK behavior

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`
- Modify: `packages/translator/src/types/observability.ts`
- Modify: `packages/translator/src/services/phase-observer.ts`
- Modify: `packages/translator/src/services/phase-observer.test.ts`
- Modify: `packages/translator/src/services/translator-status-store.ts`
- Modify: `packages/translator/src/services/translator-status-store.test.ts`
- Modify: `packages/translator/src/services/dataset-runner-callback-client.ts`
- Modify: `packages/translator/src/services/dataset-runner-callback.test.ts`

**Step 1: Write failing handler and observability tests**

Add coverage for:

- recent results and logs can store `deliveryStatus: 'partial'`
- dataset-runner callback maps `partial` to terminal `failed`
- zero `translationInputs` skips LLM but still delivers when the body has literal structure
- translation-validation failures stop before any delivery begins

**Step 2: Run the focused tests**

Run:

- `bun test packages/translator/src/webhook/handler.test.ts`
- `bun test packages/translator/src/services/phase-observer.test.ts`
- `bun test packages/translator/src/services/translator-status-store.test.ts`
- `bun test packages/translator/src/services/dataset-runner-callback.test.ts`

Expected: FAIL.

**Step 3: Implement the wiring changes**

In `handler.ts`:

- consume the structured pipeline result
- remove the current `translatableText.trim() === ''` early-return shortcut
- instead skip only when there is no translatable text and no meaningful literal structure to send

Use this v1 rule for `meaningful literal structure`:

- send when the preserved snapshot would still render at least one visible non-empty element such
  as `[hr]`, a non-empty code block, a non-empty quote block, or non-whitespace literal text
- skip when the remaining body would be only whitespace, empty wrappers, or tags moved entirely
  into metadata

In dataset ACK mapping:

- convert `partial` to callback payload status `failed`
- use `errorCode: 'PARTIAL_DELIVERY'`

**Step 4: Re-run the focused tests**

Run the same four commands from Step 2.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/webhook/handler.ts packages/translator/src/webhook/handler.test.ts packages/translator/src/types/observability.ts packages/translator/src/services/phase-observer.ts packages/translator/src/services/phase-observer.test.ts packages/translator/src/services/translator-status-store.ts packages/translator/src/services/translator-status-store.test.ts packages/translator/src/services/dataset-runner-callback-client.ts packages/translator/src/services/dataset-runner-callback.test.ts
git commit -m "feat(translator): wire partial delivery and ack handling"
```

### Task 8: Add end-to-end regressions across webhook ingress and translator app

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/webhook-logger/src/app.test.ts`
- Modify: `packages/translator/src/app.test.ts`

**Step 1: Write failing integration-style tests**

Cover:

- webhook accepts `message_updated`
- existing `message_created` flow still produces the expected two-message output
- mapped command forwarded to translator includes:
  - `sourceEventId`
  - `sourceEventType`
  - `translationInputs`
- translator app accepts the enriched command schema

**Step 2: Run the focused tests**

Run:

- `bun test packages/webhook-logger/src/routes/webhook.test.ts`
- `bun test packages/webhook-logger/src/app.test.ts`
- `bun test packages/translator/src/app.test.ts`

Expected: FAIL.

**Step 3: Update fixtures and assertions**

Adjust webhook and translator test payloads so they reflect the enriched ingress DTO and supported
event set.

**Step 4: Re-run the focused tests**

Run the same three commands from Step 2.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/webhook-logger/src/routes/webhook.test.ts packages/webhook-logger/src/app.test.ts packages/translator/src/app.test.ts
git commit -m "test(repo): cover structure-preserving chatwork translation flow"
```

## Final verification

Run:

- `bun test`
- `bun run typecheck`
- `bun run lint`

Expected:

- all tests pass
- no TypeScript errors
- no ESLint violations

## Notes for the implementer

- Do not reintroduce Chatwork markup parsing into `translator`.
- Do not preserve raw source-member tags in message 2.
- Do not translate code blocks.
- Do not let `message_updated` overwrite existing output JSON.
- Do not silently collapse `partial` into `sent`.
