# Visual Matching Translation Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform translation messages from 2-message format (metadata box + body) to single visually-matching format with sender avatar, event indicator, original text, and translation.

**Architecture:** Refactor `compose-translated-message-pair.ts` to return single message string with `[piconname:{id}] Name 🇻🇳 [Event]\nOriginal\n[hr]\nTranslation` format. Simplify `chatwork-sender.ts` to send once. Add mode parameter to renderNode for original vs translated rendering.

**Tech Stack:** Bun 1.1+, TypeScript 5.4+ strict, Zod validation, Chatwork Message Notation API

**Design Spec:** `docs/superpowers/specs/2026-04-03-visual-matching-translation-format.md`

---

## Task 1: Refactor compose function signature and add header composition

**Files:**

- Rename: `packages/chatwork/src/services/compose-translated-message-pair.ts` → `compose-translated-message.ts`
- Modify: `compose-translated-message.ts` (entire function)
- Modify: `packages/chatwork/src/services/index.ts` (export statement)
- Test: `packages/chatwork/src/services/compose-translated-message-pair.test.ts` (will rename in next task)

**Step 1: Write failing test for single message format**

Create new test in `packages/chatwork/src/services/compose-translated-message-pair.test.ts`:

```typescript
it('returns single message with piconname header, original body, divider, and translated body', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }
  const segments = ['Vietnamese translation']
  const roomMembers = [{ account_id: 100, name: 'AuPMH', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  expect(result).toHaveProperty('message')
  expect(result).not.toHaveProperty('metadataMessage')
  expect(result).not.toHaveProperty('bodyMessage')

  const lines = result.message.split('\n')
  expect(lines[0]).toBe('[piconname:100] AuPMH 🇻🇳 [Created]')
  expect(lines[1]).toBe('Original text')
  expect(lines[2]).toBe('[hr]')
  expect(lines[3]).toBe('Vietnamese translation')
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: FAIL with "composeTranslatedMessage is not defined"

**Step 3: Rename file and function**

```bash
git mv packages/chatwork/src/services/compose-translated-message-pair.ts packages/chatwork/src/services/compose-translated-message.ts
```

Update function name and return type in `compose-translated-message.ts`:

```typescript
interface ComposeResult {
  message: string
}

export async function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult> {
  // Function body - will implement in next steps
  // For now, keep existing logic but wrap in { message: ... }

  const { metadataMessage, bodyMessage } = await composeTranslatedMessagePair_OLD_LOGIC(...)

  // Temporary format - will refactor
  const message = `${metadataMessage}\n${bodyMessage}`

  return { message }
}
```

Update export in `packages/chatwork/src/services/index.ts`:

```typescript
export { composeTranslatedMessage } from './compose-translated-message.js'
export type { ComposeParams } from './compose-translated-message.js'
```

Remove old export: `export { composeTranslatedMessagePair } from './compose-translated-message-pair.js'`

**Step 4: Update test import**

In `compose-translated-message-pair.test.ts`, update import:

```typescript
import { composeTranslatedMessage, type ComposeParams } from './compose-translated-message.js'
```

**Step 5: Run test again**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: FAIL with "expected '[piconname:100] AuPMH 🇻🇳 [Created]' but got '[info][title]...'"

**Step 6: Commit rename and interface change**

```bash
git add packages/chatwork/src/services/compose-translated-message.ts packages/chatwork/src/services/index.ts packages/chatwork/src/services/compose-translated-message-pair.test.ts
git commit -m "refactor(chatwork): rename compose function to singular and change return type

Renames composeTranslatedMessagePair → composeTranslatedMessage.
Changes return from { metadataMessage, bodyMessage } to { message }.
Adds failing test for new single-message format."
```

---

## Task 2: Implement header composition logic

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message.ts:1-50`
- Test: Same test from Task 1

**Step 1: Implement header building**

In `compose-translated-message.ts`, replace temporary logic with:

