# Kagi Free Provider Integration — Revised Design Spec

**Version:** 1.2
**Date:** 2026-04-01
**Prepared by:** AI-assisted (Codex)
**Status:** Revised after architecture and rate-limit review

---

## Objective

Integrate Kagi FastTranslate as a new "Free Room" capability into the
chatwork-translation-bot monorepo without weakening the guarantees that the
current Standard Room flow already provides.

The approved direction is:

- Keep Standard Rooms and Free Rooms as separate configuration domains.
- Keep `1 originalRoomId -> 1 standard room + 1 free room` valid.
- Make Free Room translation preserve message structure exactly like Standard
  Rooms.
- Make keyword protection flow match Standard Rooms 100%, with the only runtime
  difference being which translation backend receives the masked text.
- Introduce a translator-local abstraction so the high-level translation flow
  depends on an interface, not on concrete OpenAI/Gemini/Kagi details.
- Keep Kagi traffic low by preferring one translation request per message in the
  normal path, not one request per segment.
- Fail closed when exact format preservation cannot be proven.
- Keep the new Free Room dashboard UI as close as possible to the current
  Standard Room UI/UX.

---

## User-Validated Requirements

The following requirements are explicitly locked by the user:

1. A single Chatwork source room may have both:
   - one Standard Room config
   - one Free Room config
2. Free Room output must preserve the same original message structure that the
   current Standard flow preserves, including:
   - quote blocks
   - `[hr]`
   - reply markers
   - `qtmeta`
   - whitespace-sensitive literal slots
3. Protected keyword handling must match Standard Rooms 100%:
   - mask before backend call
   - restore after backend call
   - identical regex and placeholder behavior
4. Context/style semantics may differ per backend, but the orchestration flow
   around them must be abstract and uniform.
5. Free Room runtime must avoid an implementation that amplifies Kagi requests
   linearly with segment count in the common path.
6. Free Room UI/UX must stay very close to the existing dashboard experience.
7. If translated output cannot be proven to preserve the original message format,
   the translation must be treated as failed and must not be delivered.
8. Failure logs should be detailed enough to diagnose decode, anti-abuse,
   timeout, retry, and delivery issues.
9. Anonymous best-effort Kagi usage is acceptable.
10. Free-side failures must remain isolated from Standard-side behavior.
11. If a Free payload is too large or too complex for the approved transport
    path, the system should fail fast with a detailed error instead of trying to
    degrade correctness.
12. Delivery must be atomic with respect to format validation: no outbound
    message should be sent until format integrity checks are fully passed.
13. Logging should stay privacy-conscious while remaining highly diagnosable.
14. Mixed-language, emoji, unusual Unicode, and malformed markup should be
    tolerated as well as the current Standard parser allows.
15. Backward compatibility is a hard requirement.

---

## Non-Goals

- Replacing or redesigning the existing Standard Room config model
- Merging Standard and Free configs into one JSON file
- Forcing Kagi to implement the existing `ProviderPlugin` / `ILLMExecutor`
  contract in `@chatwork-bot/core`
- Changing Chatwork message rendering logic in `@chatwork-bot/chatwork`
- Introducing a new visual language for Free Room pages
- Adding speaker/addressee gender controls to the Free Room UI
- Changing the Standard Room route shapes, request bodies, or file format

---

## Core Decisions

### DEC-001: Separate storage stays

Standard and Free rooms remain separate stores and separate JSON files:

```text
data/room-configs.json
data/free-room-configs.json
```

This keeps backward compatibility high and preserves the current Standard Room
file format unchanged.

### DEC-002: Shared orchestration, separate backends

The translator package will own a new shared orchestration layer that contains
the room-agnostic translation flow. Standard and Free handlers become thin
wrappers that resolve room config, pick a backend adapter, and call the shared
flow.

High-level policy becomes common; provider execution stays specialized.

### DEC-003: Structure preservation is non-negotiable

Free Rooms must not take a "whole message only" shortcut. They must preserve the
existing `translationInputs[] -> translatedSegments[] -> renderTemplate` contract
that Standard Rooms already rely on.

