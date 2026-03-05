# Type Organization Refactor + AI Rules Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `ChatworkClientConfig` and `SendMessageParams` out of `client.ts` into a new
`interfaces/chatwork.ts` file, introduce `IChatworkClient` as a behavioral contract, and create
an `ai_rules/` folder with codified coding standards referenced from `CLAUDE.md` and `AGENTS.md`.

**Architecture:** New file `packages/core/src/interfaces/chatwork.ts` holds the behavioral
interface and its supporting types, mirroring the `interfaces/translation.ts` pattern.
`ChatworkClient` explicitly implements `IChatworkClient`. The `index.ts` barrel re-exports
from the new location. AI rule files live under `ai_rules/` at the repo root.

**Tech Stack:** Bun, TypeScript 5.4+ strict, ESLint `@typescript-eslint/recommended-type-checked`

---

## Task 1: Create `interfaces/chatwork.ts`

**Files:**

- Create: `packages/core/src/interfaces/chatwork.ts`

No new test file needed — this is a pure-types file. TypeScript compiler acts as the test.

**Step 1: Create the file**

```typescript
// packages/core/src/interfaces/chatwork.ts

export interface ChatworkClientConfig {
  apiToken: string
  baseUrl?: string
}

export interface SendMessageParams {
  roomId: number
  message: string
  unread?: boolean
}

export interface IChatworkClient {
  sendMessage(params: SendMessageParams): Promise<{ message_id: string }>
}
```

> **Why `{ message_id: string }` instead of `ChatworkSendMessageResponse`?**
> The interface contract should not import from `types/chatwork.ts` just to name a response shape
> that is structurally identical. Structural typing in TypeScript means `ChatworkClient` satisfies
> this contract even though it returns the named type. Keeps the interface file dependency-free.

**Step 2: Run typecheck to verify the file is valid**

```bash
bun run typecheck
```

Expected: all packages pass with no errors. If you see errors here, fix them before continuing.

**Step 3: Commit**

```bash
git add packages/core/src/interfaces/chatwork.ts
git commit -m "feat(core): add IChatworkClient interface with supporting types"
```

---

## Task 2: Refactor `client.ts` — implement the interface

**Files:**

- Modify: `packages/core/src/chatwork/client.ts`
- Test: `packages/core/src/chatwork/client.test.ts` (already exists — no changes needed)

**Step 1: Run existing tests first to establish a baseline**

```bash
bun test packages/core/src/chatwork/client.test.ts
```

Expected: 5 tests pass. If any fail, stop and investigate before continuing.

**Step 2: Update `client.ts`**

Replace the entire file content:

```typescript
import type { ChatworkSendMessageResponse } from '../types/chatwork'
import type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from '../interfaces/chatwork'

const DEFAULT_BASE_URL = 'https://api.chatwork.com/v2'

export class ChatworkClient implements IChatworkClient {
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(config: ChatworkClientConfig) {
    this.apiToken = config.apiToken
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  }

  async sendMessage({
    roomId,
    message,
    unread = false,
  }: SendMessageParams): Promise<ChatworkSendMessageResponse> {
    const url = `${this.baseUrl}/rooms/${roomId.toString()}/messages`

    const body = new URLSearchParams({
      body: message,
      self_unread: unread ? '1' : '0',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': this.apiToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Chatwork API error: ${response.status.toString()} ${response.statusText} - ${errorText}`,
      )
    }

    return (await response.json()) as ChatworkSendMessageResponse
  }
}
```

**Key changes:**

- Removed `export interface ChatworkClientConfig` and `export interface SendMessageParams`
- Added `import type { IChatworkClient, ChatworkClientConfig, SendMessageParams } from '../interfaces/chatwork'`
- Added `implements IChatworkClient` to the class declaration

**Step 3: Run tests to verify nothing broke**

```bash
bun test packages/core/src/chatwork/client.test.ts
```

Expected: same 5 tests pass. The test file does not need changes — it imports `ChatworkClient`
from `./client` which still exports the class.

**Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors. TypeScript will verify that `ChatworkClient.sendMessage()` satisfies the
`IChatworkClient` contract.

**Step 5: Commit**

```bash
git add packages/core/src/chatwork/client.ts
git commit -m "refactor(core): ChatworkClient implements IChatworkClient, move interfaces to interfaces/chatwork"
```

---

## Task 3: Update `index.ts` — fix barrel exports

**Files:**

- Modify: `packages/core/src/index.ts`

**Step 1: Update the Chatwork client export section**

Find this block in `index.ts` (lines 34–35):

```typescript
// Chatwork client
export { ChatworkClient } from './chatwork/client'
export type { ChatworkClientConfig, SendMessageParams } from './chatwork/client'
```

Replace it with:

```typescript
// Interfaces
export type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from './interfaces/chatwork'

