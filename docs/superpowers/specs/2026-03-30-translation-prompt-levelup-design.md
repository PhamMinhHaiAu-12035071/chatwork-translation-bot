# Translation Prompt Level-Up: Kagi-Quality Natural Vietnamese

**Version:** 1.0
**Date:** 2026-03-30
**Prepared by:** AI-assisted (Claude Opus 4.6)
**Status:** Draft — Pending User Review

---

## Objective

Level up the entire `@chatwork-bot/translation-prompt` package to produce translations that are indistinguishable from native Vietnamese writing — at Kagi Translate quality (B2 Vietnamese Casual Natural) or better — across all translation styles.

## Scope

### In Scope

- Two-step translation pipeline: Draft → Polish
- Remove `AUTO_CONTEXT` style, embed context-awareness into base prompt
- Enrich all 3 remaining style profiles (NATURAL_CASUAL, PROFESSIONAL_BUSINESS, TECHNICAL) with distinct, persona-driven instructions
- Expand HUMANIZER section with comprehensive anti-translationese patterns
- Enhance INTERNAL_REASONING self-critique gate
- New `buildPolishPrompts()` and `buildStructuredPolishPrompts()` prompt builders
- New `PolishResultSchema` and `StructuredPolishResultSchema` Zod schemas
- Pipeline changes in `translator` package to call two LLM steps
- Update `core` package to remove `AUTO_CONTEXT` from `TRANSLATION_STYLE_VALUES`
- Update all tests

### Non-Goals / Out of Scope

- Reading level / CEFR parameter (not needed for workplace chatbot)
- Multi-model routing (Kagi routes between models — we use single provider)
- Proofreading feature (separate from translation)
- New translation styles beyond the existing 3
- Dashboard or UI changes
- Provider-specific prompt tuning

---

## Constraints

- All prompt instructions MUST be written in English (LLMs comprehend English better). Vietnamese only for embedded example translations.
- Breaking change to `AI_TRANSLATION_STYLE` env var: `AUTO_CONTEXT` no longer valid → startup fails with clear error
- Two-step pipeline doubles LLM API calls (cost × 2, latency × ~2)
- Must maintain backward compatibility for `NATURAL_CASUAL`, `PROFESSIONAL_BUSINESS`, `TECHNICAL` style values
- `DEFAULT_TRANSLATION_STYLE` remains `PROFESSIONAL_BUSINESS` (unchanged)
- Existing `buildSingleCallPrompts()` and `buildStructuredTranslationPrompts()` function signatures unchanged — only internal prompt content changes
- Temperature remains at 0 for deterministic output
- JSON-only response format preserved

---

## Research Foundation

### Key Finding: Two-Step Polish Approach

From "Lost in Literalism" (March 2025, arxiv): GPT-4 translationese dropped from **43% to 25%** using translate-then-polish. The study proved that structural separation of translation from refinement is more effective than any prompt wording change.

### Key Finding: Vietnamese-Specific

From LaVy research (2024): The most effective method for Vietnamese is translate first, then prompt the LLM to rewrite with both original source AND draft translation visible.

### Key Finding: Kagi Translate Architecture

Kagi uses composable prompt templates with per-language customization. Key parameters: `formality`, `style`, `reading_level`, `context`. Their "Context-aware Translation" is a system-wide capability, not a separate mode — validating our decision to embed context-awareness into the base prompt.

### Key Finding: Anti-Translationese

Simply asking for "natural output" in the prompt does NOT consistently reduce translationese. The task format (separate translate + polish steps) is what makes the difference.

---

## Design

### 1. Architecture: Two-Step Pipeline

#### Current Flow (single-pass)

```
Source text → [Draft Prompt + Style] → LLM → JSON response
```

#### New Flow (two-step)

```
Source text → [Draft Prompt + Style] → LLM → Draft
                                                 ↓
Source text + Draft → [Polish Prompt + Style] → LLM → Final → JSON
```

#### Error Handling

- If Step 2 (polish) fails → fallback to Step 1 (draft) result
- Retry policy: 1 retry per step (unchanged)
- Timeout: per-call, not per-pipeline (unchanged)

### 2. Style System: 3 Distinct Voices

Remove `AUTO_CONTEXT`. Context-awareness becomes a built-in capability in `CORE_DOCTRINE`.

Each style MUST produce translations so distinct that reading the output immediately reveals which style was used — like 3 different authors.

#### NATURAL_CASUAL — "Close colleague on Zalo"

