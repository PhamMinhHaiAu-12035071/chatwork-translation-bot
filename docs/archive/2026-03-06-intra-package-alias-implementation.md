# Intra-package `~/` Alias Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all intra-package `../` imports with a `~/` alias and enforce via ESLint so no future `../` can be introduced.

**Architecture:** Add `paths: { "~/*": ["./src/*"] }` to each package tsconfig. Install `eslint-plugin-import-x` + `eslint-import-resolver-typescript`, then enable `import-x/no-relative-parent-imports` in the root ESLint config. Migrate all 12 affected files. Update four documentation files.

**Tech Stack:** Bun workspaces, TypeScript 5.4+, ESLint flat config (`eslint.config.ts`), `eslint-plugin-import-x`, `eslint-import-resolver-typescript`

---

### Task 1: Install devDependencies

**Files:**

- Modify: `package.json` (root)

**Step 1: Install packages**

```bash
bun add -D eslint-plugin-import-x eslint-import-resolver-typescript
```

**Step 2: Verify they appear in devDependencies**

```bash
grep -E "eslint-plugin-import-x|eslint-import-resolver-typescript" package.json
```

Expected: both packages listed under `devDependencies`.

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore(repo): add eslint-plugin-import-x and eslint-import-resolver-typescript"
```

---

### Task 2: Add `~/` paths to `packages/core/tsconfig.json`

**Files:**

- Modify: `packages/core/tsconfig.json`

**Step 1: Add `paths` to compilerOptions**

Current content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

New content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Verify typecheck still passes (no migration yet, just paths added)**

```bash
cd packages/core && bun run typecheck
```

Expected: zero errors.

---

### Task 3: Add `~/` paths to `packages/translator/tsconfig.json`

**Files:**

- Modify: `packages/translator/tsconfig.json`

**Step 1: Add `paths` to compilerOptions**

New content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Verify typecheck still passes**

```bash
cd packages/translator && bun run typecheck
```

Expected: zero errors.

---

### Task 4: Add `~/` paths to `packages/webhook-logger/tsconfig.json`

**Files:**

- Modify: `packages/webhook-logger/tsconfig.json`

**Step 1: Add `paths` to compilerOptions**

New content:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Verify typecheck still passes**

```bash
cd packages/webhook-logger && bun run typecheck
```

Expected: zero errors.

**Step 3: Commit all three tsconfig changes**

```bash
git add packages/core/tsconfig.json packages/translator/tsconfig.json packages/webhook-logger/tsconfig.json
git commit -m "chore(repo): add ~/src/* path alias to all package tsconfigs"
```

---

### Task 5: Update `eslint.config.ts` — add import-x plugin + rule

**Files:**

- Modify: `eslint.config.ts`

Current content:

```typescript
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.config.ts'],
  },
)
```

**Step 1: Update eslint.config.ts**

New content:

```typescript
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['packages/*/tsconfig.json'],
        },
      },
    },
    rules: {
      'import-x/no-relative-parent-imports': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.config.ts'],
  },
)
```

**Step 2: Run lint to confirm it now reports all `../` violations**

```bash
bun run lint 2>&1 | head -40
```

Expected: many errors like `import-x/no-relative-parent-imports` for all `../` imports. This is correct — we haven't migrated yet.

**Step 3: Commit**

```bash
git add eslint.config.ts
git commit -m "chore(repo): add import-x/no-relative-parent-imports ESLint rule"
```

---

### Task 6: Migrate `packages/core` — interfaces + utils + chatwork

**Files:**

- Modify: `packages/core/src/interfaces/chatwork.ts`
- Modify: `packages/core/src/utils/parse-command.ts`
- Modify: `packages/core/src/chatwork/client.ts`
- Modify: `packages/core/src/chatwork/client.test.ts`

**Step 1: Update `packages/core/src/interfaces/chatwork.ts`**

Change line 1:

```typescript
// Before
import type { ChatworkMember } from '../types/chatwork'

// After
import type { ChatworkMember } from '~/types/chatwork'
```

**Step 2: Update `packages/core/src/utils/parse-command.ts`**

```typescript
// Before
import type { ParsedCommand } from '../types/command'
import { isSupportedLang } from '../types/command'

// After
import type { ParsedCommand } from '~/types/command'
import { isSupportedLang } from '~/types/command'
```

**Step 3: Update `packages/core/src/chatwork/client.ts`**

```typescript
// Before
import type { ChatworkSendMessageResponse, ChatworkMember } from '../types/chatwork'
// ...
} from '../interfaces/chatwork'

