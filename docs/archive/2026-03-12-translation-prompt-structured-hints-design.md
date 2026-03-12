# Translation Prompt Structured Hints Design

Date: 2026-03-12
Status: Approved
Owner: Codex + user

## Goal

Improve translation quality toward a practical `9.0+/10` for production use by adding structured context and rule hints to the prompt pipeline, with Japanese -> Vietnamese as phase 1 priority and English -> Vietnamese as phase 2.

## Decision Summary

- Primary optimization target: `Production-first`
- Keigo and email formula policy: `Functional Vietnamese`
- Architecture choice: `Full structured hints`
- Research scope: local codebase and dataset only, no web research
- Delivery order: Japanese -> Vietnamese first, English -> Vietnamese second

## Problem Statement

The current prompt system performs well on many business and technical messages, but it still misses important Japanese-specific production nuances:

- keigo and email formulas are sometimes over-literal or over-expanded
- preserve-sensitive fragments such as units or names are not enforced consistently
- the review layer critiques with strong style pressure but lacks explicit case-specific constraints
- short, ambiguous source texts are hard to handle because the current pipeline relies heavily on generic skopos analysis and free-text notes

The evaluation in [2026-03-12-output-evaluation.md](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/docs/reports/2026-03-12-output-evaluation.md) showed that the main quality gap is not basic translation fluency. The gap is missing structured awareness of what kind of text is being translated and which constraints must be preserved.

## Current Constraints

Current architecture:

- `analysis` produces 14D source analysis plus skopos
- `translation` receives mostly free-text analysis context
- `review` receives source text, draft, and skopos context

Relevant code today:

- [analysis.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/analysis.ts)
- [analysis.schema.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/schemas/analysis.schema.ts)
- [translation-prompt.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/translation-prompt.ts)
- [review.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/review.ts)
- [language-layers.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/language-layers.ts)
- [pipeline.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translator/src/pipeline/pipeline.ts)

The current review prompt is intentionally adversarial, but it does not know explicit case-level rules. The current Japanese rules also over-simplify some formulaic expressions, especially `よろしくお願いいたします`.

## Proposed Architecture

Extend `AnalysisResult` with a new `structuredHints` object. This object becomes the shared source of truth for both translation and review.

High-level flow:

1. `analysis`
   - infer skopos and 14D source analysis as today
   - classify message type and preservation constraints
   - output `structuredHints`
2. `translation`
   - inject `structuredHints` into the translation prompt
   - translate according to a functional Vietnamese policy
3. `review`
   - inject the same `structuredHints` into the review prompt
   - score against shared constraints instead of only general prose instincts

This keeps the current multi-phase design, but removes guesswork from downstream prompt stages.

## Structured Hints Schema

`structuredHints` is additive. It does not replace the existing skopos or 14D analysis fields.

Proposed shape:

```ts
structuredHints: {
  sourceProfile: {
    language: 'japanese' | 'english'
    medium: 'chat' | 'email' | 'notice' | 'technical_doc' | 'mixed'
    domain: 'business' | 'technical' | 'support' | 'general'
    hasCode: boolean
    hasUrl: boolean
    hasJapaneseName: boolean
    hasSpecialFormatting: boolean
  }
  intentLabels: {
    phraseType:
      | 'email_opening_formula'
      | 'email_closing_formula'
      | 'keigo_request'
      | 'request'
      | 'status_question'
      | 'maintenance_notice'
      | 'apology'
      | 'gratitude'
      | 'proper_name_reference'
      | 'code_mixed'
      | 'url_mixed'
      | 'general_statement'
      | 'ambiguous_short_utterance'
    confidence: 'high' | 'medium' | 'low'
  }
  renderingPolicy: {
    strategy: 'functional_vietnamese'
    targetStyle: 'natural_office_vi' | 'technical_vi' | 'customer_service_vi'
    preserveAmbiguity: boolean
    allowNaturalAdaptation: boolean
    avoidLiteralFormulaTranslation: boolean
  }
  preservationRules: {
    preserveUrl: boolean
    preserveCode: boolean
    preserveUnits: boolean
    preserveChatworkMarkup: boolean
    preserveJapaneseNameScript: boolean
    allowRomajiGloss: boolean
    forbidGenderInference: boolean
  }
  reviewFocus: string[]
}
```

