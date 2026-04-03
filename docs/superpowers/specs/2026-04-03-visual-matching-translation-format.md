# Visual Matching Translation Format Design Specification

**Version:** 1.0  
**Date:** 2026-04-03  
**Status:** Approved  
**Prepared by:** AI-assisted (user: AuPMH)

---

## Overview

Replace the current 2-message translation format (metadata box + body) with a single-message format that visually matches the original message as closely as possible. The new format displays the sender's avatar and name (like the original message) with a clear event type indicator, followed by both original and translated content.

**Current format:**

```
Message 1: [info][title]Translation metadata[/title]Event: created\nSender: ...[/info]
Message 2: Translated body
```

**New format:**

```
Single message: [piconname:{id}] Name 🇻🇳 [Event]\nOriginal\n[hr]\nTranslation
```

---

## Goals & Objectives

### Primary Goals

1. **Visual Matching** - Translation messages visually resemble original messages (avatar + name + content)
2. **Clear Event Indicator** - Prefix clearly shows whether message was "Created" or "Updated"
3. **Context Preservation** - Keep original text for verification and context
4. **Structure Preservation** - Maintain all existing quote/reply/code tag functionality
5. **Single Message Output** - Reduce room clutter by sending 1 message instead of 2

### Success Criteria

- ✅ Translated message displays sender's avatar (not BOT_TRANSLATION avatar)
- ✅ Event type (Created/Updated) clearly visible in sender line
- ✅ Original text preserved with full tag structure
- ✅ Quote `[qt]` and Reply `[rp]` tags work correctly in both sections
- ✅ All existing tests pass with updated assertions
- ✅ Manual verification confirms visual appearance matches expectations

### Non-Goals

- ❌ No changes to webhook payload handling
- ❌ No changes to translation pipeline or LLM calls
- ❌ No changes to command parsing or routing
- ❌ No backend/API structural changes
- ❌ No migration of existing translated messages

---

## Message Format Specification

### Complete Format Template

```
[piconname:{account_id}] {sender_name} 🇻🇳 [{event_type}]
{original_body_with_preserved_tags}
[hr]
{translated_body_with_preserved_tags}
```

### Component Breakdown

**Line 1: Header**

- `[piconname:{account_id}]` - Chatwork tag to render sender's avatar + name
- `{sender_name}` - Resolved from room members API or fallback `#{account_id}`
- Space separator
- `🇻🇳` - Vietnamese flag emoji (constant visual indicator)
- `[{event_type}]` - Either `[Created]` or `[Updated]` in brackets

**Line 2+: Original Body**

- Full original message text from webhook
- All Chatwork tags preserved: `[qt]`, `[rp]`, `[code]`, `[info]`, `[title]`, `[hr]`
- Structure identical to what sender posted

**Divider: [hr]**

- Chatwork horizontal rule tag
- Visual separator between original and translation

**Final Section: Translated Body**

- Translated message text
- Same structure as original (tags preserved)
- Only literal text content is translated

### Concrete Examples

#### Example 1: Simple message (created)

```
[piconname:100] AuPMH 🇻🇳 [Created]
事前見積はほどほどに、実務を優先してなるべく早くにPJスタートできるようにしますので。
[hr]
Bên tôi sẽ chi làm phần ước tính sơ bộ 8 mức vừa phải, ưu tiên công việc thực tế để có thể bắt đầu dự án càng sớm càng tốt.
```

#### Example 2: Updated message

```
[piconname:100] AuPMH 🇻🇳 [Updated]
修正しました。新しい情報です。
[hr]
Đã chỉnh sửa. Đây là thông tin mới.
```

#### Example 3: Message with quote

```
[piconname:100] AuPMH 🇻🇳 [Created]
[qt][qtmeta aid=200 time=1711271400]前のメッセージ[/qt]
新しいメッセージです。
[hr]
[qt][qtmeta aid=200 time=1711271400]Tin nhắn trước đó[/qt]
Đây là tin nhắn mới.
```

#### Example 4: Message with reply

```
[piconname:100] AuPMH 🇻🇳 [Created]
[rp aid=200 to=777-123]了解しました。ありがとうございます。
[hr]
[rp aid=200 to=777-123]Đã hiểu rồi. Cảm ơn bạn.
```

#### Example 5: Code block only (no translatable text)

```
[piconname:100] AuPMH 🇻🇳 [Created]
[code]const x = 1;
console.log(x);[/code]
[hr]
[code]const x = 1;
console.log(x);[/code]
```