// After
import type { ChatworkSendMessageResponse, ChatworkMember } from '~/types/chatwork'
// ...
} from '~/interfaces/chatwork'
```

**Step 4: Update `packages/core/src/chatwork/client.test.ts`**

```typescript
// Before
import type { ChatworkMember } from '../types/chatwork'

// After
import type { ChatworkMember } from '~/types/chatwork'
```

**Step 5: Verify typecheck + tests pass**

```bash
bun run typecheck && bun test packages/core
```

Expected: zero errors, all tests pass.

---

### Task 7: Migrate `packages/core` — services

**Files:**

- Modify: `packages/core/src/services/mock-translation.ts`
- Modify: `packages/core/src/services/gemini-translation.ts`
- Modify: `packages/core/src/services/openai-translation.ts`
- Modify: `packages/core/src/services/translation-factory.ts`

**Step 1: Update `packages/core/src/services/mock-translation.ts`**

```typescript
// Before
import type { ITranslationService, TranslationResult } from '../interfaces/translation'

// After
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
```

**Step 2: Update `packages/core/src/services/gemini-translation.ts`**

```typescript
// Before
import type { ITranslationService, TranslationResult } from '../interfaces/translation'
import { TranslationError } from '../interfaces/translation'
import type { GeminiModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL } from '../types/ai'

// After
import type { ITranslationService, TranslationResult } from '~/interfaces/translation'
import { TranslationError } from '~/interfaces/translation'
import type { GeminiModel } from '~/types/ai'
import { DEFAULT_GEMINI_MODEL } from '~/types/ai'
```

Note: `import { TranslationSchema, buildTranslationPrompt } from './translation-prompt'` is a
same-directory `./` import — leave it unchanged.

**Step 3: Update `packages/core/src/services/openai-translation.ts`**

Same pattern as gemini — replace all `../interfaces/translation` and `../types/ai` with `~/`.

**Step 4: Update `packages/core/src/services/translation-factory.ts`**

```typescript
// Before
import type { ITranslationService } from '../interfaces/translation'
import type { AIProvider, GeminiModel, OpenAIModel } from '../types/ai'
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '../types/ai'

// After
import type { ITranslationService } from '~/interfaces/translation'
import type { AIProvider, GeminiModel, OpenAIModel } from '~/types/ai'
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '~/types/ai'
```

**Step 5: Verify typecheck + tests pass**

```bash
bun run typecheck && bun test packages/core
```

Expected: zero errors, all tests pass.

**Step 6: Commit core migrations**

```bash
git add packages/core/src/
git commit -m "refactor(core): migrate intra-package imports to ~/  alias"
```

---

### Task 8: Migrate `packages/translator`

**Files:**

- Modify: `packages/translator/src/utils/output-writer.ts`
- Modify: `packages/translator/src/utils/output-writer.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`

**Step 1: Update `packages/translator/src/utils/output-writer.ts`**

```typescript
// Before
import type { OutputRecord } from '../types/output'

// After
import type { OutputRecord } from '~/types/output'
```

**Step 2: Update `packages/translator/src/utils/output-writer.test.ts`**

```typescript
// Before
import type { OutputRecord } from '../types/output'

// After
import type { OutputRecord } from '~/types/output'
```

**Step 3: Update `packages/translator/src/webhook/handler.ts`**

```typescript
// Before
import { env } from '../env'
import { writeTranslationOutput } from '../utils/output-writer'
import { sendTranslatedMessage } from '../services/chatwork-sender'

// After
import { env } from '~/env'
import { writeTranslationOutput } from '~/utils/output-writer'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
```

**Step 4: Verify typecheck + tests pass**

```bash
bun run typecheck && bun test packages/translator
```

Expected: zero errors, all tests pass.

**Step 5: Commit translator migrations**

```bash
git add packages/translator/src/
git commit -m "refactor(translator): migrate intra-package imports to ~/ alias"
```

---

### Task 9: Migrate `packages/webhook-logger`

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.ts`

**Step 1: Update `packages/webhook-logger/src/routes/webhook.ts`**

```typescript
// Before
import { env } from '../env'

// After
import { env } from '~/env'
```

**Step 2: Verify typecheck + tests pass**

```bash
bun run typecheck && bun test packages/webhook-logger
```

Expected: zero errors, all tests pass.

**Step 3: Commit webhook-logger migration**

```bash
git add packages/webhook-logger/src/
git commit -m "refactor(webhook-logger): migrate intra-package imports to ~/ alias"
```