Design notes:

- `sourceProfile` captures communication shape and technical surface markers
- `intentLabels` turns source-text classification into a usable downstream label
- `renderingPolicy` locks the production-first humanization goal
- `preservationRules` covers literal constraints that should outrank stylistic polish
- `reviewFocus` gives the reviewer explicit axes to audit

## Classification and Rendering Rules

### Phase 1: Japanese -> Vietnamese

The initial rule catalog should focus on the error classes already seen in the dataset and evaluation report.

#### 1. Formulaic business Japanese

Labels:

- `email_opening_formula`
- `email_closing_formula`
- `keigo_request`
- `apology`
- `gratitude`

Policy:

- translate by communicative function, not literal surface structure
- do not auto-insert `Trân trọng`, `cảm ơn`, or `xem xét` unless the source really carries that meaning
- prefer natural Vietnamese office language over Japanese-flavored stiffness

Examples:

- `お世話になっております`
- `以上、よろしくお願いいたします`
- `ご確認のほどよろしくお願いいたします`

#### 2. Proper names and fixed entities

Labels:

- `proper_name_reference`
- `general_statement` with `hasJapaneseName=true`

Policy:

- preserve Japanese personal names in original script
- allow romaji gloss in parentheses only if helpful
- do not replace the original script with romaji
- do not infer gender from the name alone

Example target style:

- `Vui lòng liên hệ 山田太郎 (Yamada Taro).`

#### 3. Preserve-sensitive technical fragments

Labels:

- `code_mixed`
- `url_mixed`
- `ambiguous_short_utterance`
- `general_statement` with preserve flags

Policy:

- preserve URL literally
- preserve code literally, translate comments only
- preserve units literally when flagged
- preserve Chatwork markup

Examples:

- `APIのエンドポイントはhttps://api.example.comです`
- `const x = 10; // 変数の宣言`
- `100 requests/giây`

#### 4. Technical and business naturalization

Labels:

- `status_question`
- `maintenance_notice`
- `request`
- `general_statement`

Policy:

- prefer natural Vietnamese workplace language
- keep standardized English technical/business terms already defined by the repo
- allow concise rephrasing when it improves readability without distorting meaning

### Priority Order When Rules Conflict

Rules should resolve in this order:

1. preserve literal constraints
2. preserve proper names and script handling
3. preserve formula function
4. preserve register fidelity
5. humanize wording and flow

This prevents humanization from accidentally breaking URLs, code, units, or names.

## Prompt Changes by Phase

### Analysis

Update the analysis system prompt to require `structuredHints` in the JSON output, in addition to the current skopos and 14D fields.

The analysis prompt should explicitly instruct the model to:

- detect whether the message is chat, email, notice, technical, or mixed
- classify formulaic Japanese expressions by function
- detect preservation-sensitive fragments
- decide whether ambiguity should be preserved
- emit only hints derived from the source text itself

### Translation

Update `buildTranslationPrompts()` to include a new block such as:

- `## Structured Hints`
- `## Preservation Rules`
- `## Humanization Policy`

The translation stage should use `structuredHints` to decide:

- how natural the Vietnamese should sound
- whether the phrase is a formula instead of a literal sentence
- whether a proper noun must remain in Japanese script
- whether a unit, URL, or code fragment must remain untouched

### Review

Update `buildReviewPrompts()` to inject the same `structuredHints`.

The review stage should explicitly verify:

- formulaic expressions were rendered by function, not word-by-word
- preserve-sensitive fragments stayed intact
- allowed romaji glosses did not replace the original name
- over-politeness and literal keigo carryover were avoided