#### Example 6: Fallback name

```
[piconname:100] #100 🇻🇳 [Created]
テストメッセージ
[hr]
Tin nhắn thử nghiệm
```

### Event Type Mapping

| Webhook Event Type | Display Text |
| ------------------ | ------------ |
| `message_created`  | `[Created]`  |
| `message_updated`  | `[Updated]`  |

### Constants

- **Emoji:** `🇻🇳` (Vietnamese flag, U+1F1FB U+1F1F3)
- **Divider:** `[hr]` (Chatwork horizontal rule tag)
- **Avatar tag:** `[piconname:{account_id}]` per Chatwork API docs

---

## Architecture

### System Components

**Modified components:**

1. **`composeTranslatedMessage`** (renamed from `composeTranslatedMessagePair`)
   - Input: `TranslationIngressCommand`, translated segments, API token
   - Output: Single `message: string` (was: `metadataMessage` + `bodyMessage`)
   - Responsibility: Compose single formatted message with header, original, divider, translation

2. **`sendTranslatedMessage`** (in `chatwork-sender.ts`)
   - Input: Command, result, config
   - Output: `OutputDelivery` with single message status
   - Responsibility: Send single message with retry logic (was: 2-stage send)

3. **Message rendering helpers** (internal to compose function)
   - Add `mode: 'original' | 'translated'` parameter
   - Render nodes twice: once for original body, once for translated body
   - Share same structure preservation logic

**Unchanged components:**

- ✅ Webhook normalization (`normalize-webhook-payload.ts`)
- ✅ Command mapping (`map-webhook-to-translation-command.ts`)
- ✅ Translation pipeline (`pipeline.ts`)
- ✅ LLM execution (all provider plugins)
- ✅ Message decoration parsing (`parse-message-decoration.ts`)
- ✅ Room configuration store
- ✅ All routing and middleware

### Data Flow

```
Webhook → Normalize → MapToCommand → Parse Decoration
                                           ↓
                                    [snapshot with renderTemplate]
                                           ↓
                              Translation Pipeline (LLM)
                                           ↓
                                   [translated segments]
                                           ↓
                              Compose Single Message:
                              1. Render original body (mode='original')
                              2. Render translated body (mode='translated')
                              3. Format: header + original + [hr] + translation
                                           ↓
                              Send Single Message (with retry)
                                           ↓
                              Return OutputDelivery
```

### Interface Changes

#### Before:

```typescript
interface ComposeResult {
  metadataMessage: string
  bodyMessage: string
}

function composeTranslatedMessagePair(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult>
```

#### After:

```typescript
interface ComposeResult {
  message: string
}

function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult>
```

#### Delivery Status Before:

```typescript
messages: [
  { kind: 'metadata', status: 'sent', destinationMessageId: 'msg-1' },
  { kind: 'body', status: 'sent', destinationMessageId: 'msg-2' },
]
```

#### Delivery Status After:

```typescript
messages: [{ kind: 'message', status: 'sent', destinationMessageId: 'msg-1' }]
```

---

## Implementation Details

### 4.1. Compose Function Refactoring

**File:** `packages/chatwork/src/services/compose-translated-message-pair.ts`

**Rename to:** `packages/chatwork/src/services/compose-translated-message.ts`

**Key changes:**

1. **Build header line:**

```typescript
const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
const header = `[piconname:${command.senderAccountId}] ${senderName} 🇻🇳 [${eventType}]`
```

2. **Render original body:**

```typescript
// Modify renderNode to accept mode parameter
const originalBody = await renderNodes(snapshot.renderTemplate, {
  mode: 'original',
  originalContent: snapshot.translationInputs, // Original text segments
})
```

3. **Render translated body:**

```typescript
// Existing logic with translated segments
const translatedBody = await renderNodes(snapshot.renderTemplate, {
  mode: 'translated',
  translatedSegments: params.translatedSegments,
})
```

4. **Compose single message:**

```typescript
const message = [header, originalBody, '[hr]', translatedBody].join('\n')

return { message }
```

**Special handling:**

- If `originalBody.trim() === ''` (no translatable content), skip original section:
  ```typescript
  const message =
    originalBody.trim() === ''
      ? `${header}\n[hr]\n${translatedBody}`
      : `${header}\n${originalBody}\n[hr]\n${translatedBody}`
  ```

### 4.2. Sender Function Simplification

**File:** `packages/translator/src/services/chatwork-sender.ts`