// Chatwork client
export { ChatworkClient } from './chatwork/client'
```

> **Note:** `IChatworkClient` is added to the exports. `ChatworkClientConfig` and `SendMessageParams`
> now come from `./interfaces/chatwork` instead of `./chatwork/client`. The class export stays the
> same. The `// Interfaces` comment block already exists above for translation — add this line there
> or keep it near the client export. Either is fine; consistency matters more than position.

**Resulting `index.ts`:**

```typescript
// Types
export type {
  ChatworkWebhookEvent,
  ChatworkMessageEvent,
  ChatworkAccount,
  ChatworkRoom,
  ChatworkRoomDetail,
  ChatworkSendMessageResponse,
} from './types/chatwork'
export {
  isChatworkMessageEvent,
  // Schemas (for use in Elysia routes and runtime validation)
  ChatworkWebhookEventSchema,
  ChatworkWebhookEventInnerSchema,
  ChatworkMessageEventSchema,
  ChatworkMessageEventInnerSchema,
} from './types/chatwork'

export type { ParsedCommand, SupportedLang } from './types/command'
export { SUPPORTED_LANGUAGES, isSupportedLang } from './types/command'

// Interfaces
export type { ITranslationService, TranslationResult } from './interfaces/translation'
export { TranslationError } from './interfaces/translation'
export type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from './interfaces/chatwork'

// Services
export { MockTranslationService } from './services/mock-translation'
export { GeminiTranslationService } from './services/gemini-translation'
export { OpenAITranslationService } from './services/openai-translation'
export { TranslationServiceFactory } from './services/translation-factory'
export type { AIProvider } from './services/translation-factory'

// Chatwork client
export { ChatworkClient } from './chatwork/client'

// Utils
export { parseCommand, stripChatworkMarkup } from './utils/parse-command'
```

**Step 2: Run full test suite**

```bash
bun test
```

Expected: all 64 tests pass (same count as before).

**Step 3: Run typecheck and lint**

```bash
bun run typecheck && bun run lint
```

Expected: no errors, no warnings.

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor(core): re-export ChatworkClient types from interfaces/chatwork in barrel"
```

---

## Task 4: Create `ai_rules/` folder with 4 rule files

**Files:**

- Create: `ai_rules/type-organization.md`
- Create: `ai_rules/naming-conventions.md`
- Create: `ai_rules/export-patterns.md`
- Create: `ai_rules/test-colocation.md`

No tests. No typecheck. These are markdown files for AI agent consumption.

**Step 1: Create the folder and all 4 files**

**`ai_rules/type-organization.md`:**

```markdown
# Type Organization Rules

## Layer Convention

| Folder        | Purpose                                                         | Prefix / Pattern |
| ------------- | --------------------------------------------------------------- | ---------------- |
| `interfaces/` | Behavioral contracts: injectable, mockable, DI boundaries.      | `I` prefix       |
| `types/`      | Data shapes: external API responses, webhook events, schemas.   | No prefix        |
| Co-located    | Only acceptable when the type is NOT exported outside the file. | —                |

## Rule: Supporting types belong in the same file as their interface