This means Free Rooms must reuse the existing delivery stack:

- `sendTranslatedMessage()`
- `composeTranslatedMessagePair()`
- `renderTemplate` from `audit.rawSourceSnapshot`

The system must continue to preserve:

- nested quotes
- reply tags
- `qtmeta`
- `hr`
- code blocks
- outer whitespace

### DEC-004: Keyword flow must be identical across room types

Keyword masking/restoration moves into the shared orchestration layer and runs
before the backend adapter is called and after it returns.

There must not be a Standard-only and Free-only interpretation of keyword
protection anymore.

### DEC-005: Abstraction is translator-local

The new unified abstraction lives inside `packages/translator`, not in
`packages/core`.

Reason:

- the current `ProviderPlugin` contract is LLM-oriented
- Kagi is browser/HTTP driven, not JSON-schema LLM execution
- forcing Kagi into the existing core plugin contract would create fake
  abstractions and higher coupling

The approved solution is a translator-local interface that both the Standard and
Free flows can use safely.

### DEC-006: Kagi uses one request per message in the happy path

The Free backend must not translate one segment per Kagi request in the normal
path.

Instead it will:

- encode all masked `translationInputs[]` into one deterministic marker-based
  payload
- send that payload to Kagi in a single request
- decode the translated payload back into `translatedSegments[]`

This keeps Kagi traffic low while preserving the existing
`translationInputs[] -> translatedSegments[] -> renderTemplate` contract.

### DEC-007: Sidecar pacing is mandatory

Because Kagi Translate publicly uses anti-abuse protections, the sidecar must
apply pacing and retry controls instead of firing browser requests as fast as
possible.

Minimum requirements:

- max in-flight Kagi translation request per sidecar process: `1`
- minimum delay between Kagi page navigations
- bounded exponential backoff with jitter for retryable failures
- explicit anti-abuse/captcha detection with graceful failure
- warm browser/page reuse instead of cold-launching per request
- request interception to avoid unnecessary assets that do not help extract the
  translated text

### DEC-008: Format integrity is fail-closed

The system must never deliver a Free Room translation when exact format
preservation cannot be proven.

The minimum proof strategy is:

- marker decode must recover the exact original segment count and ordering
- no reserved codec markers may remain in the decoded segments
- composing the final body through the original `renderTemplate` must succeed
- the composed body must pass a structural integrity check before delivery

If any check fails:

- mark the translation as failed
- log the exact failure reason
- do not send the translated body to the destination room

### DEC-009: Oversized payloads fail fast

The Kagi Free path uses a browser/web transport with encoded marker payloads.
Because correctness matters more than squeezing through rare huge messages, the
system should fail fast when the payload exceeds safe transport thresholds.

Recommended policy:

- compute size after marker encoding and before browser navigation
- reject payloads that exceed a conservative configurable threshold
- reject payloads with extreme segment counts even if character count is modest
- surface a typed error such as `PAYLOAD_TOO_LARGE`

Recommended defaults:

- `maxEncodedPayloadChars = 4000`
- `maxSegmentCount = 32`

These are engineering defaults, not business limits, and may be tuned later.

### DEC-010: Anonymous best-effort is the baseline

The design does not require a logged-in Kagi session.

The default operational mode is anonymous best-effort:

- work without account state when Kagi allows it
- detect anti-abuse/captcha responses explicitly
- fail gracefully rather than trying to bypass protections

Authenticated session reuse may be added later as an operational enhancement,
but it is not a dependency of this design.

### DEC-011: Free failures must stay isolated

Free Room errors must not block Standard Room processing for the same webhook.

Router dispatch and handler execution must remain isolated enough that:

- Free failure does not cancel Standard work
- Standard failure does not cancel Free work
- logs still preserve per-room-type failure attribution

### DEC-012: Delivery validation happens before any outbound send

For Free Rooms, all codec, decode, and format-integrity checks must happen
before the first Chatwork send call.

This means:

- validate decoded segments first
- compose the translated body
- run structure validation
- only after all of the above succeeds may metadata/body delivery begin