**Current logic:** 2-stage send with per-stage retry

```typescript
const metadataDelivery = await sendStageMessage('metadata', metadataMessage, ...)
const bodyDelivery = await sendStageMessage('body', bodyMessage, ...)
```

**New logic:** Single send with unified retry

```typescript
const composed = await composeTranslatedMessage(command, params)
const delivery = await sendStageMessage('message', composed.message, config, sleepFn)

return {
  status: delivery.status,
  destinationRoomId: config.destinationRoomId,
  messages: [delivery],
  ...(delivery.destinationMessageId ? { destinationMessageId: delivery.destinationMessageId } : {}),
  sentAt,
}
```

**Retry behavior unchanged:**

- Network errors: exponential backoff (1s, 2s, 4s...)
- Rate limits: respect `retry-after` header
- 4xx/5xx errors: no retry
- Max 2 retries + initial attempt = 3 total attempts

**Status changes:**

- Remove `status: 'partial'` (no longer needed with single message)
- Only `'sent'` or `'failed'`

### 4.3. Original Body Rendering

**Challenge:** Current `renderNode` only handles translated text. Need to render original body too.

**Solution:** Add mode parameter to `renderNode`:

```typescript
interface RenderContext {
  mode: 'original' | 'translated'
  translatedSegments?: string[]
  originalSegments?: string[]
  nextIndex: { value: number }
}

async function renderNode(node: MessageRenderNode, context: RenderContext): Promise<string> {
  if (node.type === 'literal') {
    if (node.content.trim().length === 0) {
      return node.content // Whitespace preserved
    }

    if (context.mode === 'original') {
      // Return original content as-is
      return node.content
    } else {
      // Use translated segment (existing logic)
      const translated = context.translatedSegments[context.nextIndex.value]
      if (translated === undefined) {
        throw new Error('Not enough translated segments')
      }
      context.nextIndex.value++
      return preserveOuterWhitespace(node.content, translated)
    }
  }

  // All other node types: recursive render with same mode
  if (node.type === 'qt' || node.type === 'info' || ...) {
    const children = await renderNodes(node.children, context)
    // ... build tag with children
  }
}
```

**Key insight:** Original body already exists in `snapshot.renderTemplate` with `literal` nodes containing original text. We just need to render WITHOUT substituting translations.

---

## Error Handling & Edge Cases

### Edge Cases

**1. Empty original body**

```typescript
// Only code blocks, no translatable text
[piconname:100] AuPMH 🇻🇳 [Created]
[hr]
[code]const x = 1[/code]
```

Behavior: Skip original section entirely

**2. Very long messages**

- Chatwork limit: ~20,000 characters (estimated)
- If `originalBody.length + translatedBody.length > 18000`:
  - Truncate original to 500 chars: `originalBody.slice(0, 500) + '... [truncated]'`
  - Keep full translation
  - Log warning for monitoring

**3. Failed name lookup**

```typescript
[piconname:100] #100 🇻🇳 [Created]
...
```

Behavior: Use `#${account_id}` fallback (existing logic in `resolveMemberDisplayNameSafe`)

**4. Quote with deleted user**

```typescript
[qt][qtmeta aid=999 time=...]...[/qt]
```

Behavior: Keep tag as-is - Chatwork handles rendering of invalid IDs

**5. Multiple [hr] in original**

```typescript
Original: Message A\n[hr]\nMessage B
Result: [piconname:...] Name 🇻🇳 [Created]
Message A
[hr]
Message B
[hr]
Translation A
Translation B
```

Behavior: All `[hr]` tags preserved - no conflict

**6. Emoji rendering failure**

- If `🇻🇳` causes encoding issues → fallback to `[VN]` text
- Detect encoding errors in tests

### Error Handling Strategy

**Composition errors:**

- `renderNodes` failure → propagate error (no change from current)
- Structure validation failure → propagate error (no change from current)
- Missing translated segments → throw clear error message

**Sending errors:**

- Network failure → retry with exponential backoff (max 2 retries)
- Rate limit (`429`) → respect `retry-after` header, retry
- Auth error (`401`) → fail immediately, no retry
- Other 4xx/5xx → fail immediately, no retry
- Return `OutputDelivery` with `status: 'failed'` and error details

**Graceful degradation:**

- If `[piconname:{id}]` doesn't render → Chatwork shows as literal text (still readable)
- If emoji fails → plain `[VN]` text works
- If name lookup fails → `#{account_id}` still identifies sender
- Worst case: `[piconname:100] #100 [VN] [Created]\n...\n[hr]\n...` (fully functional)