Voice: A friendly colleague chatting on Zalo/Slack. Smooth, conversational, workplace-safe.

Benchmark: Kagi Translate Vietnamese Casual Natural B2.

Key characteristics:

- Short sentences, quick rhythm, natural flow
- Vietnamese sentence-final particles: "nhé", "nha", "á", "đấy", "thôi", "rồi"
- Light connectives: "kiểu", "cơ mà", "mà thôi", "thế là"
- Rhetorical questions and light personal commentary allowed
- Elliptical sentences (drop subject when obvious — how Vietnamese naturally reads)
- Reflow long source sentences into 2-3 shorter ones if more natural

MUST NOT:

- Use vulgar language, memes, slang that is too informal for workplace
- Use heavy Sino-Vietnamese (Hán-Việt) terms when simpler Vietnamese exists
- Use passive voice when active is more natural
- Produce long multi-clause sentences (split them)
- Sound like PROFESSIONAL_BUSINESS with particles sprinkled on top

#### PROFESSIONAL_BUSINESS — "PM writing internal email"

Voice: A competent project manager writing an email to the team. Clear, polished, modern, respectful.

Key characteristics:

- Medium-length sentences, clear structure
- Professional but not stiff vocabulary
- Moderate politeness markers: "vui lòng", "xin"
- No casual particles ("nhé", "nha", "á")
- Concise wording — reads like a competent Vietnamese professional wrote it originally

MUST NOT:

- Sound bureaucratic ("kính gửi quý ông/bà")
- Use excessive Sino-Vietnamese formality
- Use casual particles or conversational fillers
- Sound either too casual or too formal — maintain the middle ground

#### TECHNICAL — "Senior engineer writing tech docs"

Voice: A senior engineer writing documentation, code review comments, or incident reports. Precision-first, terse.

Key characteristics:

- Short sentences, precision over fluency
- English technical terms preserved when standard in Vietnamese IT workplaces
- Structure-focused: bullet points, numbered lists
- Imperative mood when appropriate
- Operational clarity: actions, states, constraints are unambiguous

MUST NOT:

- Use decorative language or casual fillers
- Translate technical terms into Vietnamese when the English term is industry-standard
- Use conversational particles or informal connectives
- Prioritize readability over technical precision

### 3. Enhanced CORE_DOCTRINE

Add new principle #5: Context-Aware Register (replaces AUTO_CONTEXT style)

```
5. Context-Aware Register
Before translating, silently detect the message context — is it casual chat,
business email, technical discussion, operational notice, or mixed? Let the
detected context inform word choice and sentence structure WITHIN the bounds
of the active translation style. Do not override the style, but let context
refine it.
```

### 4. Enhanced HUMANIZER — Anti-Translationese Patterns

Expand from ~10 lines to ~25-30 lines. Add:

**DO patterns:**

- Use rhetorical questions when source implies wondering (e.g., 「コストどうですか？」→ "Chi phí thì sao nhỉ?")
- Use elliptical sentences — drop subject when context is clear (how native Vietnamese actually reads)
- Prefer native Vietnamese words over Sino-Vietnamese when equivalent: "bởi vì" > "do nguyên nhân"
- Use style-appropriate sentence-final particles: "thôi", "nhỉ", "rồi", "đấy"
- Reflow long sentences into 2-3 shorter ones when more natural in Vietnamese
- Mix sentence lengths naturally — short sentences alongside longer ones

**DO NOT patterns (machine-translation signals):**

- "Việc..." opening sentences unnecessarily (gratuitous nominalization)
- "Được X" passive when active voice is more natural
- "Một cách [adj]" (calque from English "-ly" adverb pattern)
- Repeating subject in every sentence when Vietnamese naturally omits it
- Word-by-word translation of idioms instead of Vietnamese equivalents
- Excessive "Sự" + verb nominalization ("sự thay đổi" when "thay đổi" suffices)
- Starting multiple consecutive sentences with the same pattern
- "Không chỉ... mà còn..." (overused AI cliché pattern)

### 5. Enhanced INTERNAL_REASONING — Self-Critique Gate

Add to existing gate:

- **Translationese check:** Does any sentence mirror the source language's sentence structure rather than Vietnamese natural structure?
- **Particle check:** For NATURAL_CASUAL, are sentence-ending particles used naturally, not mechanically inserted?
- **Redundancy check:** Any unnecessary nominalizations, passive constructions, or decorative Sino-Vietnamese terms?

### 6. Polish Prompt Design (NEW)

#### Polish System Prompt Structure