When an interface has supporting types (config, params, result), they live in the **same file**
as the interface — not in `types/`.

**Correct:**
```

interfaces/chatwork.ts → IChatworkClient, ChatworkClientConfig, SendMessageParams
interfaces/translation.ts → ITranslationService, TranslationResult, TranslationError

```

**Wrong:**
```

interfaces/chatwork.ts → IChatworkClient only
types/chatwork.ts → ChatworkClientConfig, SendMessageParams ← scattered

```

## Rule: `types/` is for external shapes only

`types/` holds data structures that model external system contracts:
- Webhook event payloads from Chatwork
- API response shapes
- Domain value objects (like `ParsedCommand`)

It does NOT hold client config or method parameter types.

## Rule: Never define exported interfaces inside implementation files

If an interface or type is exported from a file that also contains a class or function
implementation, move it to the appropriate layer (`interfaces/` or `types/`).

Exception: types used only internally within that file (no `export` keyword).

## Checklist when adding a new type

- [ ] Is it a behavioral contract (injectable, mockable)? → `interfaces/<domain>.ts`
- [ ] Is it a data shape from an external API? → `types/<domain>.ts`
- [ ] Is it a supporting type for an interface? → same file as that interface
- [ ] Is it only used inside one file and not exported? → co-locate, no move needed
```

**`ai_rules/naming-conventions.md`:**

````markdown
# Naming Conventions

## TypeScript Identifiers

| Kind                        | Convention    | Example                    |
| --------------------------- | ------------- | -------------------------- |
| Behavioral interface        | `IPascalCase` | `ITranslationService`      |
| Data interface / type alias | `PascalCase`  | `ChatworkWebhookEvent`     |
| Class                       | `PascalCase`  | `ChatworkClient`           |
| Function / variable         | `camelCase`   | `parseCommand`, `apiToken` |
| Constant (module-level)     | `UPPER_SNAKE` | `DEFAULT_BASE_URL`         |
| Unused parameter/variable   | `_camelCase`  | `_event`, `_unused`        |

## File Names

All files use **kebab-case**:

- `parse-command.ts` ✓
- `parseCommand.ts` ✗
- `ParseCommand.ts` ✗

Test files: same name as source file with `.test.ts` suffix:

- `parse-command.ts` → `parse-command.test.ts`

## Folder Names

Folders use **kebab-case**:

- `interfaces/`, `types/`, `services/`, `chatwork/`, `webhook-logger/`

## Interface Prefix Rule

Only **behavioral contracts** (interfaces intended for dependency injection or mocking) use the
`I` prefix. Data-shape interfaces do NOT use `I`:

```typescript
// ✓ Correct
export interface ITranslationService { ... }
export interface IChatworkClient { ... }

// ✓ Also correct (data shapes — no I prefix)
export interface ChatworkClientConfig { ... }
export interface SendMessageParams { ... }
export interface TranslationResult { ... }
```
````

## Package Names

Bun workspace packages use `@chatwork-bot/<name>` scope:

- `@chatwork-bot/core`
- `@chatwork-bot/translator`
- `@chatwork-bot/webhook-logger`

````

**`ai_rules/export-patterns.md`:**

```markdown
# Export Patterns

## Rule: All public exports go through `index.ts` (barrel)

Each package exposes a single public API via `packages/<name>/src/index.ts`.
Consumers import from the package name, never from internal paths:

```typescript
// ✓ Correct — import from package
import type { IChatworkClient } from '@chatwork-bot/core'

// ✗ Wrong — import from internal path
import type { IChatworkClient } from '@chatwork-bot/core/src/interfaces/chatwork'
````

## Rule: Use `import type` for type-only imports

ESLint enforces this. Types imported only for type annotations must use `import type`:

```typescript
// ✓ Correct
import type { ChatworkClientConfig } from '../interfaces/chatwork'