---

### Task 10: Update `ai_rules/export-patterns.md`

**Files:**

- Modify: `ai_rules/export-patterns.md`

**Step 1: Append new section at the end of the file**

Add after the last section:

````markdown
## Rule: Intra-package imports must use `~/` alias

Never use `../` to navigate between directories within the same package.
Use `~/` which resolves to the package's `src/` directory.

Each package's `tsconfig.json` defines: `"paths": { "~/*": ["./src/*"] }`

```typescript
// ✓ Correct
import type { ParsedCommand } from '~/types/command'
import { env } from '~/env'

// ✗ Wrong — ESLint error: import-x/no-relative-parent-imports
import type { ParsedCommand } from '../types/command'
import { env } from '../env'
```
````

Same-directory imports (`./`) are allowed:

```typescript
// ✓ Correct — same directory
import { TranslationSchema } from './translation-prompt'
```

Enforced by: `import-x/no-relative-parent-imports` (error) in `eslint.config.ts`.

```

**Step 2: Verify file looks correct**

Read `ai_rules/export-patterns.md` and confirm the section is appended cleanly.

---

### Task 11: Update `ai_rules/project-structure.md`

**Files:**
- Modify: `ai_rules/project-structure.md`

**Step 1: Update the tsconfig hierarchy section**

Find the tsconfig hierarchy block that currently reads:
```

tsconfig.base.json (baseUrl: ".")
├── tsconfig.root.json (root scripts only, excludes packages/)
├── packages/core/tsconfig.json (baseUrl: "../..")
├── packages/translator/tsconfig.json (baseUrl: "../..")
└── packages/webhook-logger/tsconfig.json (baseUrl: "../..")

```

Replace with:
```

tsconfig.base.json (baseUrl: ".")
├── tsconfig.root.json (root scripts only, excludes packages/)
├── packages/core/tsconfig.json (baseUrl: "../..", paths: ~/_ → ./src/_)
├── packages/translator/tsconfig.json (baseUrl: "../..", paths: ~/_ → ./src/_)
└── packages/webhook-logger/tsconfig.json (baseUrl: "../..", paths: ~/_ → ./src/_)

```

**Step 2: Update the paragraph below the tsconfig block**

Find the existing paragraph:
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig has no local `paths` override — all inherit from base.

```

Replace with:
```

Cross-package imports (`@chatwork-bot/core`) resolve via Bun workspace symlinks in
`node_modules`, not tsconfig paths. Do not add cross-package entries to tsconfig `paths`.
Each package tsconfig defines `paths: { "~/*": ["./src/*"] }` for intra-package imports.
Do NOT add `~/` to `tsconfig.base.json` — `baseUrl` differs between root and packages.

````

---

### Task 12: Update `AGENTS.md` and `CLAUDE.md`

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Step 1: Update `AGENTS.md` Critical Rules section**

Find the existing critical rules block and add a new bullet after the existing import rules:

```markdown
- Import from package name only: `@chatwork-bot/core`, never from `../../core/src/` or path aliases like `@core/*`
````

Add after it:

```markdown
- **Never** use `../` for intra-package imports — use `~/path` alias instead (e.g. `~/types/command` not `../types/command`)
```

**Step 2: Update `CLAUDE.md` Critical Rules section**

In `CLAUDE.md`, there is no explicit inline critical rules block — add to the relevant section.
Find the import rule line under "Types & Structure":

```markdown
- `import`, `export`, `index.ts`, `from '@` → read `ai_rules/export-patterns.md`
```

Below the stack description or in a relevant "Critical Rules" note, add:

```markdown
- **Never** use `../` for intra-package imports — use `~/path` alias (enforced by ESLint)
```

**Step 3: Commit documentation updates**

```bash
git add ai_rules/export-patterns.md ai_rules/project-structure.md AGENTS.md CLAUDE.md
git commit -m "docs(repo): document ~/ intra-package alias rule in ai_rules, AGENTS.md, CLAUDE.md"
```

---

### Task 13: Final verification

**Step 1: Run full test + typecheck + lint suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all pass, zero errors.

**Step 2: Confirm zero `../` remain in packages**

```bash
grep -r "from '\.\." packages/ --include="*.ts"
```

Expected: no output (zero matches).

**Step 3: Confirm `~/` is used everywhere**

```bash
grep -r "from '~/" packages/ --include="*.ts"
```

Expected: all previously-relative imports now appear with `~/`.
