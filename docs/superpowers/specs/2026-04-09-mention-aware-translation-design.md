# Mention-Aware Translation Context

**Date:** 2026-04-09
**Status:** Draft
**Approach:** Mention Hint as User Prompt Extension (Approach A)

## Problem

When a Chatwork message contains `[To:5293785]AuPMH`, the LLM translates `お疲れ様です` as "Moi nguoi vat va roi" (plural) instead of "Anh vat va roi" (singular). Root cause: mention metadata (`toAccountIds`, `ccAccountIds`) is extracted during parsing but never passed to the LLM prompt. The LLM is completely blind to the interpersonal context of the message.

Client feedback: "em chi tag minh anh a, no dich la moi nguoi."

## Decisions (from interview session)

| #       | Decision                                                             | Status   | Provenance     |
| ------- | -------------------------------------------------------------------- | -------- | -------------- |
| DEC-001 | Inject mention hint at message-level user prompt                     | Accepted | user-confirmed |
| DEC-002 | Hint includes recipient count + display name + addressing guidance   | Accepted | user-confirmed |
| DEC-003 | Support `[To:]` and `[cc:]`                                          | Accepted | user-confirmed |
| DEC-004 | Parse display name from literal text in message body (zero API cost) | Accepted | user-confirmed |
| DEC-005 | Defer room participant awareness to backlog                          | Accepted | user-confirmed |
| DEC-006 | Include `[toall]` in scope                                           | Accepted | user-confirmed |
| DEC-007 | Only inject hint when message has mentions                           | Accepted | user-confirmed |
| DEC-008 | Separate To vs CC in hint format                                     | Accepted | user-confirmed |

## Scope

**In-scope:** `[To:]`, `[cc:]`, `[toall]` tag handling; mention hint injection into LLM prompt.

**Out-of-scope (deferred):** Room participant awareness (DM vs group, member count via API).

## Architecture

### Data Flow

```
Webhook → Parser → Orchestrator → Backend → Pipeline → Translation-Prompt → LLM
                        ↓
              extractMentionContext()
                        ↓
                buildMentionHint()
                        ↓
                  mentionHint string
                        ↓
              backend.translate({ mentionHint })
                        ↓
              pipeline opts.mentionHint
                        ↓
          <MENTION_CONTEXT> block in user prompt
```

### Packages Affected

| Package                            | Changes                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `@chatwork-bot/chatwork`           | `[toall]` parser support, `extractMentionContext()`, `buildMentionHint()` |
| `@chatwork-bot/translation-prompt` | `mentionHint` param in prompt builders, `<MENTION_CONTEXT>` block         |
| `@chatwork-bot/translator`         | Forward `mentionHint` through backend → pipeline                          |

## Design Details

### 1. Parser Layer (`@chatwork-bot/chatwork`)

#### 1a. `[toall]` Support

Add `isToAll: boolean` to `MessageDecorationContext`:

```typescript
export interface MessageDecorationContext {
  toAccountIds: number[]
  ccAccountIds: number[]
  replyToData: ReplyToData | undefined
  isToAll: boolean // NEW
}
```

Add `toall` node type to `MessageRenderNode`:

```typescript
| { type: 'toall' }
```

Handle in `parseBody()` as self-closing tag (like `hr`):

```typescript
} else if (tag.name === 'toall') {
  context.isToAll = true
  nodes.push({ type: 'toall' })
}
```

Render in `composeTranslatedMessage()`:

```typescript
if (node.type === 'toall') {
  return '[toall]'
}
```

#### 1b. Display Name Extraction

New utility `extractMentionContext()`:

```typescript
interface MentionRecipient {
  accountId: number
  displayName: string
}

interface MentionContext {
  toRecipients: MentionRecipient[]
  ccRecipients: MentionRecipient[]
  isToAll: boolean
}

function extractMentionContext(
  renderTemplate: MessageRenderNode[],
  metadata: MessageDecorationContext,
): MentionContext
```

**Logic:** Walk render template sequentially. When encountering a `to` or `cc` node, peek at the next literal node and extract text before the first `\n` as the display name. If no literal follows or literal is whitespace-only, use empty string.

**Why parse from render template, not API:** Display names are already in the message body (injected by Chatwork). Zero API cost, no rate limit risk (Chatwork: 300 calls/5 min).

#### 1c. Mention Hint Builder

New utility `buildMentionHint()`:

```typescript
function buildMentionHint(context: MentionContext): string | undefined
```