The normal transport retry behavior for Chatwork send failures may remain, but
format-validation failures must never result in metadata-only partial sends.

### DEC-013: Message-scoped UUID markers

The batch codec should use a message-scoped random token, for example UUIDv4,
inside marker names:

```text
[[CW_SEG_550e8400-e29b-41d4-a716-446655440000_0001]]
```

Benefits:

- collisions with natural user text become negligibly unlikely
- the decoder can match exact marker IDs for only that request
- unrelated user text that happens to resemble older markers is ignored

Additional rule:

- if the generated marker token already exists in the source payload, regenerate
  and retry a small bounded number of times before failing

### DEC-014: Backpressure is explicit

The sidecar queue must be bounded and observable.

Recommended default policy:

- in-flight translations per sidecar: `1`
- max queued requests: `10`
- max queue wait: `15000ms`
- max request timeout: `30000ms`
- min interval between Kagi navigations: `1500ms`
- max retries for retryable transport failures: `2`
- retry base backoff: `1000ms` with jitter

If the queue is full or queue wait budget is exceeded, fail fast with a typed
error such as `BACKPRESSURE_REJECTED` or `QUEUE_TIMEOUT`.

### DEC-015: Privacy-aware logging by default

Detailed logs are required, but raw user content should not be emitted by
default.

Recommended logging boundary:

- log counts, lengths, durations, status flags, hashes, IDs, and typed errors
- do not log raw source text
- do not log raw translated text
- do not log raw protected keywords
- do not log full room context bodies

If deeper content capture is ever needed for local debugging, it should be an
explicit opt-in development mode, off by default.

### DEC-016: Unicode tolerance is mandatory

The batch codec must be robust for:

- mixed-language input
- emoji
- NFC/NFD Unicode variations
- full-width punctuation
- malformed but parser-tolerable Chatwork markup

Recommended handling:

- normalize codec inputs to NFC for hashing/comparison only where needed
- keep literal translation content as opaque Unicode strings
- keep markers ASCII-only
- add tests for mixed-language and emoji-heavy inputs

---

## Proposed Runtime Abstraction

### `RoomTranslationBackend`

The translator package introduces a room-type-agnostic backend contract similar
to:

```typescript
interface RoomTranslationBackend<TRuntimeConfig = unknown> {
  readonly kind: 'standard' | 'free'

  translate(input: {
    cleanText: string
    translationInputs: string[]
    roomContext?: string
    keywordSystemHint?: string
    runtimeConfig: TRuntimeConfig
    phaseObserver?: TranslationPhaseObserver
  }): Promise<{
    sourceLang: string
    translatedText: string
    translatedSegments: string[]
    debug?: BackendDebugInfo
  }>
}
```

### Concrete adapters

- `StandardTranslationBackend`
  - wraps the existing `TranslationPipeline`
  - keeps current prompt + model + provider behavior
- `FreeTranslationBackend`
  - wraps `KagiClient`
  - encodes all masked segments into one marker-based payload
  - calls Kagi once per message in the happy path
  - decodes the translated payload back into ordered segments
  - returns `translatedSegments[]` with identical array length

### Why this satisfies DIP

The orchestration layer depends only on `RoomTranslationBackend`, while each
backend adapter owns the concrete behavior:

- OpenAI/Gemini details stay in the Standard adapter
- Kagi URL/query semantics stay in the Free adapter

The orchestration no longer cares whether the implementation is LLM-based or
browser-based.

---

## Shared Translation Flow

### New translator flow

```text
POST /internal/translate
  -> router dispatches both handlers in parallel
     -> handleTranslateRequest()      resolves Standard room
     -> handleFreeTranslateRequest()  resolves Free room

Each thin handler:
  -> resolve room config
  -> build room runtime
  -> pick backend adapter
  -> call runRoomTranslationFlow(...)

Shared flow:
  -> skip if room missing / disabled / effectively empty
  -> normalize context once
  -> mask protected keywords on cleanText and every translation input
  -> call backend.translate(...)
  -> verify translatedSegments length matches input length
  -> restore placeholders on translated text and every translated segment
  -> write output record
  -> sendTranslatedMessage(...)
  -> trigger dataset ACK when applicable
```

