# Mention-Aware Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject mention context (`[To:]`, `[cc:]`, `[toall]`) into LLM translation prompts so the LLM uses correct singular/plural address forms.

**Architecture:** Build mention hint string in orchestrator from parsed metadata, pass through backend → pipeline → translation-prompt as a new `mentionHint` optional parameter. Inject as `<MENTION_CONTEXT>` block in user prompt before translate block.

**Tech Stack:** Bun, TypeScript, Zod (existing stack — no new dependencies)

---

### File Map

| Action | File                                                                    | Responsibility                                   |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------------ |
| Modify | `packages/chatwork/src/types/message-decoration.ts`                     | Add `isToAll` to context, `toall` node type      |
| Modify | `packages/chatwork/src/services/parse-message-decoration.ts`            | Handle `[toall]` tag                             |
| Modify | `packages/chatwork/src/services/parse-message-decoration.test.ts`       | Tests for `[toall]` parsing                      |
| Modify | `packages/chatwork/src/services/compose-translated-message.ts`          | Render `[toall]` node                            |
| Modify | `packages/chatwork/src/services/compose-translated-message.test.ts`     | Test `[toall]` compose                           |
| Create | `packages/chatwork/src/services/extract-mention-context.ts`             | `extractMentionContext()` + `buildMentionHint()` |
| Create | `packages/chatwork/src/services/extract-mention-context.test.ts`        | Tests for mention extraction + hint building     |
| Modify | `packages/chatwork/src/index.ts`                                        | Export new utilities                             |
| Modify | `packages/translation-prompt/src/translation-prompt.ts`                 | Add `mentionHint` param to prompt builders       |
| Modify | `packages/translation-prompt/src/translation-prompt.test.ts`            | Test mention hint injection in prompts           |
| Modify | `packages/translator/src/services/translation-backend.ts`               | Add `mentionHint` to backend input interface     |
| Modify | `packages/translator/src/services/standard-translation-backend.ts`      | Forward `mentionHint` to pipeline                |
| Modify | `packages/translator/src/services/standard-translation-backend.test.ts` | Test `mentionHint` forwarding                    |
| Modify | `packages/translator/src/pipeline/pipeline.ts`                          | Add `mentionHint` to pipeline opts               |
| Modify | `packages/translator/src/services/room-translation-orchestrator.ts`     | Build mention hint from command snapshot         |

---

### Task 1: `[toall]` Parser Support

**Files:**

- Modify: `packages/chatwork/src/types/message-decoration.ts:48-54`
- Modify: `packages/chatwork/src/services/parse-message-decoration.ts:19-25,207-214`
- Test: `packages/chatwork/src/services/parse-message-decoration.test.ts`

- [ ] **Step 1: Add `isToAll` to type and `toall` node**

In `packages/chatwork/src/types/message-decoration.ts`, add `toall` to render node union and `isToAll` to context:

```typescript
// In MessageRenderNode union, after the 'cc' line:
  | { type: 'toall' }

// In MessageDecorationContext:
export interface MessageDecorationContext {
  toAccountIds: number[]
  ccAccountIds: number[]
  replyToData: ReplyToData | undefined
  isToAll: boolean
}
```

- [ ] **Step 2: Update `createDecorationContext()` in parser**

In `packages/chatwork/src/services/parse-message-decoration.ts`, add `isToAll: false` to `createDecorationContext()`:

```typescript
function createDecorationContext(): MessageDecorationContext {
  return {
    toAccountIds: [],
    ccAccountIds: [],
    replyToData: undefined,
    isToAll: false,
  }
}
```

- [ ] **Step 3: Add `[toall]` branch in `parseBody()`**

In `packages/chatwork/src/services/parse-message-decoration.ts`, add after the `cc` branch (around line 214):

```typescript
        } else if (tag.name === 'toall') {
          context.isToAll = true
          nodes.push({ type: 'toall' })
```

- [ ] **Step 4: Write failing tests for `[toall]` parsing**

In `packages/chatwork/src/services/parse-message-decoration.test.ts`, add:

```typescript
it('parses [toall] tag into metadata and render template', () => {
  const result = parseMessageDecoration('[toall]Good morning everyone')
  expect(result.metadata.isToAll).toBe(true)
  expect(result.translationInputs).toContain('Good morning everyone')
  const toallNode = result.renderTemplate.find((n) => n.type === 'toall')
  expect(toallNode).toBeDefined()
})

it('handles [toall] combined with [To:] tags', () => {
  const result = parseMessageDecoration('[toall][To:123]Alice\nHello')
  expect(result.metadata.isToAll).toBe(true)
  expect(result.metadata.toAccountIds).toContain(123)
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/chatwork/src/services/parse-message-decoration.test.ts`
Expected: All tests PASS (code was added before tests)

- [ ] **Step 6: Commit**

```bash
git add packages/chatwork/src/types/message-decoration.ts packages/chatwork/src/services/parse-message-decoration.ts packages/chatwork/src/services/parse-message-decoration.test.ts
git commit -m "feat(chatwork): add [toall] tag support in parser"
```

---

### Task 2: `[toall]` Compose Support

**Files:**

- Modify: `packages/chatwork/src/services/compose-translated-message.ts:93-100`
- Test: `packages/chatwork/src/services/compose-translated-message.test.ts`

- [ ] **Step 1: Write failing test for `[toall]` render**

In `packages/chatwork/src/services/compose-translated-message.test.ts`, add:

```typescript
it('preserves [toall] tag in translated body', async () => {
  const command = makeCommand('[toall]Good morning', {
    webhook_event: {
      account_id: 100,
      send_time: 1711271400,
    },
  })

  const result = await composeTranslatedMessage(command, {
    translatedSegments: ['Chào buổi sáng'],
    apiToken: 'test-token',
    roomCache: new Map([[777, 'Test Room']]),
  })

  expect(result.message).toContain('[toall]')
  expect(result.message).toContain('Chào buổi sáng')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/chatwork/src/services/compose-translated-message.test.ts -t "preserves [toall]"`
Expected: FAIL — `renderNode` doesn't handle `toall` type, exhaustive switch throws

- [ ] **Step 3: Add `[toall]` render in compose**

In `packages/chatwork/src/services/compose-translated-message.ts`, add after the `cc` block:

```typescript
if (node.type === 'toall') {
  return '[toall]'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/chatwork/src/services/compose-translated-message.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/chatwork/src/services/compose-translated-message.ts packages/chatwork/src/services/compose-translated-message.test.ts
git commit -m "feat(chatwork): render [toall] tag in compose output"
```

---

### Task 3: `extractMentionContext()` + `buildMentionHint()`

**Files:**