```typescript
export async function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult> {
  const { translatedSegments, roomMembers, chatworkApiToken } = params

  // Resolve sender name
  const senderName = await resolveMemberDisplayNameSafe(
    command.senderAccountId,
    roomMembers,
    command.sourceRoomId,
    chatworkApiToken,
  )

  // Build header line
  const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
  const header = `[piconname:${command.senderAccountId}] ${senderName} 🇻🇳 [${eventType}]`

  // TODO: Build original body
  const originalBody = 'Original text' // Placeholder

  // TODO: Build translated body
  const translatedBody = translatedSegments[0] || '' // Placeholder

  // Compose single message
  const message = [header, originalBody, '[hr]', translatedBody].join('\n')

  return { message }
}
```

**Step 2: Run test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "returns single message"`

Expected: PASS (header line correct, but body still placeholder)

**Step 3: Add test for Updated event**

Add test:

```typescript
it('shows [Updated] indicator for message_updated events', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    senderAccountId: 100,
    sourceEventType: 'message_updated',
  }
  const segments = ['Translation']
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  expect(result.message).toContain('[Updated]')
  expect(result.message).not.toContain('[Created]')
})
```

**Step 4: Run test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "Updated"`

Expected: PASS

**Step 5: Add test for fallback name**

Add test:

```typescript
it('uses fallback #accountId when name resolution fails', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    senderAccountId: 999,
    sourceEventType: 'message_created',
  }
  const segments = ['Translation']
  const roomMembers = [] // Empty - no match

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  expect(result.message).toContain('[piconname:999] #999 🇻🇳 [Created]')
})
```

**Step 6: Run test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "fallback"`

Expected: PASS (existing resolveMemberDisplayNameSafe handles this)

**Step 7: Commit header logic**

```bash
git add packages/chatwork/src/services/compose-translated-message.ts packages/chatwork/src/services/compose-translated-message-pair.test.ts
git commit -m "feat(chatwork): implement header composition with event indicator

Builds header line: [piconname:{id}] Name 🇻🇳 [Created/Updated].
Handles fallback to #accountId when name resolution fails.
Tests verify Created vs Updated events and fallback behavior."
```

---

## Task 3: Add mode parameter to renderNode for original body extraction

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message.ts` (renderNode helper)
- Test: `packages/chatwork/src/services/compose-translated-message-pair.test.ts`

**Step 1: Write failing test for original body preservation**

Add test:

```typescript
it('preserves original body with all Chatwork tags intact', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: '[qt][qtmeta aid=200 time=1234567890]Previous[/qt]\nNew message',
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  // Parse to get snapshot
  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = ['Translated quote', 'Translated new message']
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  // Original section should have original text with quote tag
  const lines = result.message.split('\n')
  const hrIndex = lines.indexOf('[hr]')
  const originalSection = lines.slice(1, hrIndex).join('\n')

  expect(originalSection).toContain('[qt][qtmeta aid=200 time=1234567890]Previous[/qt]')
  expect(originalSection).toContain('New message')

  // Translated section should have translations with same structure
  const translatedSection = lines.slice(hrIndex + 1).join('\n')
  expect(translatedSection).toContain('[qt][qtmeta aid=200 time=1234567890]Translated quote[/qt]')
  expect(translatedSection).toContain('Translated new message')
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "preserves original body"`

Expected: FAIL with assertion error (original body is still 'Original text' placeholder)

**Step 3: Modify renderNode to accept mode parameter**

In `compose-translated-message.ts`, update the `renderNode` helper:

```typescript
interface RenderContext {
  mode: 'original' | 'translated'
  translatedSegments: string[]
  nextIndex: { value: number }
}

function renderNode(node: MessageRenderNode, context: RenderContext): string {
  if (node.type === 'literal') {
    // Empty literals (whitespace) preserved as-is
    if (node.content.trim().length === 0) {
      return node.content
    }

    if (context.mode === 'original') {
      // Return original content unchanged
      return node.content
    } else {
      // Use translated segment (existing logic)
      const translated = context.translatedSegments[context.nextIndex.value]
      if (translated === undefined) {
        throw new Error(
          `Not enough translated segments. Expected at least ${context.nextIndex.value + 1}, got ${context.translatedSegments.length}`,
        )
      }
      context.nextIndex.value++
      return preserveOuterWhitespace(node.content, translated)
    }
  }

  // Recursive rendering for all structured nodes
  if (node.type === 'hr') {
    return '[hr]'
  }

  if (node.type === 'code') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[code]${inner}[/code]`
  }

  if (node.type === 'rp') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[rp aid=${node.aid} to=${node.to}]${inner}`
  }

  if (node.type === 'qt') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[qt][qtmeta aid=${node.aid} time=${node.time}]${inner}[/qt]`
  }

  if (node.type === 'info') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[info]${inner}[/info]`
  }

  if (node.type === 'title') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[title]${inner}[/title]`
  }

  if (node.type === 'quote') {
    const inner = node.children.map((child) => renderNode(child, context)).join('')
    return `[quote]${inner}[/quote]`
  }

  // Translationslot should never appear in render tree
  throw new Error(`Unexpected node type in render tree: ${(node as any).type}`)
}
```

**Step 4: Update compose function to use new renderNode**

Replace the main compose logic:

```typescript
export async function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult> {
  const { translatedSegments, roomMembers, chatworkApiToken } = params

  // Validate snapshot exists
  if (!command.snapshot) {
    throw new Error('Command snapshot is required for message composition')
  }

  const { renderTemplate } = command.snapshot

  // Resolve sender name
  const senderName = await resolveMemberDisplayNameSafe(
    command.senderAccountId,
    roomMembers,
    command.sourceRoomId,
    chatworkApiToken,
  )

  // Build header
  const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
  const header = `[piconname:${command.senderAccountId}] ${senderName} 🇻🇳 [${eventType}]`

  // Render original body
  const originalContext: RenderContext = {
    mode: 'original',
    translatedSegments: [], // Not used in original mode
    nextIndex: { value: 0 },
  }
  const originalBody = renderTemplate.map((node) => renderNode(node, originalContext)).join('')

  // Render translated body
  const translatedContext: RenderContext = {
    mode: 'translated',
    translatedSegments,
    nextIndex: { value: 0 },
  }
  const translatedBody = renderTemplate.map((node) => renderNode(node, translatedContext)).join('')

  // Handle empty original body
  const message =
    originalBody.trim() === ''
      ? `${header}\n[hr]\n${translatedBody}`
      : `${header}\n${originalBody}\n[hr]\n${translatedBody}`

  return { message }
}
```

**Step 5: Run test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "returns single message"`

Expected: PASS

**Step 6: Run test for original body preservation**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "preserves original body"`

Expected: PASS

**Step 7: Commit implementation**

```bash
git add packages/chatwork/src/services/compose-translated-message.ts
git commit -m "feat(chatwork): implement original body rendering with mode parameter

Adds RenderContext with mode: 'original' | 'translated' to renderNode.
Original mode returns literal content as-is, translated mode substitutes
segments. Preserves all Chatwork tags (qt, rp, code, info) in both modes."
```

---

## Task 4: Add comprehensive unit tests for edge cases

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message-pair.test.ts:1-999`
- No implementation changes

**Step 1: Write test for reply preservation**

Add test:

```typescript
it('preserves reply structure in both original and translated sections', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: '[rp aid=200 to=777-123]Thank you!',
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = ['Cảm ơn bạn!']
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  // Original section has reply tag
  expect(result.message).toContain('[rp aid=200 to=777-123]Thank you!')

  // Translated section has same tag structure
  expect(result.message).toContain('[rp aid=200 to=777-123]Cảm ơn bạn!')
})
```