### Required invariants

The shared flow is responsible for these invariants for both Standard and Free:

- same empty-message skip rules
- same keyword mask/restore rules
- same segment-count validation
- same structure-preserving delivery path
- same dataset ACK behavior
- same high-level observability lifecycle

### Standard backend behavior

Standard backend keeps these semantics:

- `translationStyle` drives prompt style selection
- `roomContext` is injected into `@chatwork-bot/translation-prompt`
- keyword placeholder instructions are passed as `keywordSystemHint`

### Free backend behavior

Free backend keeps these semantics:

- `kagiStyle` maps to Kagi URL/query behavior
- `roomContext` becomes Kagi `context`
- masked segments are encoded into one Kagi request and decoded back into an
  ordered segment array
- Kagi request pacing/backoff is handled outside the orchestrator
- anti-abuse detection is surfaced as a typed backend failure, not as a silent
  empty translation

The orchestration is shared; only the inside of `backend.translate()` differs.

### Kagi batch codec strategy

Free backend builds a deterministic payload from `translationInputs[]` using
non-natural ASCII markers, for example:

```text
[[CW_SEG_0001]]
Agenda
[[/CW_SEG_0001]]

[[CW_SEG_0002]]
Please review
[[/CW_SEG_0002]]
```

The translated response is then parsed by the same markers to recover
`translatedSegments[]`.

This preserves the segment contract without multiplying request count by the
number of segments.

The decoder must be strict:

- exact marker IDs only
- exact segment count recovery only
- no missing or duplicate markers
- no reserved marker residue in final decoded segments
- regenerate request-scoped UUID markers if a collision is detected pre-encode

---

## Structure Preservation Strategy

This section directly addresses the user's Q2 requirement.

### Current guarantee to preserve

The current Standard flow works well because it does not send an already-rendered
Chatwork message body directly to delivery. Instead it:

1. translates `translationInputs[]`
2. receives `translatedSegments[]`
3. rebuilds the Chatwork output through `renderTemplate`

That design must remain the only way both room types send output.

### Free Room rule

Free Room translation must therefore obey all of the following:

- never bypass `translationInputs[]`
- never flatten multiple segments into an opaque full-message translation result
- may batch multiple segments into one encoded Kagi request, as long as they are
  decoded back into the same ordered segment array
- never bypass `composeTranslatedMessagePair()`
- never compose a custom message body outside the existing Chatwork renderer

### Consequence

If a source message contains quote/reply/hr/code structure, Free Rooms will keep
it because they reuse the same render path that already handles it correctly.

### Format integrity guard

To turn this expectation into an enforced business rule, the final translated
body should be validated before delivery.

Recommended guard:

1. compose the translated body from the original `renderTemplate`
2. parse the composed body back into a normalized structure
3. compare its structure signature against the original message signature
4. fail delivery if the signatures differ

This specifically protects against:

- broken marker decoding
- unexpected markup injection inside translated literal segments
- malformed reconstructed output

### Delivery atomicity rule

All of the following must finish successfully before the first outbound Chatwork
message is sent:

- decode validation
- segment count validation
- marker residue validation
- body composition
- structure integrity validation

If any of them fails, the translation attempt is recorded as failed and delivery
does not begin.

---

## Keyword Protection Parity

This section directly addresses the user's Q3 requirement.

### Locked flow

Both Standard and Free must use this exact high-level sequence:

```text
ingress message
  -> normalize clean text + translationInputs
  -> regex mask protected keywords
  -> send masked payload to backend
  -> receive translated masked payload
  -> regex restore protected keywords
  -> send to destination room
```

### What must be shared

The following logic must be shared code, not duplicated:

- keyword regex construction
- placeholder generation
- masking for `cleanText`
- masking for every `translationInputs[]` element
- restoration for `translatedText`
- restoration for every `translatedSegments[]` element

### What may differ

Only this step may differ:

- "send masked payload to backend"