This aligns review with the same source-of-truth metadata used by translation.

## Pipeline Impact

The design should also address the current short-text fast path in [pipeline.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translator/src/pipeline/pipeline.ts).

Problem:

- fast path currently skips analysis and review for short texts
- some of the hardest cases are short Japanese utterances or formula-like fragments

Design change:

- replace the purely grapheme-count fast path with a script-aware and content-aware guard
- full analysis should still run for texts that contain Japanese script or preserve-sensitive markers
- retain fast path only for low-risk short texts where structured hints do not materially change quality

Recommended heuristic:

- do not use fast path for any text containing Hiragana, Katakana, or Kanji
- do not use fast path for text containing URL, code-like syntax, or Chatwork markup
- keep fast path only for short Latin-script casual fragments that are low risk

This keeps performance wins where safe, but protects production quality where nuance matters.

## English -> Vietnamese Phase 2

The same `structuredHints` schema should be reused for English -> Vietnamese later.

What changes in phase 2:

- add English-specific `phraseType` labels
- keep the same `sourceProfile`, `renderingPolicy`, and `preservationRules`
- focus on English tone, passive voice, support templates, and corporate bloat rather than keigo

Example future labels:

- `email_opening_formula`
- `email_closing_formula`
- `soft_request`
- `customer_support_response`
- `warning_notice`
- `release_note_entry`

This preserves architecture continuity instead of creating a separate English-only pipeline.

## Testing Strategy

Tests should be added or updated at four levels:

1. schema tests
   - validate `structuredHints` shape
   - reject invalid enums and booleans
2. analysis prompt tests
   - assert the prompt now requires `structuredHints`
   - assert the prompt mentions formula classification and preservation rules
3. translation and review prompt tests
   - assert hints are injected into downstream prompts
   - assert functional Vietnamese and preservation rules are visible
4. pipeline tests
   - assert short Japanese texts no longer bypass analysis blindly
   - assert low-risk short texts can still use fast path

## Success Metrics

Primary metrics:

- eliminate severe keigo and email-formula misses on the current Japanese sample set
- eliminate preserve-sensitive misses for URL, code, unit, and Japanese-name handling
- raise the weakest qualitative outputs from `acceptable/poor` to `good`

Secondary metrics:

- raise Japanese sample test-case alignment from about `8.0/10` to at least `9.0/10`
- raise practical production quality from about `8.1/10` to `9.0+/10`

Guardrails:

- do not degrade formatting, code, URL, or Chatwork markup handling
- do not drift toward literal Japanese-flavored Vietnamese
- do not block reuse for English -> Vietnamese phase 2

## Risks and Mitigations

### Risk: Schema becomes too large and brittle

Mitigation:

- keep `structuredHints` compact and task-driven
- avoid over-modeling niche labels
- add only labels that have downstream effect

### Risk: Model emits inconsistent labels

Mitigation:

- keep enums small and concrete
- include high-signal examples in analysis instructions
- use tests to keep prompt wording stable

### Risk: Humanization and preservation rules conflict

Mitigation:

- define explicit rule precedence
- encode preservation rules as booleans, not vague prose

### Risk: Short-text performance regression

Mitigation:

- narrow fast path instead of removing it globally
- keep low-risk short Latin text on fast path

## Non-Goals

- web research or externally sourced linguistic rules
- replacing the current multi-phase pipeline architecture
- fully solving English -> Vietnamese in the same implementation step
- adding a separate external rules engine or database

## Deliverables

1. update design-time schema for `AnalysisResult`
2. update analysis prompt to emit `structuredHints`
3. update translation and review prompts to consume `structuredHints`
4. refine Japanese language rules toward functional Vietnamese
5. narrow pipeline fast path so short Japanese text still benefits from analysis
6. keep the design reusable for English -> Vietnamese phase 2