### Backwards Compatibility

**During rollout:**

- No migration needed
- Old messages (2-message format) remain unchanged in history
- New messages use new 1-message format
- Mixed formats in room history is acceptable

**Rollback safety:**

- Single file revert: `compose-translated-message.ts`
- No database changes
- No configuration changes
- No breaking changes to dependent code

---

## Testing Strategy

### Unit Tests

**Test file:** `packages/chatwork/src/services/compose-translated-message.test.ts` (renamed)

**Required test cases:**

1. ✅ **Single message format with Created event**
   - Input: Simple message, `message_created`
   - Verify: Header line format, original body, `[hr]`, translated body

2. ✅ **Single message with Updated event**
   - Input: Simple message, `message_updated`
   - Verify: Header contains `[Updated]`

3. ✅ **Preserves quote structure in both sections**
   - Input: Message with `[qt][qtmeta aid=X time=Y]...[/qt]`
   - Verify: Both original and translated have identical tag structure

4. ✅ **Preserves reply structure**
   - Input: Message with `[rp aid=X to=Y-Z]`
   - Verify: Reply tag intact in both sections

5. ✅ **Preserves code blocks**
   - Input: Message with `[code]...[/code]`
   - Verify: Code content byte-identical, not translated

6. ✅ **Preserves info/title wrappers**
   - Input: Message with `[info][title]...[/title]...[/info]`
   - Verify: Structure preserved in both sections

7. ✅ **Empty original body handling**
   - Input: Code-only message (no translatable text)
   - Verify: Header + `[hr]` + code block (no empty original section)

8. ✅ **Fallback name resolution**
   - Input: Command with account_id not in member cache
   - Verify: Header uses `#100` format

9. ✅ **Nested quotes**
   - Input: `[qt][qt]inner[/qt]outer[/qt]`
   - Verify: Nested structure preserved in both sections

10. ✅ **Structure validation**
    - Input: Translated content that injects unexpected tags
    - Verify: Throws error (existing validation still works)

**Test assertions must verify:**

- Header format: `[piconname:{id}] {name} 🇻🇳 [{event}]`
- No `[info]` or `[title]` tags in output
- Original body present (unless empty)
- `[hr]` divider present
- Translated body present
- Structure signature unchanged

### Integration Tests

**Test file:** `packages/translator/src/services/chatwork-sender.test.ts`

**Changes required:**

1. **Update mocks:**
   - Change `metadataMessage` and `bodyMessage` → single `message` string
   - Mock format: `[piconname:34567] TestUser 🇻🇳 [Created]\n...\n[hr]\n...`

2. **Update assertions:**
   - Verify `sendRoomMessage` called ONCE (not twice)
   - Verify delivery contains 1 message entry
   - Verify status `'sent'` or `'failed'` (no `'partial'`)

3. **Update retry tests:**
   - Verify retry applies to single message (not 2 stages)
   - Verify rate limit handling on single message

### Manual Testing

**Prerequisites:**

- Dev server running: `bun run dev`
- Chatwork room configured with webhook pointing to localhost
- Destination room accessible

**Test checklist:**

| Test Case          | Input                 | Expected Output                                              | Verification                                       |
| ------------------ | --------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Simple created     | `テストメッセージ`    | Avatar + Name + 🇻🇳 [Created] + original + [hr] + translation | Avatar displays, name correct, event shows Created |
| Updated message    | Edit previous message | Header shows `[Updated]`                                     | Event type changes correctly                       |
| Message with quote | Send with `[qt]` tag  | Quote structure in both sections                             | Quote clickable, translated                        |
| Message with reply | Reply to message      | `[rp]` tag preserved                                         | RE icon works, clickable                           |
| Long message       | 1000+ chars           | Both sections render                                         | No truncation issues                               |
| Code block         | `[code]...[/code]`    | Code preserved byte-identical                                | Not translated, formatted                          |
| Empty translatable | Code-only message     | No empty original section                                    | Clean format                                       |

**Visual verification:**

- ✅ Sender's avatar displays (not BOT_TRANSLATION)
- ✅ Sender's name correct
- ✅ Emoji 🇻🇳 visible
- ✅ Event type `[Created]` or `[Updated]` clear
- ✅ `[hr]` divider renders as horizontal line
- ✅ Both sections readable on mobile and desktop
- ✅ Quote/reply interactive features work

---

## Technical Constraints