**Step 2: Write test for code block preservation**

Add test:

```typescript
it('preserves code blocks byte-identical in both sections', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: 'Check this:\n[code]const x = 1;\nconsole.log(x);[/code]',
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = ['Kiểm tra cái này:'] // Code not translated
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  const codeBlock = '[code]const x = 1;\nconsole.log(x);[/code]'

  // Original section has original code
  expect(result.message).toContain(`Check this:\n${codeBlock}`)

  // Translated section has same code
  expect(result.message).toContain(`Kiểm tra cái này:\n${codeBlock}`)
})
```

**Step 3: Write test for empty original body**

Add test:

```typescript
it('skips empty original section when body has no translatable content', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: '[code]const x = 1;[/code]', // No translatable text
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = [] // No translations
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  const lines = result.message.split('\n')

  // Format: Header\n[hr]\n[code]...[/code]
  expect(lines[0]).toContain('[piconname:100]')
  expect(lines[1]).toBe('[hr]')
  expect(lines[2]).toContain('[code]')

  // No empty line between header and [hr]
  expect(lines.length).toBe(3)
})
```

**Step 4: Write test for info/title preservation**

Add test:

```typescript
it('preserves info and title wrappers in both sections', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: '[info][title]Important[/title]Please read carefully[/info]',
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = ['Quan trọng', 'Vui lòng đọc kỹ']
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  // Original section
  expect(result.message).toContain('[info][title]Important[/title]Please read carefully[/info]')

  // Translated section
  expect(result.message).toContain('[info][title]Quan trọng[/title]Vui lòng đọc kỹ[/info]')
})
```

**Step 5: Write test for nested quotes**

Add test:

```typescript
it('handles nested quote structures correctly', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    rawBody: '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Inner[/qt]Outer[/qt]\nNew',
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const snapshot = parseMessageDecoration(command.rawBody, command.languageTarget)
  command.snapshot = snapshot

  const segments = ['Trong', 'Ngoài', 'Mới']
  const roomMembers = [{ account_id: 100, name: 'Test', role: 'member' }]

  const result = await composeTranslatedMessage(command, {
    translatedSegments: segments,
    roomMembers,
    chatworkApiToken: 'test-token',
  })

  // Original nested structure
  expect(result.message).toContain(
    '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Inner[/qt]Outer[/qt]',
  )

  // Translated nested structure
  expect(result.message).toContain(
    '[qt][qtmeta aid=200 time=123][qt][qtmeta aid=300 time=456]Trong[/qt]Ngoài[/qt]',
  )
})
```

**Step 6: Run all new tests**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: All new tests PASS

**Step 7: Commit tests**

```bash
git add packages/chatwork/src/services/compose-translated-message-pair.test.ts
git commit -m "test(chatwork): add edge case tests for original body rendering

Tests reply preservation, code blocks, empty body, info/title wrappers,
and nested quotes. Verifies both original and translated sections maintain
identical structure with appropriate content substitution."
```

---

## Task 5: Update all existing tests to new format

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message-pair.test.ts:50-400` (all existing tests)

**Step 1: List all existing tests that need updates**

Run: `grep -n "it('" packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Identify all tests that assert on `metadataMessage` or `bodyMessage` properties.

**Step 2: Update first existing test**

Find first test (likely around line 50-60), update assertions:

Before:

```typescript
expect(result.metadataMessage).toContain('[piconname:100]')
expect(result.bodyMessage).toBe('translated text')
```

After:

```typescript
expect(result.message).toContain('[piconname:100]')
expect(result.message).toContain('translated text')
expect(result).not.toHaveProperty('metadataMessage')
expect(result).not.toHaveProperty('bodyMessage')
```

**Step 3: Run test**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts -t "<test name>"`

Expected: PASS

**Step 4: Update all remaining tests**

Pattern to apply:

```typescript
// Old format assertions
expect(result.metadataMessage).toContain(X)
expect(result.bodyMessage).toContain(Y)

