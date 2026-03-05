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

## Package Names

Bun workspace packages use `@chatwork-bot/<name>` scope:

- `@chatwork-bot/core`
- `@chatwork-bot/translator`
- `@chatwork-bot/webhook-logger`
