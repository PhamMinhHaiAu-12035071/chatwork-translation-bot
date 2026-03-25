# Translation Style Design

**Version:** 1.0
**Date:** 2026-03-25
**Prepared by (AI-assisted):** Codex
**Status:** Approved for implementation planning

## Objective

Add a `Translation Style` feature that lets the translator service steer output tone and
structure through a named preset selected by environment configuration, while preserving the
current single-call-per-request pipeline and fidelity-first translation guarantees.

## Scope

### In scope

- Add a closed-set `TranslationStyle` domain type in `@chatwork-bot/core`
- Add `AI_TRANSLATION_STYLE` to translator env parsing and runtime wiring
- Apply the selected style to both existing prompt paths:
  - `buildSingleCallPrompts(...)`
  - `buildStructuredTranslationPrompts(...)`
- Model style semantics as named style profiles inside `@chatwork-bot/translation-prompt`
- Expose the active style ID in startup and request-level observability
- Add tests and docs needed for an env-only MVP

### Out of scope

- Request-level or query-parameter style override
- Per-room or per-user style selection
- UI or config screen for style selection
- Provider-specific style behavior or tuning
- Persistence of style selection outside `.env`
- Changes to Chatwork command syntax
- Universal one-path prompt refactor
- Changes in `webhook-logger`, `dataset-runner`, or `@chatwork-bot/chatwork`

## Non-goals

- Do not redesign the translation pipeline around a new prompt architecture
- Do not expose style as part of `TranslationIngressCommand`
- Do not add a general profile-management subsystem beyond what this MVP needs
- Do not guarantee deterministic phrasing parity across providers and models

## Done

The feature is complete when:

- `TranslationStyle` exists as a closed-set domain type in `@chatwork-bot/core`
- `AI_TRANSLATION_STYLE` is parsed in `packages/translator/src/env-schema.ts`
- missing `AI_TRANSLATION_STYLE` defaults to `PROFESSIONAL_BUSINESS`
- invalid `AI_TRANSLATION_STYLE` fails startup
- both prompt builders accept and apply the active style
- the four presets have explicitly defined semantics
- startup banner and request/status observability surface the active style ID
- `.env.example` and operational docs are updated
- focused tests cover env parsing, prompt construction, pipeline propagation, and observability

## Constraints

- Keep the MVP env-only and global to the translator process
- Do not add new runtime dependencies
- Preserve provider boundaries: providers execute prompts but do not own style semantics
- Preserve current single-call behavior: one LLM call per request when translation is needed
- Preserve current structured-segment contract and delivery behavior
- Treat style as a controlled steering layer, not an instruction to rewrite source meaning

## UX/UI

There is no end-user UI in this MVP.

Operators configure the active style by setting:

```env
AI_TRANSLATION_STYLE=PROFESSIONAL_BUSINESS
```

The selected style applies to the entire translator instance after restart.

## Data / Business Rules

## Domain type

`@chatwork-bot/core` will define a closed value set:

- `AUTO_CONTEXT`
- `NATURAL_CASUAL`
- `PROFESSIONAL_BUSINESS`
- `TECHNICAL`

Recommended representation:

```ts
export const TRANSLATION_STYLE_VALUES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export type TranslationStyle = (typeof TRANSLATION_STYLE_VALUES)[number]

export const DEFAULT_TRANSLATION_STYLE: TranslationStyle = 'PROFESSIONAL_BUSINESS'
```

This is enum-like without relying on the TypeScript `enum` keyword.

## Preset semantics

### `AUTO_CONTEXT`

- Adaptive mode
- The model infers message context and chooses the most natural Vietnamese register for that
  message
- It may land close to casual, business, or technical output depending on the source

### `NATURAL_CASUAL`

- Casual-but-respectful Vietnamese
- Conversational, lighter, and less stiff than the business default
- Must remain workplace-safe and avoid slang or over-familiar phrasing

### `PROFESSIONAL_BUSINESS`

- Modern business default
- Clear, polished, respectful, and contemporary
- Must stay close to current system-prompt behavior and remains the default fallback

### `TECHNICAL`

- Precision-first technical Vietnamese
- Prioritize terminology consistency and operational clarity
- Keep relevant IT and business terms in English when that is the natural workplace rendering

## Guardrails

All presets share the same hard rules:

- Style must not change factual meaning
- Style must not change urgency
- Style must not change important politeness intent
- Style must not violate name, code, or structure-preservation rules already present in the prompt
- If style conflicts with the source, preserve fidelity over stylistic preference

## Technical Approach

## Architecture

### `@chatwork-bot/core`

Owns:

- `TranslationStyle`
- `TRANSLATION_STYLE_VALUES`
- `DEFAULT_TRANSLATION_STYLE`

It does not own prompt semantics.

### `@chatwork-bot/translator`

Owns:

- env parsing for `AI_TRANSLATION_STYLE`
- propagation of the chosen style through the request handling flow
- operational visibility of the active style ID

It does not own detailed style wording beyond configuration and wiring.

### `@chatwork-bot/translation-prompt`

Owns:

- named style profile registry
- style descriptions and system-level instructions
- prompt assembly for both prompt paths

Recommended structure:

```ts
interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  systemInstructions: string
}
```

Each prompt builder resolves the active profile and injects an `Active Translation Style` block
into the system prompt.

### `provider-*`

Providers remain unchanged. They still receive the final `PromptPair` and execute it.

## Data flow

```text
AI_TRANSLATION_STYLE from env
  -> translator env parser
  -> webhook handler
  -> TranslationPipeline
  -> translation-prompt resolves active style profile
  -> prompt builder injects style block into system prompt
  -> provider executes prompt
```

This applies to both current prompt paths:

- `buildSingleCallPrompts(text, style)`
- `buildStructuredTranslationPrompts(segments, style)`

## Prompt profile pattern

The style system should behave like a Claude Code output-style preset:

- named preset
- global selection
- always active once selected
- implemented by modifying the system prompt

Reference:

- Anthropic Claude Code docs: `Output styles`
  - https://code.claude.com/docs/en/output-styles

Recommended prompt section shape:

```text
## Active Translation Style
Style: TECHNICAL
Description: Precision-first technical Vietnamese for engineering and IT/business communication.

### Specific Behaviors
- Prioritize technical precision and terminology consistency.
- Keep established IT/business terms in English when natural.
- Favor clear operational wording over expressive phrasing.
- If this style conflicts with source meaning, politeness intent, or critical nuance, preserve fidelity.
```

## Testing

### `packages/core`

- value-set export exists and is stable
- default export exists and is stable

### `packages/translator`

- env parse succeeds for all valid preset values
- env parse defaults to `PROFESSIONAL_BUSINESS` when missing
- env parse fails for invalid values
- handler/pipeline propagates `translationStyle`
- startup banner includes active style ID
- request/status observability includes active style ID

### `packages/translation-prompt`

- single-call prompt includes the active profile block
- structured prompt includes the active profile block
- each preset produces the intended name/description/instruction set
- fidelity-first wording remains present in the prompt policy

### `packages/translator/src/pipeline`

- single-input path passes style to prompt construction
- multi-segment path passes style to prompt construction
- structured path still enforces segment count and order

## Rollout / Ops

- No data migration
- No webhook contract change
- No provider registration change
- Missing env remains backward compatible via `PROFESSIONAL_BUSINESS`
- Applying a different style requires restarting the translator process

Operational surfacing:

- startup banner prints active `AI_TRANSLATION_STYLE`
- structured logs and `/status` carry `translationStyle`
- only the style ID is logged, not the full prompt instructions

## Risks / Trade-offs

- Style is prompt steering, not a deterministic rendering engine
- Different models may express the same preset differently
- `AUTO_CONTEXT` will naturally produce more output variation than the fixed presets
- Stronger stylistic instructions can increase the risk of semantic drift if wording is not
  carefully guarded

## Acceptance Criteria

- `TranslationStyle` exists as a closed-set type in `@chatwork-bot/core`
- `AI_TRANSLATION_STYLE` exists in translator env parsing
- missing env defaults to `PROFESSIONAL_BUSINESS`
- invalid env fails startup
- both prompt builders accept and apply style
- all four presets are represented as named profiles
- style block is injected into the system prompt
- fidelity-first guardrails remain active
- startup banner and request/status observability surface active style ID
- provider contract remains unchanged
- ingress and webhook contracts remain unchanged

## Happy Path

1. Operator sets `AI_TRANSLATION_STYLE=TECHNICAL`
2. Translator starts and validates the env successfully
3. Startup logs show the active style ID
4. A translation request reaches the pipeline
5. Prompt assembly resolves the `TECHNICAL` style profile
6. The provider executes the prompt
7. Delivery and output persistence continue unchanged

## Edge Cases

- `translationInputs.length === 0`
  - no LLM call
  - style setting has no prompt effect for that request
- `translationInputs.length === 1`
  - style is applied through the single-text prompt path
- `translationInputs.length > 1`
  - style is applied through the structured prompt path
  - segment count and order must remain preserved
- source tone strongly conflicts with the selected preset
  - fidelity wins over stylistic force

## Failure Cases

- Invalid `AI_TRANSLATION_STYLE`
  - translator exits during startup
- Provider timeout or API failure
  - existing error behavior remains unchanged
- Structured response count mismatch
  - existing `INVALID_RESPONSE` behavior remains unchanged

## Explicit Decisions Made

- Use an env-only MVP
- Keep style global to the translator instance
- Keep style out of provider context and ingress contracts
- Use a closed-set enum-like domain type, not free-form string input
- Use named style profiles in `translation-prompt`
- Model style like a global output-style preset applied via system prompt
- Keep current two prompt paths and apply style to both
- Default to `PROFESSIONAL_BUSINESS`
- Fail startup on invalid style values
- Log only the active style ID, not full prompt instructions

## Open Risks

- No open high-risk assumptions remain

## Future Scope / Deferred Features

- request-level style override via API or query parameter
- per-room style policies
- per-user style policies
- UI for style selection
- provider-specific style tuning
- refactor to a universal one-path prompt architecture