// New format assertions
expect(result.message).toContain(X)
expect(result.message).toContain(Y)
expect(result).not.toHaveProperty('metadataMessage')
expect(result).not.toHaveProperty('bodyMessage')
```

Update ~8-10 existing tests with this pattern.

**Step 5: Run full test suite for compose function**

Run: `bun test packages/chatwork/src/services/compose-translated-message-pair.test.ts`

Expected: All tests PASS

**Step 6: Rename test file**

```bash
git mv packages/chatwork/src/services/compose-translated-message-pair.test.ts packages/chatwork/src/services/compose-translated-message.test.ts
```

**Step 7: Commit test updates**

```bash
git add packages/chatwork/src/services/compose-translated-message.test.ts
git commit -m "test(chatwork): update all tests to single-message format

Renames test file to match new function name.
Updates all assertions from metadataMessage/bodyMessage properties
to single message property. All tests pass."
```

---

## Task 6: Update sender function to send single message

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.ts:1-200`
- Test: `packages/translator/src/services/chatwork-sender.test.ts`

**Step 1: Write failing test for single message send**

In `chatwork-sender.test.ts`, add test:

```typescript
it('sends single message with new format', async () => {
  const command: TranslationIngressCommand = {
    ...baseCommand,
    senderAccountId: 100,
    sourceEventType: 'message_created',
  }

  const result: TranslationPipelineResult = {
    status: 'success',
    segments: ['Translation'],
    trace: mockTrace,
  }

  const composed = {
    message: '[piconname:100] Test 🇻🇳 [Created]\nOriginal\n[hr]\nTranslation',
  }

  // Mock compose function
  vi.mock('@chatwork-bot/chatwork', () => ({
    composeTranslatedMessage: vi.fn().mockResolvedValue(composed),
    sendRoomMessage: vi.fn().mockResolvedValue({ message_id: 'msg-1' }),
  }))

  const delivery = await sendTranslatedMessage(command, result, config)

  expect(composeTranslatedMessage).toHaveBeenCalledOnce()
  expect(sendRoomMessage).toHaveBeenCalledOnce()
  expect(sendRoomMessage).toHaveBeenCalledWith(
    config.chatworkApiToken,
    config.destinationRoomId,
    composed.message,
  )
  expect(delivery.messages).toHaveLength(1)
  expect(delivery.messages[0].kind).toBe('message')
  expect(delivery.messages[0].status).toBe('sent')
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/translator/src/services/chatwork-sender.test.ts -t "sends single message"`

Expected: FAIL (function still calls old 2-stage logic)

**Step 3: Update import statement**

In `chatwork-sender.ts`, update import:

```typescript
import { composeTranslatedMessage, type ComposeParams } from '@chatwork-bot/chatwork'
```

Remove: `import { composeTranslatedMessagePair } from '@chatwork-bot/chatwork'`

**Step 4: Replace 2-stage send with single send**

Replace the entire `sendTranslatedMessage` function body:

```typescript
export async function sendTranslatedMessage(
  command: TranslationIngressCommand,
  result: TranslationPipelineResult,
  config: {
    destinationRoomId: string
    roomMembers: RoomMember[]
    chatworkApiToken: string
    chatworkApiBaseUrl: string
  },
  sleepFn = sleep,
): Promise<OutputDelivery> {
  const sentAt = Date.now()

  // Compose single message
  const composed = await composeTranslatedMessage(command, {
    translatedSegments: result.segments,
    roomMembers: config.roomMembers,
    chatworkApiToken: config.chatworkApiToken,
  })

  // Send with retry logic
  const delivery = await sendStageMessage('message', composed.message, config, sleepFn)

  return {
    status: delivery.status,
    destinationRoomId: config.destinationRoomId,
    messages: [delivery],
    ...(delivery.destinationMessageId
      ? { destinationMessageId: delivery.destinationMessageId }
      : {}),
    sentAt,
  }
}
```