// ✗ Wrong (ESLint error: @typescript-eslint/consistent-type-imports)
import { ChatworkClientConfig } from '../interfaces/chatwork'
```

## Rule: Export types with `export type` in barrel

In `index.ts`, type-only exports use `export type`:

```typescript
// ✓ Correct
export type { IChatworkClient, ChatworkClientConfig } from './interfaces/chatwork'
export { ChatworkClient } from './chatwork/client'

// ✗ Wrong
export { IChatworkClient } from './interfaces/chatwork' // runtime value exported for a type
```

## Rule: Group exports in `index.ts` by layer

Order in barrel: Types → Interfaces → Services → Implementation → Utils

```typescript
// Types (external API shapes)
export type { ChatworkWebhookEvent } from './types/chatwork'

// Interfaces (behavioral contracts)
export type { IChatworkClient } from './interfaces/chatwork'

// Services
export { ChatworkClient } from './chatwork/client'

// Utils
export { parseCommand } from './utils/parse-command'
```

## Rule: Re-export schemas with value export (not `export type`)

TypeBox schemas are runtime values — they cannot use `export type`:

```typescript
// ✓ Correct — schema is a runtime value
export { ChatworkWebhookEventSchema } from './types/chatwork'

// ✗ Wrong
export type { ChatworkWebhookEventSchema } from './types/chatwork'
```

````

**`ai_rules/test-colocation.md`:**

```markdown
# Test Co-location Rules

## Rule: Test files live next to their source file

````

packages/core/src/
├── chatwork/
│ ├── client.ts
│ └── client.test.ts ← same folder, not in **tests**/
├── utils/
│ ├── parse-command.ts
│ └── parse-command.test.ts
└── services/
├── gemini-translation.ts
└── gemini-translation.test.ts

```

**Never** create a `__tests__/` folder or a top-level `tests/` directory. All test files live
adjacent to the file they test.

## Rule: Test file naming

`<source-file-name>.test.ts` — always the same name, `.test.ts` suffix.

```

output-writer.ts → output-writer.test.ts ✓
outputWriter.test.ts ✗ (wrong casing)
output-writer.spec.ts ✗ (use .test.ts, not .spec.ts)

````

## Rule: Test runner

Use Bun's built-in test runner. Import from `bun:test`:

```typescript
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
````

Never use Vitest, Jest, or other test frameworks.

## Rule: Run a single test file during development

```bash
bun test packages/core/src/chatwork/client.test.ts
```

Run the full suite only before committing:

```bash
bun test
```

## Rule: What to test

Prioritize:

1. Parsing logic (pure functions with many branches)
2. Webhook signature verification
3. Error paths and edge cases

Do NOT test:

- Simple constructors that just assign properties
- TypeScript types (the compiler handles this)
- Third-party library behavior

````

**Step 2: Verify all files were created**

```bash
ls ai_rules/
````

Expected output:

```
export-patterns.md  naming-conventions.md  test-colocation.md  type-organization.md
```

**Step 3: Run lint to ensure markdown is formatted correctly**

```bash
bun run format
```

Expected: no errors. Prettier will format the markdown files.

**Step 4: Commit**

```bash
git add ai_rules/
git commit -m "docs(repo): add ai_rules/ folder with 4 coding standard files for AI agents"
```

---

## Task 5: Update `CLAUDE.md` — add Coding Standards section

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Append the following section to the end of `CLAUDE.md`**

```markdown
## Coding Standards (AI Rules)

Topic-specific coding rules are in `ai_rules/`. Read the relevant file when working on that area:

- **Type organization** (interfaces/ vs types/ convention): `ai_rules/type-organization.md`
- **Naming conventions** (IPrefix, PascalCase, kebab-case files): `ai_rules/naming-conventions.md`
- **Export patterns** (barrel index.ts, import type): `ai_rules/export-patterns.md`
- **Test co-location** (\*.test.ts next to source): `ai_rules/test-colocation.md`
```

**Step 2: Verify CLAUDE.md still reads correctly**

