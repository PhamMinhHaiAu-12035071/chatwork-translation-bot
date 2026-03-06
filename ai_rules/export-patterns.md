# Export Patterns

## Rule: All public exports go through `index.ts` (barrel)

Each package exposes a single public API via `packages/<name>/src/index.ts`.
Consumers import from the package name, never from internal paths:

```typescript
// ✓ Correct — import from package
import type { IChatworkClient } from '@chatwork-bot/core'

// ✗ Wrong — import from internal path
import type { IChatworkClient } from '@chatwork-bot/core/src/interfaces/chatwork'
```

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

## Rule: Cross-package imports use workspace package names, no path aliases

`@chatwork-bot/core` resolves via Bun workspace symlinks (`node_modules`), not tsconfig paths.
Do not add `@core/*`, `core/*`, or any alias pattern for cross-package imports.

```typescript
// ✓ Correct — use workspace package name
import { parseCommand } from '@chatwork-bot/core'
import type { ITranslationService } from '@chatwork-bot/core'

// ✗ Wrong — deep path aliases (not configured)
import { parseCommand } from '@core/utils/parse-command'
import { parseCommand } from 'core/utils/parse-command'
```

If a symbol is not exported from `@chatwork-bot/core`, add it to `packages/core/src/index.ts`.

## Rule: Intra-package imports must use `~/` alias

Never use `../` to navigate between directories within the same package.
Use `~/` which resolves to the package's `src/` directory.

Each package's `tsconfig.json` defines: `"paths": { "~/*": ["packages/<name>/src/*"] }`

```typescript
// ✓ Correct
import type { ParsedCommand } from '~/types/command'
import { env } from '~/env'

// ✗ Wrong — ESLint error: no-restricted-imports
import type { ParsedCommand } from '../types/command'
import { env } from '../env'
```

Same-directory imports (`./`) are allowed:

```typescript
// ✓ Correct — same directory
import { TranslationSchema } from './translation-prompt'
```

Enforced by: `no-restricted-imports` with `patterns: ['../*']` (error) in `eslint.config.ts`.