**Step 5: Remove 'partial' status handling**

The `sendStageMessage` helper no longer needs to handle partial status. Verify it returns only `'sent'` or `'failed'`.

No changes needed if already correct. If `status: 'partial'` exists anywhere, remove it.

**Step 6: Run test**

Run: `bun test packages/translator/src/services/chatwork-sender.test.ts -t "sends single message"`

Expected: PASS

**Step 7: Commit sender refactoring**

```bash
git add packages/translator/src/services/chatwork-sender.ts
git commit -m "refactor(translator): simplify sender to single message delivery

Replaces 2-stage send (metadata + body) with single-stage send.
Eliminates 'partial' status - now only 'sent' or 'failed'.
Retry logic consolidated to single message send."
```

---

## Task 7: Update integration test mocks and assertions

**Files:**

- Modify: `packages/translator/src/services/chatwork-sender.test.ts:1-300`

**Step 1: Update all mock message constants**

Find all mocks like:

```typescript
const metadataMessage = '[info][title]Translation metadata[/title]Event: created[/info]'
const bodyMessage = 'Translated text'
```

Replace with:

```typescript
const composedMessage =
  '[piconname:34567] TestUser 🇻🇳 [Created]\nOriginal text\n[hr]\nTranslated text'
```

**Step 2: Update all test assertions**

Pattern to find:

```typescript
expect(delivery.messages).toHaveLength(2)
expect(delivery.messages[0].kind).toBe('metadata')
expect(delivery.messages[1].kind).toBe('body')
```

Replace with:

```typescript
expect(delivery.messages).toHaveLength(1)
expect(delivery.messages[0].kind).toBe('message')
expect(delivery.messages[0].status).toBe('sent')
```

**Step 3: Update status assertions**

Remove any assertions for `status: 'partial'`:

```typescript
// Remove this
expect(delivery.status).toBe('partial')

// Keep these
expect(delivery.status).toBe('sent')
expect(delivery.status).toBe('failed')
```

**Step 4: Update retry tests**

Find tests that verify retry behavior. Update to verify retry on SINGLE message:

```typescript
it('retries on network error for single message', async () => {
  const sendMock = vi
    .spyOn(chatworkApi, 'sendRoomMessage')
    .mockRejectedValueOnce(new Error('ECONNRESET'))
    .mockResolvedValueOnce({ message_id: 'msg-1' })

  const delivery = await sendTranslatedMessage(command, result, config)

  expect(sendMock).toHaveBeenCalledTimes(2) // 1 fail + 1 retry = 2 total
  expect(delivery.status).toBe('sent')
  expect(delivery.messages).toHaveLength(1)
})
```

**Step 5: Run full integration test suite**

Run: `bun test packages/translator/src/services/chatwork-sender.test.ts`

Expected: All tests PASS

**Step 6: Commit integration test updates**

```bash
git add packages/translator/src/services/chatwork-sender.test.ts
git commit -m "test(translator): update integration tests for single-message format

Updates all mocks to use new single-message format.
Updates assertions to verify 1 message sent (not 2).
Removes 'partial' status checks. Retry tests updated."
```

---

## Task 8: Run full test suite and typecheck

**Files:**

- None (validation only)

**Step 1: Run all unit tests**

Run: `bun test packages/chatwork packages/translator`

Expected: All tests PASS

**Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: No type errors

**Step 3: Run linter**

Run: `bun run lint`

Expected: No lint errors

**Step 4: Run full test suite**

Run: `bun test`

Expected: All tests PASS (835+ tests)

**Step 5: Verify no regressions**

Run: `git diff --stat origin/main`

Verify only expected files changed:

- `packages/chatwork/src/services/compose-translated-message.ts` (renamed)
- `packages/chatwork/src/services/compose-translated-message.test.ts` (renamed)
- `packages/chatwork/src/services/index.ts` (export)
- `packages/translator/src/services/chatwork-sender.ts` (simplified)
- `packages/translator/src/services/chatwork-sender.test.ts` (updated)

