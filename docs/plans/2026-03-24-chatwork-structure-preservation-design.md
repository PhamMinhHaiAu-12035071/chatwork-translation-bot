# Chatwork Structure Preservation Design

**Date:** 2026-03-24
**Status:** Approved for implementation planning

> **Amendment (2026-03-25):** Nested quote handling is in scope. Quote metadata is modeled per
> quote node, nested `[qt]` blocks are preserved recursively, valid quote nodes are re-rendered
> with canonical Chatwork `qtmeta`, and malformed/meta-less `qt` nodes degrade to `[quote]`.

## Goal

Preserve the useful Chatwork formatting structure of source messages when sending translated
content to the internal destination room, while moving source-room-dependent context into a
separate metadata message so the destination room remains readable even when it does not contain
the original members.

## Problem

The current flow destroys too much source structure:

- `@chatwork-bot/chatwork` strips most Chatwork markup and reduces the source to one flat
  `translatableText` string.
- `@chatwork-bot/translator` always rebuilds a new `[info][title]...[/title]...[/info]` wrapper,
  which is not structurally faithful to the source body.
- `message_updated` is rejected even though the configured webhook subscribes to both
  `message_created` and `message_updated`.
- output files are keyed only by `sourceMessageId`, so an updated event would overwrite the
  original output record.
- source-room-dependent tags such as `[To:...]`, `[cc:...]`, `[rp ...]`, and similar
  member/room-bound markup do not transport well to the destination room because the original
  members are usually not present there.

The destination room is an internal company room, not a mirror of the client room. Because of
that, preserving raw member/room tags is less important than preserving human readability and the
portable visual structure of the original message.

## Approved Product Decisions

These decisions were confirmed during the design interview:

- Preserve the original top-level message structure as much as possible in the translated body.
- Deliver `2 messages` to the destination room:
  - `message 1`: compact metadata/context
  - `message 2`: translated body with preserved structure
- Support `message_created` and `message_updated`.
- For `message_updated`, create a new destination message pair instead of editing prior output.
- Translate both quoted text and current text.
- Preserve nested quote blocks recursively with no fixed depth cap.
- Do not mirror raw source `qtmeta` payloads verbatim, but re-render valid `qt` nodes with
  canonical Chatwork `qtmeta`.
- If a `qt` node has no recoverable quote metadata, downgrade that node only to `[quote]`.
- Keep formatting as close to the source as possible.
- Preserve the exact original content inside `[code]...[/code]`; do not translate or reformat it.
- Move source-room-dependent tags out of the translated body and into the metadata message.
- Metadata should be "compact but enough": event type, sender name, room name, send/update time,
  and one quote-summary line per quote level when available.
- Resolve human-readable sender and room names when possible.
- Fallbacks:
  - sender: `#<account_id>`
  - room: `Room #<room_id>`
- Partial delivery policy:
  - if metadata is sent successfully but the translated body fails, do not resend metadata
  - retry only the translated body stage inside the same request
  - persist the final outcome as partial delivery

## Scope

### In scope

- Structured parsing of Chatwork message markup
- Structure-preserving translation for portable markup
- Two-message delivery model
- `message_updated` webhook support
- Source event uniqueness for output persistence
- Quote-body translation with per-node nested quote metadata and recursive rendering
- Exact preservation of `[code]` blocks
- Sender/room name resolution with safe fallbacks

### Out of scope

- `mention_to_me`
- Editing or deleting previously delivered destination messages
- Persistent repair jobs for partial delivery
- Changing Chatwork webhook response policy in `webhook-logger`
- Generalizing this rendering model to non-Chatwork sources

## Portable vs Source-Dependent Markup

### Portable structure to preserve in message 2

- plain text and line breaks
- `[info]...[/info]`
- `[title]...[/title]`
- `[hr]`
- `[code]...[/code]`
- quote wrappers such as `[quote]...[/quote]` and `[qt]...[/qt]`
- URL and preview markup when they can be preserved as plain Chatwork structure

### Source-dependent tags to remove from message 2 and surface in message 1

- `[To:...]`
- `[cc:...]`
- `[rp aid=... to=room:message]`
- raw `[qtmeta ...]`

This split keeps the translated body visually close to the source while avoiding broken mentions
or meaningless raw IDs in the internal destination room.

Deferred source-dependent tags:

- tags such as `[picon:...]`, `[pname]`, and `[piconname:...]` are not part of the canonical v1
  token set because they are not evidenced in the current local docs or codebase