Open `CLAUDE.md` and confirm the new section appears at the bottom with correct links.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(repo): add Coding Standards section to CLAUDE.md referencing ai_rules/"
```

---

## Task 6: Update `AGENTS.md` — add Type Organization section

**Files:**

- Modify: `AGENTS.md`

**Step 1: In `AGENTS.md`, find the "Coding Style & Naming Conventions" section**

It currently reads:

```markdown
## Coding Style & Naming Conventions

- Language: TypeScript (ESM), strict mode enabled.
- Formatting: 2 spaces, single quotes, no semicolons, trailing commas (`.prettierrc`).
- Lint rules enforce `type` imports and disallow unused vars unless prefixed with `_`.
- Naming conventions:
  - `PascalCase` for types/classes.
  - `camelCase` for variables/functions.
  - `kebab-case.ts` for file names (example: `parse-command.ts`).
```

**Step 2: Append a Type Organization sub-section after the existing content**

```markdown
## Coding Style & Naming Conventions

- Language: TypeScript (ESM), strict mode enabled.
- Formatting: 2 spaces, single quotes, no semicolons, trailing commas (`.prettierrc`).
- Lint rules enforce `type` imports and disallow unused vars unless prefixed with `_`.
- Naming conventions:
  - `PascalCase` for types/classes.
  - `camelCase` for variables/functions.
  - `kebab-case.ts` for file names (example: `parse-command.ts`).
  - `I` prefix for behavioral interfaces only (e.g., `IChatworkClient`, `ITranslationService`).

### Type Organization

`packages/core/src/` follows a strict layer convention:

| Folder        | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `interfaces/` | Behavioral contracts with `I` prefix — injectable, mockable.  |
| `types/`      | External data shapes: webhook events, API responses, schemas. |
| co-located    | Only for types not exported outside their file.               |

Supporting types for an interface (config, params, result) live in the **same file** as the
interface. See `ai_rules/type-organization.md` for the full ruleset.

### AI Coding Standards

Full topic-scoped rules are in `ai_rules/` at the repo root:

- `ai_rules/type-organization.md`
- `ai_rules/naming-conventions.md`
- `ai_rules/export-patterns.md`
- `ai_rules/test-colocation.md`
```

**Step 3: Run lint**

```bash
bun run lint
```

Expected: no errors.

**Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(repo): add type organization and ai_rules references to AGENTS.md"
```

---

## Final Verification

**Step 1: Run full suite**

```bash
bun run typecheck && bun run lint && bun test && bun run build
```

Expected:

- `typecheck`: all 3 packages pass
- `lint`: 0 errors, 0 warnings
- `test`: 64 tests pass, 0 fail
- `build`: outputs `dist/server.js` successfully

**Step 2: Verify the interfaces folder now has both files**

```bash
ls packages/core/src/interfaces/
```

Expected:

```
chatwork.ts  translation.ts
```

**Step 3: Verify `client.ts` no longer contains interface definitions**

```bash
grep -n "^export interface" packages/core/src/chatwork/client.ts
```

Expected: no output (no exported interfaces in client.ts).

---

## Summary of Changes

| File                                       | Action                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `packages/core/src/interfaces/chatwork.ts` | Created — `IChatworkClient`, `ChatworkClientConfig`, `SendMessageParams` |
| `packages/core/src/chatwork/client.ts`     | Modified — removed 2 interfaces, added `implements IChatworkClient`      |
| `packages/core/src/index.ts`               | Modified — re-exports from `interfaces/chatwork`, adds `IChatworkClient` |
| `ai_rules/type-organization.md`            | Created                                                                  |
| `ai_rules/naming-conventions.md`           | Created                                                                  |
| `ai_rules/export-patterns.md`              | Created                                                                  |
| `ai_rules/test-colocation.md`              | Created                                                                  |
| `CLAUDE.md`                                | Modified — added Coding Standards section                                |
| `AGENTS.md`                                | Modified — added Type Organization section + ai_rules reference          |