**Step 6: Commit verification checkpoint**

No commit needed - this is validation only.

---

## Task 9: Manual verification in development environment

**Files:**

- None (manual testing only)

**Prerequisites:**

- Dev server running: `bun run dev`
- Chatwork test room configured
- Webhook pointing to localhost

**Step 1: Send simple message**

In source room: `テストメッセージ`

**Expected result in destination room:**

```
[piconname:100] YourName 🇻🇳 [Created]
テストメッセージ
[hr]
Tin nhắn thử nghiệm
```

**Verify:**

- ✅ Your avatar displays (not bot avatar)
- ✅ Your name displays
- ✅ `🇻🇳` emoji visible
- ✅ `[Created]` visible
- ✅ Original text preserved
- ✅ `[hr]` renders as horizontal line
- ✅ Translation text correct

**Step 2: Update the message**

Edit previous message in source room: `更新したメッセージ`

**Expected result:**

```
[piconname:100] YourName 🇻🇳 [Updated]
更新したメッセージ
[hr]
Tin nhắn đã cập nhật
```

**Verify:**

- ✅ Event shows `[Updated]` (not `[Created]`)

**Step 3: Send message with quote**

In source room, reply to someone's message with quote

**Expected result:**

- ✅ Quote structure preserved in original section
- ✅ Quote structure preserved in translated section
- ✅ Quote clickable and navigates to original

**Step 4: Send message with reply**

In source room, use reply function (RE icon)

**Expected result:**

- ✅ `[rp]` tag preserved
- ✅ Reply icon and link work in both sections

**Step 5: Send code block**

In source room: ` ```const x = 1;``` `

**Expected result:**

- ✅ Code block preserved byte-identical
- ✅ Code NOT translated
- ✅ Code formatted correctly

**Step 6: Send long message**

In source room: 500+ character message

**Expected result:**

- ✅ Both sections render fully
- ✅ No truncation issues
- ✅ Readable on mobile and desktop

**Step 7: Document verification results**

Create: `docs/verification/2026-04-03-visual-matching-manual-tests.md`

Format:

```markdown
# Manual Verification Results

**Date:** 2026-04-03  
**Tester:** [Your name]  
**Environment:** Local dev (MacOS)

## Test Results

| Test Case          | Status  | Notes                             |
| ------------------ | ------- | --------------------------------- |
| Simple message     | ✅ PASS | Avatar and name display correctly |
| Updated message    | ✅ PASS | [Updated] indicator works         |
| Message with quote | ✅ PASS | Quote preserved and clickable     |
| Message with reply | ✅ PASS | Reply icon works                  |
| Code block         | ✅ PASS | Code not translated, formatted    |
| Long message       | ✅ PASS | No truncation                     |

## Screenshots

[Attach screenshots if available]

## Issues Found

[None / List any issues]
```

**Step 8: Commit verification doc**

```bash
git add docs/verification/2026-04-03-visual-matching-manual-tests.md
git commit -m "docs(repo): add manual verification results for visual matching format"
```

---

## Task 10: Create final summary and merge checklist

**Files:**

- Create: `docs/superpowers/plans/2026-04-03-visual-matching-translation-format-completion.md`

**Step 1: Create completion checklist**

````markdown
# Visual Matching Translation Format - Completion Checklist

**Status:** ✅ Ready for merge  
**Date:** 2026-04-03

## Implementation Checklist

- ✅ Renamed `composeTranslatedMessagePair` → `composeTranslatedMessage`
- ✅ Changed return type to `{ message: string }`
- ✅ Implemented header composition with `[piconname:{id}] Name 🇻🇳 [Event]`
- ✅ Added mode parameter to renderNode (original vs translated)
- ✅ Implemented original body rendering
- ✅ Preserved all Chatwork tags (qt, rp, code, info, title)
- ✅ Simplified sender to single-stage send
- ✅ Removed 'partial' status
- ✅ Updated all unit tests
- ✅ Updated all integration tests
- ✅ Renamed test file