### Chatwork API Limitations

1. **Cannot impersonate sender** - Bot always posts as BOT_TRANSLATION account
2. **Avatar in message body** - Use `[piconname:{id}]` tag to display sender's avatar WITHIN message content
3. **Name resolution requires API call** - Must fetch room members to get display name
4. **Message size limit** - Estimated ~20,000 chars (undocumented, observed)
5. **No nested [piconname] tags** - Only first tag renders, subsequent ignored

### Code Constraints

1. **Structure validation required** - Must validate composed message parses to same structure
2. **Whitespace preservation** - Leading/trailing whitespace in literals must be preserved
3. **Tag preservation** - All supported tags must round-trip correctly
4. **Translation slot consistency** - Number of translated segments must match literal nodes

### Design Decisions & Rationale

**Why single message?**

- Visual matching goal requires minimal message count like original
- Reduces room clutter
- Simpler delivery logic (no partial success states)

**Why include original text?**

- Context for verification (user can check translation quality)
- Useful for messages with mixed translatable/non-translatable content
- Small overhead for significant UX benefit

**Why [piconname] vs [picon] + [pname]?**

- `[piconname]` is atomic - renders avatar + name together
- Simpler format, less prone to spacing issues
- Matches Chatwork's recommended pattern

**Why 🇻🇳 emoji vs [VN] text?**

- Visual recognition faster with emoji
- Consistent with modern messaging UX
- Fallback to `[VN]` if encoding fails

**Why event in brackets [Created]?**

- Clear visual distinction from name
- Brackets indicate system-generated metadata
- Easier to parse visually

---

## Dependencies

### External Dependencies

- Chatwork API (`POST /rooms/{id}/messages`)
- Chatwork Message Notation API (tags: `[piconname]`, `[hr]`, `[qt]`, etc.)

### Internal Dependencies

- `@chatwork-bot/core` - TranslationIngressCommand interface
- `@chatwork-bot/chatwork` - Message parsing, API client, sender name resolution
- `resolveRoomMemberDisplayName` - Name lookup with caching
- `parseMessageDecoration` - Structure validation

### No New Dependencies Required

- All functionality uses existing code paths
- No new npm packages needed
- No new API endpoints needed

---

## Rollout & Operations

### Deployment Strategy

**Phase 1: Code deployment**

- Deploy new compose function
- Deploy new sender logic
- All new translations use new format
- No downtime required

**Phase 2: Monitoring**

- Watch logs for composition errors
- Monitor Chatwork API error rates
- Verify visual rendering in production rooms
- Collect user feedback

**Phase 3: Iteration (if needed)**

- Adjust format based on feedback
- Fine-tune emoji/prefix placement
- Optimize message length handling

### Rollback Plan

**If issues arise:**

1. **Code rollback:**

   ```bash
   git revert {commit-hash}
   git push
   ```

2. **Function rename rollback:**
   - Restore `composeTranslatedMessagePair` function name
   - Restore 2-message return signature
   - Restore 2-stage sender logic

3. **Testing after rollback:**
   ```bash
   bun test && bun run typecheck && bun run lint
   ```

**Rollback triggers:**