**Priority rule:** When `isToAll` is true, always use the `isToAll` hint regardless of any `[To:]`/`[cc:]` tags present (they are redundant when addressing everyone).

| Case                      | Output                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| No mentions               | `undefined` (skip injection per DEC-007)                                                         |
| `isToAll` (overrides all) | `"Addressed to all room members. Use plural address (moi nguoi/cac anh chi)."`                   |
| 1 To, 0 CC                | `"Directly addressed to 1 person: {name}. Use singular address (anh/chi/ban)."`                  |
| 1 To, N CC                | `"Directly addressed to: {toName}. CC: {ccNames}. Use singular address for the main recipient."` |
| N To, 0 CC                | `"Directly addressed to {n} people: {names}. Use plural address."`                               |
| N To, M CC                | `"Directly addressed to {n} people: {toNames}. CC: {ccNames}. Use plural address."`              |

### 2. Pipeline Integration (`@chatwork-bot/translator`)

#### 2a. Backend Interface

Add `mentionHint` to `RoomTranslationBackendInput`:

```typescript
export interface RoomTranslationBackendInput<TRuntimeConfig = unknown> {
  cleanText: string
  translationInputs: string[]
  roomContext?: string
  keywordSystemHint?: string
  mentionHint?: string  // NEW
  runtimeConfig: TRuntimeConfig
  phaseObserver?: { ... }
}
```

#### 2b. StandardTranslationBackend

Forward `mentionHint` from input → `TranslationPipeline` opts → prompt builders.

#### 2c. FreeTranslationBackend

No changes. Kagi is machine translation without prompt interface — `mentionHint` is ignored.

#### 2d. Orchestrator

In `room-translation-orchestrator.ts`, before calling `backend.translate()`:

```typescript
const envelope = command.audit.rawSourceSnapshot as DecorationSnapshotEnvelope
const mentionContext = extractMentionContext(
  envelope.snapshot.renderTemplate,
  envelope.snapshot.metadata,
)
const mentionHint = buildMentionHint(mentionContext)

backend.translate({
  ...existingParams,
  ...(mentionHint ? { mentionHint } : {}),
})
```

### 3. Prompt Injection (`@chatwork-bot/translation-prompt`)

Add `mentionHint?: string` param to both public functions:

- `buildSingleCallPrompts(text, style, roomContext, keywordHint, mentionHint)`
- `buildStructuredTranslationPrompts(segments, style, fullMessageContext, roomContext, keywordHint, mentionHint)`

Inject `<MENTION_CONTEXT>` block in user prompt before the translate block:

```
Translate into Vietnamese as JSON:
{"sourceLang": "<language>", "translated": "<Vietnamese>"}

<MENTION_CONTEXT>
Directly addressed to 1 person: AuPMH. Use singular address (anh/chi/ban).
</MENTION_CONTEXT>

<TRANSLATE_TEXT>
AuPMH
お疲れ様です〜
</TRANSLATE_TEXT>
```

When `mentionHint` is `undefined` — no `<MENTION_CONTEXT>` block is injected.

## Testing Strategy

### Unit Tests — Parser (`@chatwork-bot/chatwork`)

- `[toall]` parsing: `isToAll = true` in metadata + `toall` node in render template
- `[toall]` compose: renders back as `[toall]` in output
- `extractMentionContext()`:
  - 1 To: correct accountId + displayName
  - Multiple To: extract all
  - To + CC: separate correctly
  - `[toall]`: `isToAll = true`
  - No mention: empty arrays
  - To node at end of message (no following literal): empty displayName
- `buildMentionHint()`: each case in the hint table

### Unit Tests — Translation Prompt (`@chatwork-bot/translation-prompt`)

- With `mentionHint`: `<MENTION_CONTEXT>` block present in user prompt
- Without `mentionHint`: no `<MENTION_CONTEXT>` block
- Both single and structured modes

### Unit Tests — Pipeline + Backend (`@chatwork-bot/translator`)

- `StandardTranslationBackend.translate()` with `mentionHint`: forwarded to pipeline prompt
- Orchestrator: mock snapshot with `[To:]` metadata → verify `mentionHint` built and passed correctly

### Not in Scope

- No new E2E tests needed — feature is fully unit-testable (adds context string to prompt)
- LLM output quality verified via existing dataset-runner flow

## Future Scope (Deferred)

- **Room participant awareness**: Detect DM vs group via `GET /rooms/{room_id}` API. Would allow correct singular/plural even without `[To:]` tags. Deferred due to API rate limit risk (300 calls/5 min) and additional caching complexity.