- Create: `packages/chatwork/src/services/extract-mention-context.ts`
- Create: `packages/chatwork/src/services/extract-mention-context.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/chatwork/src/services/extract-mention-context.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { parseMessageDecoration } from './parse-message-decoration'
import { extractMentionContext, buildMentionHint } from './extract-mention-context'

describe('extractMentionContext', () => {
  it('extracts single To recipient with display name', () => {
    const result = parseMessageDecoration('[To:5293785]AuPMH\nお疲れ様です')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 5293785, displayName: 'AuPMH' }])
    expect(mention.ccRecipients).toEqual([])
    expect(mention.isToAll).toBe(false)
  })

  it('extracts multiple To recipients', () => {
    const result = parseMessageDecoration('[To:123]Alice\n[To:456]Bob\nHello')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toHaveLength(2)
    expect(mention.toRecipients[0]).toEqual({ accountId: 123, displayName: 'Alice' })
    expect(mention.toRecipients[1]).toEqual({ accountId: 456, displayName: 'Bob' })
  })

  it('extracts CC recipients separately', () => {
    const result = parseMessageDecoration('[To:123]Alice\n[cc:456]Bob\nMessage')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 123, displayName: 'Alice' }])
    expect(mention.ccRecipients).toEqual([{ accountId: 456, displayName: 'Bob' }])
  })

  it('sets isToAll when [toall] is present', () => {
    const result = parseMessageDecoration('[toall]Hello everyone')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.isToAll).toBe(true)
  })

  it('returns empty arrays when no mentions', () => {
    const result = parseMessageDecoration('Plain text message')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([])
    expect(mention.ccRecipients).toEqual([])
    expect(mention.isToAll).toBe(false)
  })

  it('handles To node at end of message without following literal', () => {
    const result = parseMessageDecoration('[To:123]')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 123, displayName: '' }])
  })

  it('handles display name with parentheses', () => {
    const result = parseMessageDecoration('[To:123]ThinhNTT (ジェイ)\nMessage')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients[0]?.displayName).toBe('ThinhNTT (ジェイ)')
  })
})

describe('buildMentionHint', () => {
  it('returns undefined when no mentions', () => {
    const hint = buildMentionHint({
      toRecipients: [],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toBeUndefined()
  })

  it('returns plural hint for toall', () => {
    const hint = buildMentionHint({
      toRecipients: [],
      ccRecipients: [],
      isToAll: true,
    })
    expect(hint).toContain('all room members')
    expect(hint).toContain('plural')
  })

  it('returns singular hint for 1 To recipient', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'AuPMH' }],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toContain('1 person')
    expect(hint).toContain('AuPMH')
    expect(hint).toContain('singular')
  })

  it('returns plural hint for multiple To recipients', () => {
    const hint = buildMentionHint({
      toRecipients: [
        { accountId: 123, displayName: 'Alice' },
        { accountId: 456, displayName: 'Bob' },
      ],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toContain('2 people')
    expect(hint).toContain('Alice, Bob')
    expect(hint).toContain('plural')
  })

  it('separates To and CC in hint', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'Alice' }],
      ccRecipients: [{ accountId: 456, displayName: 'Bob' }],
      isToAll: false,
    })
    expect(hint).toContain('Alice')
    expect(hint).toContain('CC')
    expect(hint).toContain('Bob')
    expect(hint).toContain('singular')
  })

  it('toall overrides individual To/CC recipients', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'Alice' }],
      ccRecipients: [],
      isToAll: true,
    })
    expect(hint).toContain('all room members')
    expect(hint).toContain('plural')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/chatwork/src/services/extract-mention-context.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `extractMentionContext()` and `buildMentionHint()`**

Create `packages/chatwork/src/services/extract-mention-context.ts`:

```typescript
import type { MessageDecorationContext, MessageRenderNode } from '~/types/message-decoration'

export interface MentionRecipient {
  accountId: number
  displayName: string
}

export interface MentionContext {
  toRecipients: MentionRecipient[]
  ccRecipients: MentionRecipient[]
  isToAll: boolean
}

/**
 * Walk render template to extract mention recipients with display names.
 * Display name = text before first newline in the literal node following a to/cc node.
 */
export function extractMentionContext(
  renderTemplate: MessageRenderNode[],
  metadata: MessageDecorationContext,
): MentionContext {
  const toRecipients: MentionRecipient[] = []
  const ccRecipients: MentionRecipient[] = []

  for (let i = 0; i < renderTemplate.length; i++) {
    const node = renderTemplate[i]
    if (node === undefined) continue

    if (node.type === 'to' || node.type === 'cc') {
      const displayName = peekDisplayName(renderTemplate, i + 1)
      const recipient: MentionRecipient = { accountId: node.accountId, displayName }

      if (node.type === 'to') {
        toRecipients.push(recipient)
      } else {
        ccRecipients.push(recipient)
      }
    }
  }

  return { toRecipients, ccRecipients, isToAll: metadata.isToAll }
}

function peekDisplayName(nodes: MessageRenderNode[], index: number): string {
  const next = nodes[index]
  if (next === undefined || next.type !== 'literal') return ''

  const firstLine = next.content.split('\n')[0] ?? ''
  return firstLine.trim()
}

/**
 * Build a concise English hint for the LLM about message addressing.
 * Returns undefined when no mentions are present (DEC-007).
 */
