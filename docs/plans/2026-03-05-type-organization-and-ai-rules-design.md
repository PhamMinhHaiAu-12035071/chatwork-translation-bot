# Design: Type Organization Refactor + AI Coding Standards Infrastructure

Date: 2026-03-05
Status: Approved

## Summary

Refactor `packages/core` type organization for architectural consistency, apply the same pattern
monorepo-wide, and create an `ai_rules/` folder with codified coding standards for AI agents
(Claude Code, Codex, etc.). Update `CLAUDE.md` and `AGENTS.md` to reference these standards.

---

## Problem

`packages/core/src/chatwork/client.ts` contains both implementation (`ChatworkClient` class) and
two interface definitions (`ChatworkClientConfig`, `SendMessageParams`). This is inconsistent with
the project's established convention:

- `interfaces/` = behavioral contracts (e.g., `ITranslationService`)
- `types/` = external API data shapes (e.g., webhook events, API responses)

There is also no `IChatworkClient` interface, which limits testability and dependency injection.

Additionally, coding conventions exist only in `CLAUDE.md` and `AGENTS.md` prose — not in
dedicated, topic-scoped files that AI agents can load on demand.

---

## Goals

1. Move `ChatworkClientConfig` + `SendMessageParams` to `interfaces/chatwork.ts`
2. Introduce `IChatworkClient` behavioral contract (sendMessage only — YAGNI)
3. Update `ChatworkClient` to explicitly `implements IChatworkClient`
4. Apply same interface/types convention scan across all packages
5. Create `ai_rules/` folder with 4 topic files for JIT AI reference
6. Update `CLAUDE.md` + `AGENTS.md` to reference `ai_rules/`

---

## Architecture Decision

### Type Layer Convention (final)

| Folder        | Purpose                                                                    | Examples                                          |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `interfaces/` | Behavioral contracts (injectable, mockable). Prefix: `I`.                  | `ITranslationService`, `IChatworkClient`          |
| `types/`      | Data shapes: external API responses, webhook events, domain value objects. | `ChatworkWebhookEvent`, `ParsedCommand`           |
| Co-located    | Config and param types tightly coupled to a single implementation file.    | Acceptable only when not exported beyond the file |

Supporting types for an interface (config, params, result) should live in the same file as the
interface they serve — mirroring the existing `interfaces/translation.ts` pattern.

### interfaces/chatwork.ts (new file)

```typescript
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

### chatwork/client.ts (updated)

```typescript
import type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from '../interfaces/chatwork'

export class ChatworkClient implements IChatworkClient {
  // ... existing implementation, no interface definitions
}
```

### index.ts (updated exports)

```typescript
// Old: export type { ChatworkClientConfig, SendMessageParams } from './chatwork/client'
// New:
export type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from './interfaces/chatwork'
```

---

## ai_rules/ Structure

```
ai_rules/
├── type-organization.md       # interfaces/ vs types/ convention + examples
├── naming-conventions.md      # IPrefix, PascalCase, kebab-case files
├── export-patterns.md         # index.ts barrel exports, import type enforcement
└── test-colocation.md         # *.test.ts next to implementation, never __tests__/
```

These files are NOT loaded by default. They are referenced from `CLAUDE.md` / `AGENTS.md` so AI
agents can fetch them on demand when working on the relevant topic.

---

## CLAUDE.md Update

Add a "Coding Standards" section at the bottom:

```markdown
## Coding Standards (AI Rules)

Topic-specific rules are in `ai_rules/`. Load the relevant file when working on that area:

- Type organization: `ai_rules/type-organization.md`
- Naming conventions: `ai_rules/naming-conventions.md`
- Export patterns: `ai_rules/export-patterns.md`
- Test co-location: `ai_rules/test-colocation.md`
```

## AGENTS.md Update

Add a "Type Organization" section linking to `ai_rules/type-organization.md`, and a note about
`ai_rules/` in the "Coding Style" section.

---

## Constraints

- `types/chatwork.ts` stays unchanged (webhook schemas + API response types)
- `IChatworkClient` exposes only `sendMessage()` — no speculative methods
- `packages/bot` imports from `@chatwork-bot/core` — no change to import paths
- All changes must pass `bun run typecheck && bun run lint && bun test`

---

## Edge Cases

- If circular import detected (interfaces/ ↔ types/): use explicit relative paths, not aliases
- If `packages/bot/src/` has similar co-location violations: flag and fix in same PR

---

## Verification Commands

```bash
bun run typecheck    # All packages: root + core + bot
bun run lint        # ESLint strict + stylistic
bun test            # All test files
bun run build       # Ensure bundle still works
```

---

## Deliverables

1. `packages/core/src/interfaces/chatwork.ts` — new file
2. `packages/core/src/chatwork/client.ts` — updated (implements IChatworkClient)
3. `packages/core/src/index.ts` — updated exports
4. `ai_rules/type-organization.md` — new
5. `ai_rules/naming-conventions.md` — new
6. `ai_rules/export-patterns.md` — new
7. `ai_rules/test-colocation.md` — new
8. `CLAUDE.md` — add Coding Standards section
9. `AGENTS.md` — add Type Organization section
