# Translation Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an env-driven `Translation Style` feature that applies named style profiles to both
translator prompt paths without changing provider or ingress contracts.

**Architecture:** `@chatwork-bot/core` owns the closed-set `TranslationStyle` domain type and
default value. `@chatwork-bot/translation-prompt` owns named style profiles and injects an active
style block into the system prompt. `@chatwork-bot/translator` parses `AI_TRANSLATION_STYLE`,
threads the selected style through pipeline execution, and surfaces the active style ID in startup
and request observability.

**Tech Stack:** Bun v1.3+, TypeScript strict ESM, Zod, Bun test, workspace packages

---

### Task 1: Add the Core `TranslationStyle` Domain Type

**Files:**

- Create: `packages/core/src/types/translation-style.ts`
- Create: `packages/core/src/types/translation-style.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write the failing test**

Add a new test file:

```ts
import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_TRANSLATION_STYLE,
  TRANSLATION_STYLE_VALUES,
  isTranslationStyle,
} from './translation-style'

describe('translation-style', () => {
  it('exports the four supported styles in a stable order', () => {
    expect(TRANSLATION_STYLE_VALUES).toEqual([
      'AUTO_CONTEXT',
      'NATURAL_CASUAL',
      'PROFESSIONAL_BUSINESS',
      'TECHNICAL',
    ])
  })

  it('uses PROFESSIONAL_BUSINESS as the default', () => {
    expect(DEFAULT_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
  })

  it('recognizes valid values', () => {
    expect(isTranslationStyle('TECHNICAL')).toBe(true)
    expect(isTranslationStyle('freeform')).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/core/src/types/translation-style.test.ts`

Expected: FAIL with module-not-found or missing export errors.

**Step 3: Write minimal implementation**

Create `packages/core/src/types/translation-style.ts`:

```ts
export const TRANSLATION_STYLE_VALUES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export type TranslationStyle = (typeof TRANSLATION_STYLE_VALUES)[number]

export const DEFAULT_TRANSLATION_STYLE: TranslationStyle = 'PROFESSIONAL_BUSINESS'

export function isTranslationStyle(value: string): value is TranslationStyle {
  return TRANSLATION_STYLE_VALUES.includes(value as TranslationStyle)
}
```

Update `packages/core/src/index.ts`:

```ts
export type { TranslationStyle } from './types/translation-style'
export {
  TRANSLATION_STYLE_VALUES,
  DEFAULT_TRANSLATION_STYLE,
  isTranslationStyle,
} from './types/translation-style'
```

**Step 4: Run the focused tests**

Run:

- `bun test packages/core/src/types/translation-style.test.ts`
- `bun run --filter @chatwork-bot/core typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/types/translation-style.ts \
        packages/core/src/types/translation-style.test.ts \
        packages/core/src/index.ts
git commit -m "feat(core): add translation style domain type"
```

### Task 2: Add the Translator Env Contract

**Files:**

- Modify: `packages/translator/src/env-schema.ts`
- Modify: `packages/translator/src/env.test.ts`

**Step 1: Write the failing test**

Extend `packages/translator/src/env.test.ts` with:

```ts
it('defaults AI_TRANSLATION_STYLE to PROFESSIONAL_BUSINESS', async () => {
  process.env['CHATWORK_API_TOKEN'] = 'token'
  process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
  process.env['AI_PROVIDER'] = 'openai'

  const { parseTranslatorEnv } = await import('./env-schema')
  const env = parseTranslatorEnv(process.env)

  expect(env.AI_TRANSLATION_STYLE).toBe('PROFESSIONAL_BUSINESS')
})

it('accepts a valid AI_TRANSLATION_STYLE override', async () => {
  process.env['CHATWORK_API_TOKEN'] = 'token'
  process.env['CHATWORK_DESTINATION_ROOM_ID'] = '123'
  process.env['AI_PROVIDER'] = 'openai'
  process.env['AI_TRANSLATION_STYLE'] = 'TECHNICAL'

  const { parseTranslatorEnv } = await import('./env-schema')
  const env = parseTranslatorEnv(process.env)

  expect(env.AI_TRANSLATION_STYLE).toBe('TECHNICAL')
})

it('rejects invalid AI_TRANSLATION_STYLE values at schema level', async () => {
  const { translatorEnvSchema } = await import('./env-schema')
  const result = translatorEnvSchema.safeParse({
    CHATWORK_API_TOKEN: 'token',
    CHATWORK_DESTINATION_ROOM_ID: '123',
    AI_PROVIDER: 'openai',
    AI_TRANSLATION_STYLE: 'whatever',
  })

  expect(result.success).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/translator/src/env.test.ts`

Expected: FAIL because `AI_TRANSLATION_STYLE` is missing from the schema.

**Step 3: Write minimal implementation**

Update `packages/translator/src/env-schema.ts`:

```ts
import {
  DEFAULT_TRANSLATION_STYLE,
  TRANSLATION_STYLE_VALUES,
} from '@chatwork-bot/core'

AI_TRANSLATION_STYLE: z
  .enum(TRANSLATION_STYLE_VALUES)
  .default(DEFAULT_TRANSLATION_STYLE),
```

**Step 4: Run the focused tests**

Run:

- `bun test packages/translator/src/env.test.ts`
- `bun run --filter @chatwork-bot/translator typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/env-schema.ts \
        packages/translator/src/env.test.ts
git commit -m "feat(translator): add translation style env contract"
```

### Task 3: Add Named Style Profiles in `translation-prompt`

**Files:**

- Modify: `packages/translation-prompt/package.json`
- Create: `packages/translation-prompt/src/sections/translation-style-profiles.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.ts`
- Modify: `packages/translation-prompt/src/index.ts`
- Modify: `packages/translation-prompt/src/translation-prompt.test.ts`

**Step 1: Write the failing tests**

Extend `packages/translation-prompt/src/translation-prompt.test.ts` with cases like:

```ts
it('injects the active style block into single-call prompts', () => {
  const result = buildSingleCallPrompts('テスト', 'TECHNICAL')
  expect(result.system).toContain('Active Translation Style')
  expect(result.system).toContain('TECHNICAL')
  expect(result.system).toMatch(/technical precision|terminology consistency/i)
})

it('injects the active style block into structured prompts', () => {
  const result = buildStructuredTranslationPrompts(['一つ目'], 'NATURAL_CASUAL')
  expect(result.system).toContain('Active Translation Style')
  expect(result.system).toContain('NATURAL_CASUAL')
})

it('keeps fidelity-first wording inside the style policy', () => {
  const result = buildSingleCallPrompts('テスト', 'AUTO_CONTEXT')
  expect(result.system).toMatch(/preserve fidelity|source meaning|politeness intent/i)
})

it('defines stable profile content for all four presets', async () => {
  const { TRANSLATION_STYLE_PROFILES } = await import('~/sections/translation-style-profiles')

  expect(TRANSLATION_STYLE_PROFILES['AUTO_CONTEXT']).toMatchObject({
    name: 'Auto-detect Context',
  })
  expect(TRANSLATION_STYLE_PROFILES['NATURAL_CASUAL']).toMatchObject({
    name: 'Natural / Casual',
  })
  expect(TRANSLATION_STYLE_PROFILES['PROFESSIONAL_BUSINESS']).toMatchObject({
    name: 'Professional / Business',
  })
  expect(TRANSLATION_STYLE_PROFILES['TECHNICAL']).toMatchObject({
    name: 'Technical',
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/translation-prompt/src/translation-prompt.test.ts`

Expected: FAIL because the prompt builders do not accept a style parameter yet.

Do **not** add golden-output tests for model prose here. For `AUTO_CONTEXT`, the deterministic
contract is the injected profile content and guardrail wording, not a specific translated sentence.

**Step 3: Add the workspace dependency and profile registry**

Update `packages/translation-prompt/package.json`:

```json
"dependencies": {
  "@chatwork-bot/core": "workspace:*",
  "zod": "^4.3.6"
}
```

Create `packages/translation-prompt/src/sections/translation-style-profiles.ts`:

```ts
import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  systemInstructions: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  AUTO_CONTEXT: {
    id: 'AUTO_CONTEXT',
    name: 'Auto-detect Context',
    description:
      'Adaptive Vietnamese output that chooses the most natural register for the message context.',
    systemInstructions: `- Infer whether the message is casual, business, technical, operational, or mixed before writing.
- Choose the Vietnamese register that best matches the source context and communicative purpose.
- Do not force the output toward casual or formal phrasing unless the source supports it.
- If context is ambiguous, prefer the least risky natural rendering that preserves fidelity.`,
  },
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description:
      'Conversational Vietnamese that feels natural and light while staying workplace-safe.',
    systemInstructions: `- Prefer smooth, conversational Vietnamese over stiff business phrasing.
- Keep the tone friendly and natural, but still respectful enough for workplace chat.
- Avoid slang, memes, or over-familiar language that would feel unserious or socially risky.
- If the source is strongly formal, soften only within safe bounds and preserve intent.`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    systemInstructions: `- Prefer clear, polished, contemporary Vietnamese suitable for internal business communication.
- Keep the tone respectful and composed without becoming bureaucratic or archaic.
- Use concise wording that reads like a competent Vietnamese professional wrote it originally.
- This is the safest default when no stronger contextual signal is present.`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and IT/business communication.',
    systemInstructions: `- Prioritize technical precision and terminology consistency over expressive phrasing.
- Keep established IT and business terms in English when that is the natural workplace rendering.
- Prefer wording that makes actions, states, and constraints operationally clear.
- Avoid casual embellishment that could blur technical meaning or implementation detail.`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]
  return `## Active Translation Style
Style: ${profile.id}
Description: ${profile.description}

### Specific Behaviors
${profile.systemInstructions}

### Guardrail
- If this style conflicts with source meaning, politeness intent, urgency, or critical nuance, preserve fidelity.`
}
```

Document in the file header that this is a **one-way dependency** on `@chatwork-bot/core`, not a
cycle. The current graph remains:

```text
@chatwork-bot/core <- @chatwork-bot/translation-prompt <- @chatwork-bot/translator
```

**Step 4: Refresh workspace metadata**

Run:

- `bun install`

Expected:

- workspace metadata and lockfile stay consistent after adding the new package dependency

**Step 5: Update prompt builders**

Change `packages/translation-prompt/src/translation-prompt.ts`:

```ts
import type { TranslationStyle } from '@chatwork-bot/core'
import { buildTranslationStyleSection } from '~/sections/translation-style-profiles'

export function buildSingleCallPrompts(text: string, style: TranslationStyle): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `...`,
  }
}

export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle,
): PromptPair {
  return {
    system: [SINGLE_CALL_SYSTEM, buildTranslationStyleSection(style)].join('\n\n'),
    user: `...`,
  }
}
```

If the profile registry needs to be reused by other files, export the builder from
`packages/translation-prompt/src/index.ts`.

**Step 6: Run the focused tests**

Run:

- `bun test packages/translation-prompt/src/translation-prompt.test.ts`
- `bun run --filter @chatwork-bot/translation-prompt typecheck`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/translation-prompt/package.json \
        packages/translation-prompt/src/sections/translation-style-profiles.ts \
        packages/translation-prompt/src/translation-prompt.ts \
        packages/translation-prompt/src/index.ts \
        packages/translation-prompt/src/translation-prompt.test.ts
# If bun updates a lockfile in this repo, add it in the same commit.
git commit -m "feat(translation-prompt): add translation style profiles"
```

### Task 4: Thread Style Through the Translation Pipeline

**Files:**

- Modify: `packages/translator/src/pipeline/pipeline.ts`
- Modify: `packages/translator/src/pipeline/pipeline.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Write the failing tests**

Add focused assertions to `packages/translator/src/pipeline/pipeline.test.ts`:

```ts
it('passes the selected style into the single-call prompt path', async () => {
  const captured: { prompts?: PromptPair } = {}
  const executor: ILLMExecutor = {
    execute<T>(prompts: PromptPair, _schema: ISchema<T>) {
      captured.prompts = prompts
      return Promise.resolve({ sourceLang: 'Japanese', translated: 'Xin chào' } as T)
    },
  }

  const pipeline = new TranslationPipeline(executor, {
    translationStyle: 'TECHNICAL',
  })

  await pipeline.run('テスト')
  expect(captured.prompts?.system).toContain('TECHNICAL')
})

it('still skips the LLM for zero-input requests even when a style is configured', async () => {
  const { executor, getCallCount } = makeExecutor()
  const pipeline = new TranslationPipeline(executor, {
    translationStyle: 'TECHNICAL',
  })

  const result = await pipeline.runStructured({
    cleanText: '[code]const x = 1[/code]',
    translationInputs: [],
  })

  expect(getCallCount()).toBe(0)
  expect(result.translatedSegments).toEqual([])
})
```

Add one handler-level assertion in `packages/translator/src/webhook/handler.test.ts` that the
logged/request context carries the chosen style.

**Step 2: Run tests to verify they fail**

Run:

- `bun test packages/translator/src/pipeline/pipeline.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`

Expected: FAIL because the pipeline constructor/options do not carry `translationStyle`.

**Step 3: Write minimal implementation**

Update `packages/translator/src/pipeline/pipeline.ts`:

```ts
import type { TranslationStyle } from '@chatwork-bot/core'

constructor(
  private readonly executor: ILLMExecutor,
  private readonly opts: { timeoutMs?: number; translationStyle: TranslationStyle },
) {}

buildSingleCallPrompts(singleInput ?? input.cleanText, this.opts.translationStyle)
buildStructuredTranslationPrompts(input.translationInputs, this.opts.translationStyle)
```

Update `packages/translator/src/webhook/handler.ts`:

```ts
const translationStyle = env.AI_TRANSLATION_STYLE

const pipeline = new TranslationPipeline(executor, {
  timeoutMs: effectiveTimeoutMs,
  translationStyle,
})
```

Add `translationStyle` to request context emitted into status/logging.

**Step 4: Run the focused tests**

Run:

- `bun test packages/translator/src/pipeline/pipeline.test.ts`
- `bun test packages/translator/src/webhook/handler.test.ts`
- `bun run --filter @chatwork-bot/translator typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/pipeline/pipeline.ts \
        packages/translator/src/pipeline/pipeline.test.ts \
        packages/translator/src/webhook/handler.ts \
        packages/translator/src/webhook/handler.test.ts
git commit -m "feat(translator): thread translation style through pipeline"
```

### Task 5: Add Startup and Request Observability for Style

**Files:**

- Modify: `packages/translator/src/bootstrap/startup-banner.ts`
- Modify: `packages/translator/src/bootstrap/startup-banner.test.ts`
- Modify: `packages/translator/src/index.ts`
- Modify: `packages/translator/src/types/observability.ts`
- Modify: `packages/translator/src/services/translator-status-store.test.ts`
- Modify: `packages/translator/src/routes/status.test.ts`

**Step 1: Write the failing tests**

Add a startup-banner test:

```ts
expect(output).toContain('AI_TRANSLATION_STYLE=TECHNICAL')
```

Add a status-store or route test asserting `translationStyle: 'TECHNICAL'` is present in the
request context.

**Step 2: Run tests to verify they fail**

Run:

- `bun test packages/translator/src/bootstrap/startup-banner.test.ts`
- `bun test packages/translator/src/services/translator-status-store.test.ts`
- `bun test packages/translator/src/routes/status.test.ts`

Expected: FAIL because the context types and banner config do not include style yet.

**Step 3: Write minimal implementation**

Update `packages/translator/src/types/observability.ts`:

```ts
import type { TranslationStyle } from '@chatwork-bot/core'

translationStyle: TranslationStyle
```

Be explicit that `TranslatorLogEntry`, `ActiveTranslatorRequest`, and `TranslatorRecentResult`
inherit this field through `TranslatorRequestContext`, so a single schema change covers all three
surfaces.

Update `packages/translator/src/bootstrap/startup-banner.ts` config:

```ts
interface BannerConfig {
  provider: string
  model: string
  translationStyle: string
  // ...
}
```

Log the selected style in the summary lines, not as full prompt content.

Update `packages/translator/src/index.ts` to pass `env.AI_TRANSLATION_STYLE` into
`logStartupBanner(...)`.

**Step 4: Run the focused tests**

Run:

- `bun test packages/translator/src/bootstrap/startup-banner.test.ts`
- `bun test packages/translator/src/services/translator-status-store.test.ts`
- `bun test packages/translator/src/routes/status.test.ts`
- `bun run --filter @chatwork-bot/translator typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/bootstrap/startup-banner.ts \
        packages/translator/src/bootstrap/startup-banner.test.ts \
        packages/translator/src/index.ts \
        packages/translator/src/types/observability.ts \
        packages/translator/src/services/translator-status-store.test.ts \
        packages/translator/src/routes/status.test.ts
git commit -m "feat(translator): surface translation style in observability"
```

### Task 6: Update Runtime Docs and Example Env

**Files:**

- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Modify: `ai_rules/security.md`

**Step 1: Write the doc changes**

Add `AI_TRANSLATION_STYLE` to `.env.example`:

```env
# AI translation style (optional)
# AUTO_CONTEXT | NATURAL_CASUAL | PROFESSIONAL_BUSINESS | TECHNICAL
AI_TRANSLATION_STYLE=PROFESSIONAL_BUSINESS
```

Update `CLAUDE.md` and `ai_rules/security.md` optional env sections to mention:

- env name
- default behavior
- invalid-value startup failure
- restart-to-apply behavior

**Step 2: Run formatting and focused verification**

Run:

- `bun run format`
- `bun run typecheck`

Expected: PASS.

**Step 3: Commit**

```bash
git add .env.example CLAUDE.md ai_rules/security.md
git commit -m "docs(repo): document translation style configuration"
```

### Task 7: Final Verification

**Files:**

- Modify: none
- Test: repo-wide verification only

**Step 1: Run full validation**

Run:

- `bun test`
- `bun run typecheck`
- `bun run lint`

Expected: all PASS.

**Step 2: Sanity-check the change set**

Run:

- `git status --short`
- `git log --oneline -n 5`

Expected:

- working tree clean
- recent commits include the feature tasks above

**Step 3: Final commit if any staged follow-up is needed**

```bash
git add -A
git commit -m "feat(repo): finalize translation style feature"
```

If there is no remaining diff after verification, skip this commit.