- Chatwork rendering breaks (tags don't work)
- Message length causes errors (exceeds API limits)
- User confusion with new format
- Critical bugs in compose logic

**Rollback safety:**

- No database changes to revert
- No config changes to revert
- Old messages unaffected
- New translations revert to old format immediately

### Monitoring & Observability

**Metrics to watch:**

1. **Delivery success rate**
   - Before: Track metadata + body separately
   - After: Track single message delivery
   - Expect: Same success rate or better (fewer API calls)

2. **API error rates**
   - Watch for message size errors (413 Payload Too Large)
   - Watch for malformed message errors (400 Bad Request)

3. **Composition errors**
   - Structure validation failures
   - Missing segment errors
   - Encoding errors

**Logging enhancements:**

```typescript
console.log(
  JSON.stringify({
    level: 'info',
    event: 'translation_composed_single_message',
    traceId,
    messageLength: composed.message.length,
    originalBodyLength,
    translatedBodyLength,
    eventType: command.sourceEventType,
  }),
)
```

### Performance Impact

**API calls:**

- Before: 2 API calls per translation (metadata + body)
- After: 1 API call per translation
- Improvement: 50% reduction in API calls

**Network latency:**

- Before: ~200ms + ~200ms = ~400ms (sequential)
- After: ~200ms (single call)
- Improvement: ~50% faster delivery

**Message size:**

- Before: Small metadata + medium body = ~2KB total
- After: Larger single message = ~3-4KB
- Trade-off: Acceptable (still well under limits)

**Memory:**

- Negligible change - composing strings in memory
- No additional caching needed

---

## Acceptance Criteria

### Functional Requirements

- ✅ Translated message displays sender's avatar (via `[piconname:{id}]`)
- ✅ Translated message displays sender's name (resolved or fallback)
- ✅ Event type shows `[Created]` or `[Updated]` in header line
- ✅ Emoji 🇻🇳 appears in header line
- ✅ Original message body preserved with all tags
- ✅ `[hr]` divider separates original from translation
- ✅ Translated message body preserves all tag structures
- ✅ Single message sent (not 2 messages)
- ✅ Quote tags `[qt][qtmeta]` work in both sections
- ✅ Reply tags `[rp]` work in both sections
- ✅ Code blocks `[code]` preserved byte-identical
- ✅ Info/title wrappers preserved in structure

### Technical Requirements

- ✅ All unit tests pass (compose function)
- ✅ All integration tests pass (sender function)
- ✅ Type checking passes (`bun run typecheck`)
- ✅ Linting passes (`bun run lint`)
- ✅ No new ESLint warnings or errors
- ✅ Function renamed: `composeTranslatedMessage` (singular)
- ✅ Return type changed to single `message` field
- ✅ Sender simplified to 1-stage send
- ✅ Retry logic consolidated

### User Experience Requirements

- ✅ Visual appearance matches original message style
- ✅ Translation clearly identified by emoji + event indicator
- ✅ Original text available for context/verification
- ✅ No visual clutter (single message vs 2)
- ✅ Quote/reply functionality preserved
- ✅ Readable on mobile and desktop

### Quality Requirements

- ✅ No placeholders or TODOs in code
- ✅ All code paths tested
- ✅ Error messages clear and actionable
- ✅ Logging sufficient for debugging
- ✅ Code follows existing patterns and style

---

## Open Risks & Trade-offs

### Accepted Trade-offs

1. **Message length increases**
   - Old: ~1KB (2 messages total)
   - New: ~3-4KB (1 message with original + translation)
   - Mitigation: Truncate original if combined length exceeds threshold

2. **Loss of metadata fields**
   - Old: Room name, Sent time, Updated time visible in metadata box
   - New: Only event type in header (Room/timestamps hidden)
   - Rationale: Visual matching priority > verbose metadata

3. **Original text always included**
   - Cannot opt-out per message
   - Some users may prefer translation-only
   - Future: Add room config option if needed

### Open Risks

**LOW RISK - Chatwork rendering behavior:**

- `[piconname:{id}]` tag may have undocumented edge cases
- Mitigation: Manual verification catches rendering issues
- Fallback: Literal text `[piconname:100]` is still readable

**LOW RISK - Message size limit:**

- Chatwork API doesn't document exact character limit
- Very long messages (>10,000 chars) might exceed limit
- Mitigation: Truncate original section if total > 18,000 chars

**VERY LOW RISK - Emoji encoding:**

- UTF-8 emoji might fail in some environments
- Mitigation: Fallback to `[VN]` text if encoding errors detected

### Out of Scope (Future Enhancements)

1. **Configurable format per room** - Some users may want translation-only
2. **Collapsible metadata** - Using `[info]` spoiler for Room/timestamp
3. **Custom emoji per language** - 🇯🇵 for Japanese source, 🇻🇳 for Vietnamese target
4. **Hide original text toggle** - Room setting to show/hide original
5. **Update existing messages** - Migrate old 2-message format (not recommended)

---

## References

- **Chatwork Message Notation:** https://developer.chatwork.com/ja/messagenotation.html
- **Chatwork API Reference:** `docs/references/chatwork-api-reference.md`
- **Current implementation:** Commits 115079a (Task 1), 0c973a0 (Task 2)
- **Related file:** `packages/chatwork/src/services/compose-translated-message-pair.ts`

---

## Summary

This design transforms translation messages from a 2-message metadata-box format to a single visually-matching format that resembles the original message. By using Chatwork's native `[piconname:{id}]` tag and including both original and translated content in one message, we achieve the "100% best effort" visual matching goal while preserving all existing functionality for quotes, replies, and code blocks.

The implementation is minimal (primarily refactoring the compose function), low-risk (easy rollback), and provides significant UX improvements (cleaner room appearance, better context preservation, faster delivery).