## Validation Checklist

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Full test suite passes (835+ tests)
- ✅ Typecheck passes (no errors)
- ✅ Lint passes (no warnings)
- ✅ Manual verification complete

## Manual Verification Results

- ✅ Simple message displays correctly
- ✅ Updated event indicator works
- ✅ Quote preservation verified
- ✅ Reply preservation verified
- ✅ Code blocks preserved
- ✅ Long messages render correctly
- ✅ Mobile rendering verified
- ✅ Desktop rendering verified

## Files Changed

- `packages/chatwork/src/services/compose-translated-message.ts` (renamed + refactored)
- `packages/chatwork/src/services/compose-translated-message.test.ts` (renamed + updated)
- `packages/chatwork/src/services/index.ts` (export updated)
- `packages/translator/src/services/chatwork-sender.ts` (simplified)
- `packages/translator/src/services/chatwork-sender.test.ts` (updated)

## Commits

- `refactor(chatwork): rename compose function to singular and change return type`
- `feat(chatwork): implement header composition with event indicator`
- `feat(chatwork): implement original body rendering with mode parameter`
- `test(chatwork): add edge case tests for original body rendering`
- `test(chatwork): update all tests to single-message format`
- `refactor(translator): simplify sender to single message delivery`
- `test(translator): update integration tests for single-message format`
- `docs(repo): add manual verification results`

## Rollback Plan

If issues arise:

```bash
git revert HEAD~7..HEAD
git push
```
````

All changes in single feature branch - easy to revert atomically.

## Next Steps

- [ ] Create PR: `feat/visual-matching-translation-format`
- [ ] Request review from team
- [ ] Monitor Chatwork API error rates after deployment
- [ ] Collect user feedback on new format
- [ ] Consider future enhancements (configurable format per room)

````

**Step 2: Save completion doc**

Save to: `docs/superpowers/plans/2026-04-03-visual-matching-translation-format-completion.md`

**Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-03-visual-matching-translation-format-completion.md
git commit -m "docs(repo): add completion checklist for visual matching format"
````

---

## Definition of Done

**All these must be true:**

✅ Function renamed to `composeTranslatedMessage` (singular)  
✅ Return type changed to `{ message: string }`  
✅ Header format: `[piconname:{id}] Name 🇻🇳 [Event]`  
✅ Original body rendered with all tags preserved  
✅ Translated body rendered with all tags preserved  
✅ `[hr]` divider between sections  
✅ Empty original body handled (skip section)  
✅ Sender sends single message (not 2)  
✅ All unit tests pass  
✅ All integration tests pass  
✅ Full test suite passes (835+ tests)  
✅ Typecheck passes  
✅ Lint passes  
✅ Manual verification complete (all test cases)  
✅ Documentation updated

**Validation commands:**

```bash
bun test && bun run typecheck && bun run lint
```

All must pass with no errors.

---

## Rollback Strategy

**If deployment issues occur:**

```bash
# Revert all commits
git log --oneline | head -n 10  # Find commit before Task 1
git revert {commit-hash}..HEAD
git push

# Verify rollback
bun test && bun run typecheck
```

**Rollback triggers:**

- Chatwork rendering errors
- Message size limit exceeded
- User confusion with new format
- API error rate spike

---

## Notes

- **No database changes** - rollback is simple
- **No breaking API changes** - only internal composition logic changed
- **Backwards compatible** - old messages unaffected
- **Low risk** - single file rename + logic refactor
- **High value** - significant UX improvement for visual matching

**Implementation time estimate:** ~2-3 hours with full TDD and testing

**Reference design spec:** `docs/superpowers/specs/2026-04-03-visual-matching-translation-format.md`