export function buildMentionHint(context: MentionContext): string | undefined {
  const { toRecipients, ccRecipients, isToAll } = context

  // isToAll overrides individual mentions (priority rule)
  if (isToAll) {
    return 'Addressed to all room members. Use plural address (mọi người/các anh chị).'
  }

  if (toRecipients.length === 0 && ccRecipients.length === 0) {
    return undefined
  }

  const toNames = toRecipients.map((r) => r.displayName).filter(Boolean)
  const ccNames = ccRecipients.map((r) => r.displayName).filter(Boolean)
  const ccSuffix = ccNames.length > 0 ? ` CC: ${ccNames.join(', ')}.` : ''

  if (toRecipients.length === 1) {
    const name = toNames[0] ?? ''
    return `Directly addressed to 1 person: ${name}. Use singular address (anh/chị/bạn).${ccSuffix}`
  }

  const count = toRecipients.length
  return `Directly addressed to ${String(count)} people: ${toNames.join(', ')}. Use plural address.${ccSuffix}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/chatwork/src/services/extract-mention-context.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Export from package index**

In `packages/chatwork/src/index.ts`, add:

```typescript
export { extractMentionContext, buildMentionHint } from '~/services/extract-mention-context'
export type { MentionContext, MentionRecipient } from '~/services/extract-mention-context'
```

- [ ] **Step 6: Commit**

```bash
git add packages/chatwork/src/services/extract-mention-context.ts packages/chatwork/src/services/extract-mention-context.test.ts packages/chatwork/src/index.ts
git commit -m "feat(chatwork): add extractMentionContext and buildMentionHint utilities"
```

---

### Task 4: Prompt Injection (`@chatwork-bot/translation-prompt`)

**Files:**

- Modify: `packages/translation-prompt/src/translation-prompt.ts:45-117`
- Test: `packages/translation-prompt/src/translation-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/translation-prompt/src/translation-prompt.test.ts`, find existing tests and add:

```typescript
import { describe, expect, it } from 'bun:test'
import { buildSingleCallPrompts, buildStructuredTranslationPrompts } from './translation-prompt'

describe('mention hint injection', () => {
  it('injects MENTION_CONTEXT block in single call prompt when mentionHint provided', () => {
    const result = buildSingleCallPrompts(
      'お疲れ様です',
      'NATURAL_CASUAL',
      undefined,
      undefined,
      'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
    )
    expect(result.user).toContain('<MENTION_CONTEXT>')
    expect(result.user).toContain('Directly addressed to 1 person: AuPMH')
    expect(result.user).toContain('</MENTION_CONTEXT>')
    // Verify mention context appears before translate block
    const mentionIdx = result.user.indexOf('<MENTION_CONTEXT>')
    const translateIdx = result.user.indexOf('<TRANSLATE_TEXT>')
    expect(mentionIdx).toBeLessThan(translateIdx)
  })

  it('does NOT inject MENTION_CONTEXT when mentionHint is undefined', () => {
    const result = buildSingleCallPrompts('お疲れ様です', 'NATURAL_CASUAL')
    expect(result.user).not.toContain('<MENTION_CONTEXT>')
  })

  it('injects MENTION_CONTEXT block in structured prompt when mentionHint provided', () => {
    const result = buildStructuredTranslationPrompts(
      ['Segment 1', 'Segment 2'],
      'NATURAL_CASUAL',
      'Full context',
      undefined,
      undefined,
      'Addressed to all room members. Use plural address (mọi người/các anh chị).',
    )
    expect(result.user).toContain('<MENTION_CONTEXT>')
    expect(result.user).toContain('all room members')
    expect(result.user).toContain('</MENTION_CONTEXT>')
    const mentionIdx = result.user.indexOf('<MENTION_CONTEXT>')
    const translateIdx = result.user.indexOf('<TRANSLATE_SEGMENTS>')
    expect(mentionIdx).toBeLessThan(translateIdx)
  })

  it('does NOT inject MENTION_CONTEXT in structured prompt when mentionHint is undefined', () => {
    const result = buildStructuredTranslationPrompts(
      ['Segment 1'],
      'NATURAL_CASUAL',
      'Full context',
    )
    expect(result.user).not.toContain('<MENTION_CONTEXT>')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`
Expected: FAIL — no `<MENTION_CONTEXT>` in output

- [ ] **Step 3: Add `mentionHint` param to prompt builders**

In `packages/translation-prompt/src/translation-prompt.ts`:

Update `buildSingleUserPrompt`:

```typescript
function buildSingleUserPrompt(
  text: string,
  _style: TranslationStyle,
  mentionHint?: string,
): string {
  const mentionBlock = mentionHint
    ? `\n<MENTION_CONTEXT>\n${mentionHint}\n</MENTION_CONTEXT>\n`
    : ''

  return `Translate into Vietnamese as JSON:
{"sourceLang": "<language>", "translated": "<Vietnamese>"}
${mentionBlock}
<TRANSLATE_TEXT>
${text}
</TRANSLATE_TEXT>`
}
```

Update `buildStructuredUserPrompt`:

```typescript
function buildStructuredUserPrompt(
  segments: string[],
  _style: TranslationStyle,
  fullMessageContext?: string,
  mentionHint?: string,
): string {
  const contextBlock =
    fullMessageContext === undefined
      ? ''
      : `<MESSAGE_CONTEXT>
${fullMessageContext}
</MESSAGE_CONTEXT>

`

  const mentionBlock = mentionHint
    ? `<MENTION_CONTEXT>
${mentionHint}
</MENTION_CONTEXT>

`
    : ''

  return `Translate each segment into Vietnamese as JSON. Preserve array order/length exactly.
{"sourceLang": "<language>", "translatedSegments": ["<Vietnamese 1>", "<Vietnamese 2>"]}

${contextBlock}${mentionBlock}<TRANSLATE_SEGMENTS>
${JSON.stringify(segments, null, 2)}
</TRANSLATE_SEGMENTS>`
}
```

Update `buildSingleCallPrompts` signature:

```typescript
export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string,
  keywordSystemHint?: string,
  mentionHint?: string,
): PromptPair {
  // ... existing system build ...
  return {
    system: systemParts,
    user: buildSingleUserPrompt(text, style, mentionHint),
  }
}
```

Update `buildStructuredTranslationPrompts` signature:

```typescript
export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  fullMessageContext?: string,
  roomContext?: string,
  keywordSystemHint?: string,
  mentionHint?: string,
): PromptPair {
  // ... existing system build ...
  return {
    system: systemParts,
    user: buildStructuredUserPrompt(segments, style, fullMessageContext, mentionHint),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/translation-prompt/src/translation-prompt.ts packages/translation-prompt/src/translation-prompt.test.ts
git commit -m "feat(translation-prompt): inject mention context into LLM prompts"
```

---

### Task 5: Pipeline + Backend Integration (`@chatwork-bot/translator`)

**Files:**

- Modify: `packages/translator/src/services/translation-backend.ts:1-12`
- Modify: `packages/translator/src/pipeline/pipeline.ts:40-79`
- Modify: `packages/translator/src/services/standard-translation-backend.ts:14-78`
- Test: `packages/translator/src/services/standard-translation-backend.test.ts`

- [ ] **Step 1: Add `mentionHint` to backend input interface**

In `packages/translator/src/services/translation-backend.ts`:

```typescript
export interface RoomTranslationBackendInput<TRuntimeConfig = unknown> {
  cleanText: string
  translationInputs: string[]
  roomContext?: string
  keywordSystemHint?: string
  mentionHint?: string
  runtimeConfig: TRuntimeConfig
  phaseObserver?: {
    onPhaseStarted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseCompleted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseFailed?: (params: { phase: 'translation'; error: unknown }) => Promise<void> | void
  }
}
```

- [ ] **Step 2: Add `mentionHint` to pipeline opts**

In `packages/translator/src/pipeline/pipeline.ts`, add `mentionHint?: string` to constructor opts:

```typescript
export class TranslationPipeline {
  constructor(
    private readonly executor: ILLMExecutor,
    private readonly opts: {
      timeoutMs?: number
      translationStyle?: TranslationStyle
      roomContext?: string
      keywordSystemHint?: string
      mentionHint?: string
    } = {},
  ) {}
```

Then pass `mentionHint` to prompt builder calls:

In `runStructured()`, update the single-call branch:

```typescript
const prompts = buildSingleCallPrompts(
  sourceText,
  style,
  this.opts.roomContext,
  this.opts.keywordSystemHint,
  this.opts.mentionHint,
)
```

And the structured branch:

```typescript
const prompts = buildStructuredTranslationPrompts(
  input.translationInputs,
  style,
  input.cleanText,
  this.opts.roomContext,
  this.opts.keywordSystemHint,
  this.opts.mentionHint,
)
```

- [ ] **Step 3: Forward `mentionHint` in `StandardTranslationBackend`**

In `packages/translator/src/services/standard-translation-backend.ts`:

Update `StandardTranslationBackendDeps.createPipeline` type to include `mentionHint`:

```typescript
interface StandardTranslationBackendDeps {
  decryptApiToken: (encryptedAiApiToken: string) => Promise<string>
  resolveProviderPlugin?: typeof getProviderPlugin
  createPipeline?: (
    executor: ReturnType<ProviderPlugin['create']>,
    options: {
      timeoutMs: number
      translationStyle: RoomConfig['translationStyle']
      roomContext?: string
      keywordSystemHint?: string
      mentionHint?: string
    },
  ) => Pick<TranslationPipeline, 'runStructured'>
}
```

In `translate()` method, update `pipelineOpts` type and add `mentionHint`:

```typescript
const pipelineOpts: {
  timeoutMs: number
  translationStyle: typeof roomConfig.translationStyle
  roomContext?: string
  keywordSystemHint?: string
  mentionHint?: string
} = {
  timeoutMs,
  translationStyle: roomConfig.translationStyle,
}

if (input.roomContext !== undefined) {
  pipelineOpts.roomContext = input.roomContext
}
if (input.keywordSystemHint !== undefined) {
  pipelineOpts.keywordSystemHint = input.keywordSystemHint
}
if (input.mentionHint !== undefined) {
  pipelineOpts.mentionHint = input.mentionHint
}
```

- [ ] **Step 4: Write test for mentionHint forwarding**

In `packages/translator/src/services/standard-translation-backend.test.ts`, add a new test:

```typescript
it('forwards mentionHint to pipeline options', async () => {
  if (StandardTranslationBackend === null) {
    throw new Error('StandardTranslationBackend not initialized')
  }

  const decryptApiToken = mock((_encrypted: string) => Promise.resolve('token'))
  const mockExecutor = {
    execute<T>(_prompts: PromptPair, _schema: ISchema<T>): Promise<T> {
      return Promise.resolve({} as T)
    },
    describeExecution: () => ({
      generation: {
        temperature: 0,
        maxOutputTokens: 4000,
        providerOptions: null,
        providerManaged: false,
      },
    }),
  } satisfies ILLMExecutor
  const pluginCreate = mock((_ctx: unknown) => mockExecutor)
  const mockGetProviderPlugin = mock(
    (_providerId: string) =>
      ({
        manifest: {
          id: 'openai',
          defaultModel: 'gpt-4o',
          supportedModels: ['gpt-4o'],
          capabilities: { streaming: false },
          timeoutMs: 1_800_000,
        },
        create: pluginCreate,
      }) satisfies ProviderPlugin,
  )
  const createPipeline = (executor: ILLMExecutor, opts: unknown) => {
    mockPipelineConstructor(executor, opts)
    return {
      runStructured: (input: unknown, options: unknown) => mockRunStructured(input, options),
    }
  }

  const backend = new StandardTranslationBackend({
    decryptApiToken,
    resolveProviderPlugin: mockGetProviderPlugin,
    createPipeline,
  })
  const roomConfig: RoomConfig = {
    id: 'room-1',
    originalRoomId: 1001,
    originalRoomName: 'Test Room',
    destinationRoomId: 2001,
    destinationRoomName: 'Output Room',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    translationStyle: 'NATURAL_CASUAL',
    context: null,
    encryptedAiApiToken: 'encrypted-token',
    enabled: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  }

  await backend.translate({
    cleanText: 'Hello',
    translationInputs: ['Hello'],
    mentionHint: 'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
    runtimeConfig: { roomConfig, timeoutMs: 10_000 },
  })

  expect(mockPipelineConstructor.mock.calls[0]?.[1]).toMatchObject({
    mentionHint: 'Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn).',
  })
})
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/translator/src/services/standard-translation-backend.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/services/translation-backend.ts packages/translator/src/pipeline/pipeline.ts packages/translator/src/services/standard-translation-backend.ts packages/translator/src/services/standard-translation-backend.test.ts
git commit -m "feat(translator): forward mentionHint through backend and pipeline"
```

---

### Task 6: Orchestrator Integration

**Files:**

- Modify: `packages/translator/src/services/room-translation-orchestrator.ts:1-10,295-340`

- [ ] **Step 1: Add imports**

In `packages/translator/src/services/room-translation-orchestrator.ts`, add import:

```typescript
import { extractMentionContext, buildMentionHint } from '@chatwork-bot/chatwork'
import type { MessageDecorationSnapshot } from '@chatwork-bot/chatwork'
```

Note: `MessageDecorationSnapshot` may need to be exported from `@chatwork-bot/chatwork` index. Check if it already is — if not, add the export.

- [ ] **Step 2: Build mention hint before `backend.translate()` call**

In the orchestrator's `translateRoom()` method, after the keyword masking block (around line 325) and before `backend.translate()` call (around line 334), add:

```typescript
// Build mention hint from parsed message metadata
const rawSnapshot = command.audit.rawSourceSnapshot as {
  snapshot?: MessageDecorationSnapshot
}
const mentionHint =
  rawSnapshot.snapshot !== undefined
    ? buildMentionHint(
        extractMentionContext(rawSnapshot.snapshot.renderTemplate, rawSnapshot.snapshot.metadata),
      )
    : undefined

if (mentionHint !== undefined) {
  observer.logEvent('info', 'translation_mention_hint_applied', {
    mentionHint: mentionHint.slice(0, 100),
  } as Partial<TranslatorLogEntry>)
}
```

- [ ] **Step 3: Pass `mentionHint` to `backend.translate()`**

Update the `backend.translate()` call to include `mentionHint`:

```typescript
          : await llmProviderBreaker.execute(async () =>
              backend.translate({
                cleanText: maskedText,
                translationInputs: maskedTranslationInputs,
                ...(hasRoomContextForPipeline ? { roomContext: trimmedRoomContext } : {}),
                ...(systemHint ? { keywordSystemHint: systemHint } : {}),
                ...(mentionHint ? { mentionHint } : {}),
                runtimeConfig,
                phaseObserver: {
```

- [ ] **Step 4: Export `MessageDecorationSnapshot` type if needed**

Check `packages/chatwork/src/index.ts` — if `MessageDecorationSnapshot` is not already exported, add:

```typescript
export type {
  MessageDecorationSnapshot,
  MessageDecorationContext,
} from '~/types/message-decoration'
```

- [ ] **Step 5: Run full test suite**

Run: `bun test && bun run typecheck && bun run lint`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/services/room-translation-orchestrator.ts packages/chatwork/src/index.ts
git commit -m "feat(translator): build and inject mention hint in orchestrator"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full Definition of Done checks**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: All 1000+ tests pass, zero type errors, zero lint errors.

- [ ] **Step 2: Manual trace verification**

Verify the complete data flow by checking a sample message `[To:5293785]AuPMH\nお疲れ様です`:

1. Parser produces `to` node + `isToAll: false` in metadata
2. `extractMentionContext()` returns `{toRecipients: [{accountId: 5293785, displayName: 'AuPMH'}], ccRecipients: [], isToAll: false}`
3. `buildMentionHint()` returns `"Directly addressed to 1 person: AuPMH. Use singular address (anh/chị/bạn)."`
4. Orchestrator passes hint to `backend.translate({ mentionHint })`
5. Pipeline passes to `buildSingleCallPrompts(..., mentionHint)`
6. User prompt contains `<MENTION_CONTEXT>` block before `<TRANSLATE_TEXT>`

- [ ] **Step 3: Commit all and verify clean state**

```bash
git status
git log --oneline -6
```

Expected: 6 clean commits, one per task, working tree clean.