- if encountered in v1, they are tolerated as literal text rather than guaranteed extraction into
  metadata

## Architecture

## High-level flow

```text
Chatwork webhook
  -> normalize webhook payload (created + updated)
  -> parse Chatwork body into:
       - translationInputs[]
       - portable body template
       - metadata hints
  -> map to neutral TranslationIngressCommand
  -> translator runs one structured translation call
  -> chatwork package composes:
       - metadata message
       - translated body message
  -> translator sends both messages with bounded retries
  -> output record stores per-event delivery outcome
```

## Package responsibilities

### `@chatwork-bot/chatwork`

This feature expands the Chatwork package responsibility in one targeted way: Chatwork-specific
message-decoration parsing and rendering now belongs here, not in `translator`.

It will own:

- webhook normalization for `message_created` and `message_updated`
- Chatwork body parsing into a structured snapshot
- extraction of ordered `translationInputs`
- rendering of the final translated body from a structured snapshot
- rendering of the metadata message
- room-name resolution helper
- member-name resolution reuse and caching

### `@chatwork-bot/core`

`core` remains neutral. It only carries generic transport fields needed by downstream services.

`TranslationIngressCommand` will gain:

- `sourceEventId: string`
- `sourceEventType: string`
- `translationInputs: string[]`

It will keep:

- `sourceMessageId`
- `sourceRoomId`
- `senderAccountId`
- `rawBody`
- `translatableText`
- `sendTime`
- `updateTime`
- `audit.rawSourceSnapshot`

`audit.rawSourceSnapshot` remains `Record<string, unknown>`, but the Chatwork mapper will now
store both the raw webhook payload and a Chatwork-specific structured snapshot there.

### `@chatwork-bot/translator`

`translator` continues to own orchestration:

- choose whether LLM execution is needed
- execute a single structured translation call
- persist outputs
- send the two destination messages with retry policy
- classify delivery as `sent`, `partial`, or `failed`
- map partial delivery to a terminal failed ACK for dataset-runner compatibility

## Data contracts

## `TranslationIngressCommand`

Planned additions:

```ts
interface TranslationIngressCommand {
  sourceSystem: string
  sourceEventId: string
  sourceEventType: string
  sourceMessageId: string
  sourceRoomId: number
  senderAccountId: number
  rawBody: string
  translatableText: string
  translationInputs: string[]
  sendTime: number
  updateTime: number
  audit: {
    receivedAt: string
    rawSourceSnapshot: Record<string, unknown>
  }
}
```

Notes:

- `sourceEventId` solves output-file overwrite for `message_updated`.
- Recommended value:
  `${sourceMessageId}:${sourceEventType}:${webhook_event_time}`.
- `webhook_event_time` is already documented in the local Chatwork webhook reference and is
  already required by the current normalization contract. v1 should reject malformed payloads that
  omit it instead of fabricating a fallback such as `Date.now()`.
- `translatableText` remains the joined visible text for logs, debugging, and backward-compatible
  metrics.
- `translationInputs` is the ordered list of discrete text segments that should be translated.

## Chatwork structured snapshot

The structured snapshot stays inside `audit.rawSourceSnapshot`, not as a top-level core schema.

The snapshot will carry:

- a portable render template with literal chunks and translation slots
- ordered translation inputs
- top-level metadata hints for `To`, `cc`, and reply target
- per-node quote metadata and per-node source-dependent context on quote render nodes
- enough information to rebuild the translated body without reparsing raw text

Translator will not interpret that snapshot directly. It will pass the command to Chatwork-owned
rendering helpers.

## Translation contract

The current plain-text contract is not enough because the model must translate multiple discrete
segments while preserving their count and order.

Planned prompt contract for structured translation:

```json
{
  "sourceLang": "Japanese",
  "translatedSegments": ["...", "...", "..."]
}
```

Rules:

- output segment count must equal input segment count
- each element corresponds to the same index from `translationInputs`
- code blocks are excluded from `translationInputs`
- if `translationInputs.length === 0`, skip the LLM call entirely
- if the LLM returns the wrong segment count, treat it as a terminal `INVALID_RESPONSE`, send no
  destination messages, and record the request as failed
- v1 does not run a second repair prompt and does not fall back to sending raw untranslated body
- if `translationInputs.length === 0` but the portable body still has meaningful literal content,
  still send both destination messages; `message 2` is rendered entirely from literal preserved
  structure

