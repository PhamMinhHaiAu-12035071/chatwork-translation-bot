# Avatar Display in Translation Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `[info][title]Translation metadata[/title]...[/info]` format with `[piconname:{account_id}]` to display sender avatar and name inline in translation messages.

**Architecture:** Modify `composeTranslatedMessagePair` to use Chatwork's built-in `[piconname:{account_id}]` tag instead of custom info box. This leverages Chatwork's native rendering for avatar + name display without requiring additional API calls or data fetching. The metadata message structure changes from an info box to inline format with avatar, while body message remains unchanged. All existing quote/reply tag preservation logic stays intact.

**Tech Stack:** TypeScript, Bun test, Chatwork Message Notation API

---

## File Structure

**Files to modify:**

- `packages/chatwork/src/services/compose-translated-message-pair.ts` - Update metadata message format
- `packages/chatwork/src/services/compose-translated-message-pair.test.ts` - Update test assertions

**No new files needed** - this is a format change to existing output

---

### Task 1: Update metadata message format to use piconname tag

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message-pair.ts:116-119`
- Test: `packages/chatwork/src/services/compose-translated-message-pair.test.ts`

- [ ] **Step 1: Write failing test for new piconname format**

Open `packages/chatwork/src/services/compose-translated-message-pair.test.ts` and add new test case:

```typescript
it('uses piconname tag to display sender avatar and name in metadata', async () => {
  const command = makeCommand('Hello world', {
    webhook_event: {
      account_id: 100,
      send_time: 1711271400,
    },
  })

  const result = await composeTranslatedMessagePair(command, {
    translatedSegments: ['Xin chao the gioi'],
    apiToken: 'test-token',
    memberCache: new Map([[100, 'Alice']]),
    roomCache: new Map([[777, 'JP Project Demo']]),
  })

  expect(result.metadataMessage).toContain('[piconname:100]')
  expect(result.metadataMessage).not.toContain('[info]')
  expect(result.metadataMessage).not.toContain('[title]')
  expect(result.metadataMessage).toContain('Event: created')
  expect(result.metadataMessage).toContain('Sender: Alice')
  expect(result.metadataMessage).toContain('Room: JP Project Demo')
  expect(result.metadataMessage).toContain('Sent: 2024-03-24 12:30')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: FAIL with assertion error - metadata should contain `[piconname:100]` but contains `[info][title]Translation metadata[/title]...` instead

- [ ] **Step 3: Update compose function to use piconname tag**

In `packages/chatwork/src/services/compose-translated-message-pair.ts`, locate the return statement (around line 116-119) and change from:

```typescript
return {
  metadataMessage: `[info][title]Translation metadata[/title]${metadataLines.join('\n')}[/info]`,
  bodyMessage,
}
```

To:

```typescript
return {
  metadataMessage: `[piconname:${String(command.senderAccountId)}]\n${metadataLines.join('\n')}`,
  bodyMessage,
}
```

- [ ] **Step 4: Run new test to verify it passes**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "uses piconname tag"`

Expected: PASS - metadata now contains `[piconname:100]` and does not contain `[info]` or `[title]`

- [ ] **Step 5: Update existing test assertions**

In `packages/chatwork/src/services/compose-translated-message-pair.test.ts`, find test "includes event, sender, room, timestamps in metadata..." (line 64) and update assertion:

Change from checking generic metadata content to checking piconname tag:

```typescript
it('includes event, sender, room, timestamps in metadata while removing source-only tags from body', async () => {
  // ... existing test setup ...

  expect(result.metadataMessage).toContain('[piconname:100]')
  expect(result.metadataMessage).toContain('updated')
  expect(result.metadataMessage).toContain('Alice')
  expect(result.metadataMessage).toContain('JP Project Demo')
  expect(result.metadataMessage).toContain(formatUtc(sendTime))
  expect(result.metadataMessage).toContain(formatUtc(updateTime))
  expect(result.metadataMessage).not.toContain('[info]')
  expect(result.metadataMessage).not.toContain('[title]')

  // ... rest of test remains unchanged ...
})
```

- [ ] **Step 6: Update test for nested quote metadata**

In test "includes node-local nested quote context..." (line 198), update metadata assertions:

```typescript
it('includes node-local nested quote context in metadata, strips To/Cc from body, and preserves [rp] tag', async () => {
  // ... existing test setup ...

  expect(result.metadataMessage).toContain('[piconname:100]')
  expect(result.metadataMessage).toContain('Event: created')
  expect(result.metadataMessage).toContain('Sender: Alice')
  expect(result.metadataMessage).toContain('Room: JP Project Demo')
  expect(result.metadataMessage).not.toContain('[info]')

  // ... rest of test remains unchanged ...
})
```

- [ ] **Step 7: Update test for fallback names**

In test "uses fallback account and room names..." (line 235), update to check piconname with fallback:

```typescript
it('uses fallback account and room names when lookups cannot resolve', async () => {
  const command = makeCommand('Hello')

  const result = await composeTranslatedMessagePair(command, {
    translatedSegments: ['Xin chao'],
    apiToken: 'test-token',
  })

  expect(result.metadataMessage).toContain('[piconname:100]')
  expect(result.metadataMessage).toContain('#100')
  expect(result.metadataMessage).toContain('Room #777')
  expect(result.bodyMessage).toBe('Xin chao')
})
```

- [ ] **Step 8: Run all tests to verify no regressions**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: All tests PASS - piconname format works correctly, body messages unchanged, quote/reply preservation intact

- [ ] **Step 9: Commit the changes**

```bash
git add packages/chatwork/src/services/compose-translated-message-pair.ts
git add packages/chatwork/src/services/compose-translated-message-pair.test.ts
git commit -m "feat(chatwork): use piconname tag for avatar display in metadata

Replace [info][title] wrapper with [piconname:{account_id}] to display
sender avatar and name using Chatwork's native rendering. Metadata still
includes Event, Sender, Room, and timestamps. Body message format unchanged.

Refs: https://developer.chatwork.com/ja/messagenotation.html"
```

---

### Task 2: Verify integration with chatwork-sender

**Files:**

- Test: `packages/translator/src/services/chatwork-sender.test.ts:60-61`

- [ ] **Step 1: Update mock metadata in chatwork-sender test**

In `packages/translator/src/services/chatwork-sender.test.ts`, locate the mock metadata (line 60) and update format:

Change from:

```typescript
const metadataMessage = '[info][title]Translation metadata[/title]Event: created[/info]'
```

To:

```typescript
const metadataMessage =
  '[piconname:34567]\nEvent: created\nSender: TestUser\nRoom: TestRoom\nSent: 2026-03-06 10:30'
```

- [ ] **Step 2: Run chatwork-sender tests**

Run: `bun test packages/translator/src/services/chatwork-sender.test.ts`

Expected: All tests PASS - mock format updated, no functional changes to sender logic

- [ ] **Step 3: Commit the test update**

```bash
git add packages/translator/src/services/chatwork-sender.test.ts
git commit -m "test(translator): update mock metadata format for piconname"
```

---

### Task 3: Manual verification with real webhook data

**Files:**

- Test: Manual verification using local dev environment

- [ ] **Step 1: Start local dev server**

Run: `bun run dev`

Expected: Server starts on port 3000, translation bot ready

- [ ] **Step 2: Send test message to monitored Chatwork room**

Using Chatwork web/mobile app, send a test message in Japanese:

```
テストメッセージです
```

- [ ] **Step 3: Verify translated message format in destination room**

Check destination room for translated message. Verify:

- ✅ Avatar image appears at top of message
- ✅ Sender name appears next to avatar
- ✅ Event, Sender (text), Room, Sent timestamp appear below
- ✅ No `[info]` or `[title]` box styling
- ✅ Translation body appears in second message
- ✅ Quote/reply tags (if any) still work correctly

Expected visual format:

```
[Alice's Avatar] Alice
Event: created
Sender: Alice
Room: JP Project Demo
Sent: 2026-04-03 07:36

---second message---
Đây là tin nhắn thử nghiệm
```

- [ ] **Step 4: Test with message containing quote**

Send test message with quote:

```
[qt][qtmeta aid=100 time=1711271400]前のメッセージ[/qt]
新しいメッセージ
```

Verify:

- ✅ Quote preserved in translated body
- ✅ Avatar + name display correct
- ✅ Metadata shows correct sender

- [ ] **Step 5: Test with message containing reply**

Send test message with reply to existing message. Verify:

- ✅ Reply tag `[rp aid=X to=Y-Z]` preserved
- ✅ "RE" icon clickable in Chatwork UI
- ✅ Metadata format correct

- [ ] **Step 6: Document verification results**

Create verification log in `docs/verification/2026-04-03-avatar-display.md`:

```markdown
# Avatar Display Verification - 2026-04-03

## Test Cases

### 1. Simple text message

- Status: ✅ PASS
- Avatar displays correctly
- Name displays correctly
- Metadata format correct

### 2. Message with quote

- Status: ✅ PASS
- Quote preserved and translated
- Avatar/name correct

### 3. Message with reply

- Status: ✅ PASS
- Reply tag preserved
- RE icon functional

## Screenshots

[Attach screenshots here]

## Conclusion

All formats working as expected. Ready for production.
```

- [ ] **Step 7: Final commit for verification docs**

```bash
git add docs/verification/2026-04-03-avatar-display.md
git commit -m "docs: add verification log for avatar display feature"
```

---

## Self-Review Checklist

**1. Spec Coverage:**

- ✅ Avatar display using `[piconname:{account_id}]` - Task 1
- ✅ Keep full metadata (Event, Sender, Room, Timestamp) - Task 1, Step 3
- ✅ Preserve quote/reply tags in body - Verified in Task 1, Step 8
- ✅ Integration with existing sender logic - Task 2
- ✅ Real webhook verification - Task 3

**2. Placeholder Scan:**

- ✅ No TBD, TODO, or "implement later" patterns
- ✅ All code blocks complete with actual TypeScript
- ✅ All test assertions specific and concrete
- ✅ Command examples with expected output

**3. Type Consistency:**

- ✅ `command.senderAccountId` used consistently (type: number)
- ✅ `metadataMessage` return type unchanged (string)
- ✅ `[piconname:${String(account_id)}]` format matches Chatwork spec
- ✅ Test mock types match actual function signatures

**4. Test Coverage:**

- ✅ Unit tests for piconname format
- ✅ Unit tests for metadata content preservation
- ✅ Unit tests for fallback behavior
- ✅ Integration test mocks updated
- ✅ Manual verification with real data

---

## Implementation Notes

**Why this approach:**

- Leverages Chatwork's native `[piconname]` tag - no custom parsing needed
- Minimal code change - one line in compose function
- Backwards compatible - only changes output format, not logic
- No API changes required - uses existing webhook data

**What stays the same:**

- Two-message output (metadata + body)
- Quote/reply tag preservation logic
- Translation pipeline
- Error handling and retries
- All existing test coverage for body composition

**What changes:**

- Metadata message format only
- Visual display in Chatwork (avatar appears inline)
- Test assertions for metadata format

**Rollback plan:**
If issues arise, revert by changing one line back to:

```typescript
metadataMessage: `[info][title]Translation metadata[/title]${metadataLines.join('\n')}[/info]`
```

No database migrations, no API changes, no config needed.