Everything before and after that step must behave identically.

### Rate-limit posture

The shared flow remains identical, but the Free backend and Kagi sidecar add
transport controls that Standard does not need:

- one-request-per-message happy path
- sidecar request serialization
- minimum inter-request delay
- bounded retry with jitter
- anti-abuse/captcha detection

These protections are transport concerns, not orchestration differences.

### Transport optimization strategy

The approved transport strategy for the sidecar is:

- keep a warm browser/session alive across requests
- keep a warm page alive when healthy
- serialize translation work through one in-process queue
- cap queue length and queue wait budget
- apply a minimum delay between navigations
- abort clearly unnecessary network requests where safe
- retry only bounded retryable failures
- restart the browser/page on unhealthy states instead of continuing in a bad
  session

This is an engineering inference based on Kagi's anti-abuse posture and on
browser-automation capabilities; it is not claimed as a Kagi-documented rate
limit contract.

### Recommended thresholds

The design recommends these starting defaults:

- `maxEncodedPayloadChars = 4000`
- `maxSegmentCount = 32`
- `maxQueueDepth = 10`
- `maxQueueWaitMs = 15000`
- `requestTimeoutMs = 30000`
- `minIntervalMs = 1500`
- `maxRetries = 2`
- `retryBaseMs = 1000`

---

## Configuration Model

### Standard config

`RoomConfig` stays unchanged for backward compatibility.

### Free config

`FreeRoomConfig` mirrors Standard Room routing metadata as much as possible:

- `id`
- `originalRoomId`
- `destinationRoomId`
- `destinationRoomName`
- `context`
- `protectedKeywords`
- `enabled`
- `createdAt`
- `updatedAt`

Provider-specific fields remain separate:

- Standard: `aiProvider`, `aiModel`, `translationStyle`, `encryptedAiApiToken`
- Free: `kagiStyle`

### Context length

To avoid breaking Standard Rooms, context length limits stay:

- Standard: max 500
- Free: max 100

This difference is accepted by the user as long as the handling mechanism stays
correct and abstract.

### Same original room in both stores

Duplicate `originalRoomId` is still forbidden inside one store, but valid across
the two different stores:

- Standard store may contain `424846369`
- Free store may also contain `424846369`

That is the approved behavior.

---

## API Surface

### Standard routes

All current Standard routes remain unchanged.

### Free routes

Free routes must mirror the current Standard route style closely:

```text
GET    /api/free-rooms
GET    /api/free-rooms/:id
POST   /api/free-rooms
PUT    /api/free-rooms/:id
DELETE /api/free-rooms/:id
POST   /api/free-rooms/:id/enable
POST   /api/free-rooms/:id/disable
```

Response envelope should match Standard routes:

```json
{ "success": true, "data": ... }
```

This keeps dashboard data access patterns symmetric.

---

## Dashboard Design

### UX target

Free Room pages should feel like a close sibling of the existing Standard Room
pages, not like a separate product.

### Reuse rules

Free pages must reuse the existing dashboard language:

- same `PageShell`
- same `BrutalCard`
- same section order
- same action placement
- same toasts
- same optimistic enable/disable behavior
- same context and keyword widgets
- same sidebar/navigation patterns

### Intentional UI differences

Only these differences should be visible:

- provider is fixed to "Free" and visually disabled
- API token input is absent
- style options are Kagi presets
- context helper note explains Kagi hint semantics
- context limit is 100 instead of 500

### Required shared-component adjustments

To keep UI parity without hacks, the following shared component improvements are
part of the design:

- `ContextField` becomes configurable:
  - `maxLength?: number`
  - `note?: string`
- `KeywordProtectionField` stops importing Standard-only schema types and accepts
  a shared structural keyword value type
- `BrutalSelect` must honor `disabled` visually and behaviorally

These changes help Free pages stay visually close to Standard pages while still
using the real shared components.

---

## Logging, Output, and Observability

### Shared policy

Free Rooms must not silently drop the observability guarantees that Standard
Rooms already have.

The shared orchestration continues to own:

- lifecycle logs
- output writing
- delivery status recording
- dataset ACK callbacks

### Room type tagging

Logs should distinguish room type where useful:

- `roomType: 'standard'`
- `roomType: 'free'`

This is additive observability, not behavioral branching.

### Detailed failure logging

The revised design now explicitly requires high-detail structured logs for Free
transport and decode failures, including fields such as:

- `traceId`
- `roomType`
- `backendKind`
- `failureStage`
- `queueWaitMs`
- `requestAttempt`
- `retryBackoffMs`
- `transportLatencyMs`
- `decodeStatus`
- `formatIntegrityStatus`
- `antiAbuseDetected`
- `errorCode`
- `errorMessage`
- `payloadCharCount`
- `segmentCount`
- `payloadSha256`

The goal is diagnosis quality, not just pass/fail counters.

### Debug metadata

Standard outputs may continue to include prompt/model metadata.
Free outputs may include lighter backend metadata such as:

- backend kind
- Kagi style
- context present/absent

Prompt-specific LLM debug data is not required for Free Rooms.

---

## Backward Compatibility Strategy

The revised design explicitly optimizes for non-breaking rollout.

### Unchanged

- `RoomConfig`
- `RoomConfigStore`
- Standard CRUD endpoints
- existing Standard dashboard routes
- existing Chatwork render/delivery code
- existing provider plugin registration model

### Additive

- `FreeRoomConfig`
- `FreeRoomConfigStore`
- `/api/free-rooms` endpoints
- Kagi sidecar package
- provider-kagi package
- translator-local backend abstraction
- thin free handler
- free dashboard routes/pages

### Controlled refactor

The only refactor with regression risk is moving Standard and Free into a shared
orchestration layer. That refactor is justified because it is the mechanism that
guarantees:

- structure preservation parity
- keyword protection parity
- abstraction consistency

The mitigation is to codify Standard behavior in tests before extracting logic.

### Isolation guarantee

Because Free is additive and isolated, a Free-side failure should degrade only
the Free translation attempt for that room, not the pre-existing Standard flow.

---

## Acceptance Criteria

- A source room can have one Standard Room and one Free Room at the same time.
- Free Room translation preserves the same Chatwork structure as Standard Room
  translation.
- Keyword mask/restore behavior is shared code and matches Standard behavior
  exactly.
- Shared orchestration depends on a backend abstraction rather than directly on
  Kagi/OpenAI/Gemini details.
- Free routes mirror Standard CRUD route shapes and response envelopes.
- Free Room pages feel nearly identical to current Standard Room pages except for
  the intentionally different provider/style/token fields.
- Free Room happy path uses one Kagi translation request per message, not one
  request per segment.
- Free Room fails gracefully when Kagi anti-abuse/captcha protection is detected.
- Free Room does not deliver any translated body when marker decode or format
  integrity validation fails.
- Free failure is isolated and does not break Standard handling for the same
  webhook.
- Oversized or over-segmented Free payloads fail fast with typed detailed errors.
- Free delivery does not begin before all format-integrity validation succeeds.
- Free logs are detailed but privacy-aware by default.
- Free codec behavior remains correct for mixed-language and emoji-heavy inputs.
- Existing Standard tests continue to pass without behavior regressions.
- `bun test && bun run typecheck && bun run lint` passes after the rollout.

---

## Open Risks

- Marker-based batch decoding depends on Kagi preserving synthetic segment
  markers well enough to parse reliably.
- Kagi DOM changes or bot-detection changes remain an external dependency risk.
- The shared orchestration extraction must be test-driven; otherwise it could
  accidentally alter Standard behavior.
- `ContextField` and `BrutalSelect` need minor shared-component improvements to
  support the desired UI parity cleanly.

---

## Summary

The revised design keeps storage separate but makes runtime guarantees shared.

That is the approved compromise:

- separate config domains for safety and backward compatibility
- shared orchestration for structure, keyword, and abstraction guarantees
- backend-specific behavior isolated to adapters only

This is the design that satisfies the user's updated requirements for Q2, Q3,
Q6, Q7, and Q8.