```
POLISH_PERSONA
  → Native Vietnamese editor with 15 years of experience
  → Specialist in detecting and eliminating "translationese"

POLISH_DOCTRINE
  → The translation must read as if it were ORIGINALLY WRITTEN in Vietnamese
  → Restructure sentences if needed — do not cling to source structure
  → Preserve 100% of meaning — only change how it is expressed

ANTI_TRANSLATIONESE_CHECKLIST (self-critique before output)
  → Does any sentence mirror the source language structure?
  → Can any heavy Sino-Vietnamese term be replaced with simpler Vietnamese?
  → Is there unnecessary passive voice?
  → Would a native Vietnamese speaker actually say this?
  → Does the text flow naturally when read aloud?

STYLE_SPECIFIC_POLISH (injected per active style)
  → NATURAL_CASUAL: "Re-read each sentence — if a colleague said this on
    Zalo, would it sound natural? If not, rewrite."
  → PROFESSIONAL_BUSINESS: "Re-read each sentence — if a PM sent this in
    an internal email, would it sound professional? If too stiff, loosen."
  → TECHNICAL: "Re-read each sentence — is the terminology precise? Any
    decorative fluff? Cut it."

POLISH_CONSTRAINTS
  → Do NOT change meaning, do NOT add or remove information
  → Do NOT output anything except JSON
  → If the draft is already good, keep it — do not change for the sake of changing
```

#### Polish User Prompt Template

```
Here is a draft translation that needs polishing.

Original text:
{source_text}

Draft translation:
{draft_translation}

Polish the translation so it reads naturally as original Vietnamese text.
Respond ONLY with valid JSON:
{"translated": "<polished Vietnamese translation>"}
```

#### Structured Polish User Prompt Template

```
Here are draft translations that need polishing.

Original segments:
{source_segments_json}

Draft translations:
{draft_segments_json}

Polish each translation so it reads naturally as original Vietnamese text.
Preserve array length and order exactly.
Respond ONLY with valid JSON:
{"translatedSegments": ["<polished segment 1>", "<polished segment 2>"]}
```

### 7. New Schemas

```typescript
// Polish result — only translated (sourceLang known from Step 1)
export const PolishResultSchema = z.object({
  translated: z.string().min(1),
})

export const StructuredPolishResultSchema = z.object({
  translatedSegments: z.array(z.string().min(1)).nonempty(),
})
```

### 8. Pipeline Integration (translator package)

```typescript
// Single text translation
async translateSingle(text: string, style: TranslationStyle): Promise<TranslationResult> {
  // Step 1: Draft
  const draft = await this.executeDraft(
    buildSingleCallPrompts(text, style),
    TranslationDraftSchema,
    options,
  )

  // Step 2: Polish
  const polished = await this.executeDraft(
    buildPolishPrompts(text, draft.translated, style),
    PolishResultSchema,
    options,
  )

  return { sourceLang: draft.sourceLang, translated: polished.translated }
}

// Structured (multi-segment) translation
async translateStructured(segments: string[], style: TranslationStyle): Promise<StructuredResult> {
  // Step 1: Draft
  const draft = await this.executeDraft(
    buildStructuredTranslationPrompts(segments, style),
    StructuredTranslationDraftSchema,
    options,
  )

  // Step 2: Polish
  const polished = await this.executeDraft(
    buildStructuredPolishPrompts(segments, draft.translatedSegments, style),
    StructuredPolishResultSchema,
    options,
  )

  return { sourceLang: draft.sourceLang, translatedSegments: polished.translatedSegments }
}
```

#### Fallback Behavior

- If polish step fails (LLM error, schema validation failure, timeout) → return draft result
- Log warning when fallback is triggered

### 9. Package Export Changes

```typescript
// translation-prompt/src/index.ts — additions
export {
  buildPolishPrompts,
  buildStructuredPolishPrompts,
  PolishResultSchema,
  StructuredPolishResultSchema,
} from './translation-prompt'

export type { PolishResult, StructuredPolishResult } from './translation-prompt'
```

### 10. Breaking Changes

| Change                                                  | Impact                                                            | Migration                               |
| ------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| Remove `AUTO_CONTEXT` from `TRANSLATION_STYLE_VALUES`   | `AI_TRANSLATION_STYLE=AUTO_CONTEXT` fails startup                 | Change env to one of 3 remaining styles |
| Remove `AUTO_CONTEXT` from `TRANSLATION_STYLE_PROFILES` | Code referencing `TRANSLATION_STYLE_PROFILES.AUTO_CONTEXT` breaks | Remove references                       |
| Pipeline calls LLM twice                                | Cost doubles, latency ~doubles                                    | No action needed — automatic            |