Meaningful literal content means the preserved snapshot would still render at least one visible,
non-empty output element after trimming whitespace-only text nodes and removing empty wrapper-only
containers. Examples that count:

- non-empty `[code]...[/code]`
- `[hr]`
- quote container with a non-empty rendered body
- non-empty literal text that is not translated because no translation slot was produced

Examples that do not count:

- whitespace-only text
- empty wrappers
- tags removed entirely into metadata without any remaining visible body content

Example zero-input case:

```text
Input body:  [code]const x = 1[/code]
Message 2:   [code]const x = 1[/code]
```

## Parsing and rendering rules

## Parser strategy

Do not continue with regex stripping as the primary strategy.

Use a tolerant, stack-based Chatwork parser that can distinguish:

- literal text
- self-closing structural tags
- container tags
- source-dependent tags
- code blocks
- quote metadata

Supported canonical token shapes in v1:

- source-dependent single tokens:
  - `[To:<digits>]`
  - `[cc:<digits>]`
  - `[rp aid=<digits> to=<digits>:<digits>]`
  - `[rp aid=<digits> to=<digits>-<digits>]`
- portable single token:
  - `[hr]`
- portable container pairs:
  - `[info]...[/info]`
  - `[title]...[/title]`
  - `[code]...[/code]`
  - `[qt]...[/qt]`
  - `[quote]...[/quote]`
- quote metadata:
  - raw `[qtmeta ...]` or `[qtmeta ...][/qtmeta]` nested inside `[qt]`
  - nested `[qt]...[/qt]` blocks inside other quotes

Tolerance rules:

- raw message input should not cause parser throws
- unknown tags are preserved as literal text
- unsupported non-canonical variants, such as attribute-bearing mention forms not observed in the
  current codebase or local docs, are preserved as literal text in v1
- deferred member-dependent tags not included in the canonical token list, such as `[picon:...]`,
  `[pname]`, and `[piconname:...]`, are also preserved as literal text in v1
- malformed or unbalanced markup is treated as literal text where needed instead of throwing
- structurally invalid nesting downgrades the unexpected token sequence to literal text within the
  current scope instead of aborting the whole message
- `[code]` blocks are treated as opaque literal content
- `qtmeta` attribute parsing is best-effort and only extracts sender/time fields when they are
  clearly recoverable from the token payload

Acceptance examples for Task 3:

```text
1. Plain text
Input:  Hello world
Parse:  translationInputs = ["Hello world"]

2. Portable info/title
Input:  [info][title]Agenda[/title]Please review[/info]
Parse:  preserve [info]/[title], translationInputs = ["Agenda", "Please review"]

3. Source-dependent mention
Input:  [To:1484814]Please review
Parse:  metadata hint for To=1484814, translationInputs = ["Please review"]

4. Quote metadata
Input:  [qt][qtmeta ...][/qtmeta]quoted body[/qt]
Parse:  preserve a quote node with node-scoped quote metadata, translationInputs = ["quoted body"]

5. Nested quotes
Input:  [qt][qtmeta ...][qt][qtmeta ...]quoted body[/qt][/qt]
Parse:  preserve both quote levels with their own quote metadata

6. Code-only body
Input:  [code]const x = 1[/code]
Parse:  translationInputs = [], code block preserved literally

7. Invalid nesting
Input:  [info][info]x[/info][/info]
Parse:  parser does not abort; the unexpected inner [info]...[/info] sequence is downgraded to
        literal text within the outer scope
```

## Quote handling

Quote text is translated and nested quotes are preserved recursively.

Rendering rule:

- keep the quote wrapper
- valid `[qt]` nodes are rendered with canonical Chatwork `qtmeta`
- malformed or meta-less `[qt]` nodes are downgraded to `[quote]`
- source-dependent tags inside a quote layer are removed from the body and attached to that quote
  node's metadata context instead
- nested quotes keep their own metadata and do not consume parent metadata

Wrapper-specific rules:

- `[qt]...[/qt]` with recoverable `qtmeta` renders as `[qt][qtmeta ...]...[/qt]`
- `[qt]...[/qt]` without recoverable sender/time metadata renders as `[quote]...[/quote]`
- `[quote]...[/quote]` preserves the translated body inside the preserved wrapper

Shared time-format contract for metadata:

- format: `YYYY-MM-DD HH:mm`
- source: epoch seconds from the webhook payload
- timezone basis: UTC, matching the repo's current deterministic timestamp rendering style
- one shared helper must format metadata timestamps and quote-summary timestamps

Example:

```text
Input:   [qt][qtmeta aid=123 time=1711267800][/qtmeta]quoted content[/qt]
Output:  [qt][qtmeta aid=123 time=1711267800]quoted content[/qt]
```

```text
Input:   [qt]quoted content[/qt]
Output:  [quote]quoted content[/quote]
```

## Metadata message

Message 1 is a compact internal summary, not a verbatim mirror of source tags.

It should include:

- event type: created or updated
- sender name
- room name
- send time
- update time when relevant
- `To` / `cc` names when present
- reply target when present
- one `Quote N:` line per quote level, ordered outer -> inner

The metadata message is the canonical place for context that cannot render correctly in the
destination room.

## Translated body message

Message 2 should keep the portable structure of the source message.

Examples of intended behavior:

- `[info][title]Original title[/title]Body[/info]`
  -> same wrapper structure, translated title/body text
- `[code]const x = 1[/code]`
  -> exact original code block
- quote block
  -> same quote container, translated quote text, canonical `qtmeta` when valid, `[quote]`
  fallback when metadata is not recoverable
- `[To:123] body`
  -> no raw `[To:123]` in message 2; recipient appears in metadata message instead
- `[code]const x = 1[/code]`
  -> exact original code block with no extra wrapper added

## Delivery model

Delivery becomes an explicit two-stage pipeline:

1. build and send metadata message
2. build and send translated body message

Retry rules:

- retries still apply only to transient errors and rate limits
- if metadata fails, overall delivery is `failed`
- if metadata succeeds but body fails after retries, overall delivery is `partial`
- metadata is never resent after a successful send

Planned output shape:

```ts
interface OutputDelivery {
  status: 'sent' | 'partial' | 'failed'
  destinationRoomId: number
  messages: Array<{
    kind: 'metadata' | 'body'
    status: 'sent' | 'failed'
    destinationMessageId?: string
    errorCode?: string
    errorMessage?: string
  }>
  sentAt: string
}
```

Dataset-runner compatibility rule:

- internal output and observability may record `partial`
- ACK payload sent to dataset-runner must normalize `partial` to `failed`
- partial caused by transport failure is different from translation-validation failure; the latter
  fails before any destination message is sent

## Webhook event handling

## Supported events

- `message_created`
- `message_updated`

## Deferred event

- `mention_to_me`

The current screenshot and local API reference justify supporting `created` and `updated` now.
`mention_to_me` remains future scope.

## Output persistence

Current output filenames use only `sourceMessageId`, which is unsafe for updated events.

New rule:

- output files are keyed by `sourceEventId`
- source origin mapping for dataset-runner still uses `sourceMessageId`

This preserves existing dataset-runner behavior while preventing updated events from overwriting
created-event output files.

## Testing strategy

Tests must cover:

- webhook normalization accepts both supported event types
- `sourceEventId` uniqueness for created vs updated
- parser extraction of translation inputs
- `[code]` content is passed through exactly
- quote body translation while nested quote nodes are re-rendered canonically with per-node
  metadata or downgraded to `[quote]` when metadata is missing
- source-dependent tags move to metadata instead of message 2
- zero-translation-input path skips LLM and still sends both messages when structure exists
- partial delivery behavior does not resend metadata
- output writer uses `sourceEventId`
- existing `message_created` happy path still produces the expected two-message output after the
  refactor

## Risks and mitigations

- Parser complexity:
  - mitigate with a tolerant parser and snapshot-focused tests for real Chatwork samples
- Model returns the wrong number of translated segments:
  - validate response length and fail clearly
- Additional Chatwork API calls for names:
  - use fresh `Map` instances created in request-scoped delivery orchestration and pass them down
    as function parameters, matching the current stateless service style in the repo
- Partial delivery leaves an orphan metadata message:
  - explicitly record `partial` and do not hide the condition as full success
- Existing local tooling may assume raw webhook payload is stored directly in
  `audit.rawSourceSnapshot`:
  - preserve the raw payload inside the new snapshot envelope rather than discarding it

## Explicit decisions made

- Two-message output is mandatory.
- `message_updated` produces a fresh pair, not an edit.
- Portable structure is preserved in message 2.
- Source-dependent tags move to message 1.
- Quote body is translated.
- Raw `qtmeta` is not preserved.
- `[code]` content is preserved exactly.
- Human-readable sender and room names are preferred over raw IDs.
- Fallbacks are `#account_id` and `Room #room_id`.
- Partial delivery is first-class state and does not resend metadata.