---

## Acceptance Criteria

1. **Distinct voices**: Given the same Japanese source text, the 3 styles produce translations that are immediately recognizable as different voices
2. **Natural Vietnamese**: NATURAL_CASUAL output matches Kagi B2 Vietnamese Casual Natural quality — reads like a native Vietnamese person wrote it, not like a translation
3. **No translationese**: Zero machine-translation signals (gratuitous nominalization, passive voice, mirrored source structure)
4. **Two-step pipeline**: Translation uses draft → polish flow with source + draft visible in polish step
5. **Fallback works**: If polish step fails, draft result is returned without error
6. **AUTO_CONTEXT removed**: Setting `AI_TRANSLATION_STYLE=AUTO_CONTEXT` causes startup failure with clear error message
7. **Context-aware**: All styles automatically detect message context and adjust within style bounds
8. **Semantic fidelity**: Polish step does not alter meaning, add information, or remove content
9. **All tests pass**: `bun test && bun run typecheck && bun run lint` succeeds

## Happy Path

1. Chatwork webhook receives Japanese message
2. Translator selects active style (e.g., NATURAL_CASUAL)
3. Step 1: Draft prompt produces accurate but potentially stiff translation
4. Step 2: Polish prompt receives source + draft, produces natural Vietnamese
5. Polished translation returned to Chatwork

## Edge Cases

- **Very short text** (1-2 words): Polish step should recognize nothing to polish, return draft as-is
- **Already natural draft**: Polish step should not over-edit — "if the draft is good, keep it"
- **Mixed formality source**: Context-awareness in CORE_DOCTRINE handles register detection within style bounds
- **Source text with code/URLs/markup**: Polish step preserves these untouched (same constraints as draft)
- **Structured translation with 1 segment**: Works identically to single-text path

## Failure Cases

- **Polish LLM call fails**: Fallback to draft result, log warning
- **Polish returns invalid JSON**: Schema validation fails → fallback to draft
- **Polish changes meaning**: Self-critique gate in polish prompt guards against this; if it happens, it's a prompt quality issue to iterate on
- **Both steps fail**: Existing error handling in pipeline (retry + propagate error)

## Explicit Decisions Made

| Decision                            | Source         | Rationale                                                    |
| ----------------------------------- | -------------- | ------------------------------------------------------------ |
| Two-step pipeline (draft → polish)  | User-confirmed | Research shows 43% → 25% translationese reduction            |
| No reading level parameter          | User-confirmed | Workplace chatbot doesn't need A1-C2 granularity             |
| Remove AUTO_CONTEXT entirely        | User-confirmed | Context-awareness embedded in base prompt instead            |
| Breaking change accepted            | User-confirmed | Project in research phase, not production                    |
| All 3 styles improved equally       | User-confirmed | Each style must be distinctly different                      |
| NATURAL_CASUAL benchmark = Kagi B2  | User-confirmed | Natural like a native speaker, not crude like C2             |
| Prompts written in English          | User-confirmed | LLMs comprehend English instructions better                  |
| Content-First approach (Approach A) | User-confirmed | Keep existing architecture, enrich content + add polish step |

## Open Risks

- **Cost doubling**: Two LLM calls per translation. Acceptable for research phase but may need optimization for production (e.g., conditional polish based on source complexity).
- **Polish over-editing**: Risk that polish step changes already-good drafts unnecessarily. Mitigated by explicit "if draft is good, keep it" instruction but needs validation with real data.
- **Style drift in polish**: Polish step might blur style distinctions if polish prompt isn't style-specific enough. Mitigated by style-specific polish criteria.

## Out of Scope

- Reading level / CEFR parameter
- Multi-model routing
- Proofreading feature
- New translation styles
- Dashboard/UI changes
- Provider-specific prompt tuning
- Conditional polish (skip polish for simple texts) — potential future optimization

---

## Testing Strategy

- Unit tests for all new prompt builders (`buildPolishPrompts`, `buildStructuredPolishPrompts`)
- Unit tests for new schemas (`PolishResultSchema`, `StructuredPolishResultSchema`)
- Unit tests verifying `AUTO_CONTEXT` removal from style values
- Integration test: pipeline calls two steps and returns polished result
- Integration test: polish failure triggers fallback to draft
- Dataset runner validation with existing test data to compare quality before/after
