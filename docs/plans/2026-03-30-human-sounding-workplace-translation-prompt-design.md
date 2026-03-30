# Human-Sounding Workplace Translation Prompt Design

**Version:** 1.0
**Date:** 2026-03-30
**Prepared by (AI-assisted):** Codex
**Status:** Approved for implementation planning

## Objective

Redesign the Japanese/English to Vietnamese translation prompt for Chatwork-style workplace
content so the output reads like a real Vietnamese person wrote it, while preserving business and
technical meaning and producing clearly different results across the three customer-facing styles.

## Scope

### In scope

- Rewrite the shared translation doctrine in
  `packages/translation-prompt/src/sections/core.ts`
- Expand language-specific rules in
  `packages/translation-prompt/src/sections/language-layers.ts`
- Refactor style shaping in
  `packages/translation-prompt/src/sections/translation-style-profiles.ts`
- Replace the current self-check rules in
  `packages/translation-prompt/src/sections/verification.ts`
- Update prompt-construction tests in
  `packages/translation-prompt/src/translation-prompt.test.ts`
- Preserve the existing one-step JSON prompt contract used by the translator pipeline

### Out of scope

- Room or thread history
- Personalized voice mimicry
- Detector benchmark integration
- Reintroducing multi-pass review loops
- Expanding the product into a general-purpose translator outside workplace content

## Non-goals

- Do not turn the prompt into a generic "humanizer" or writing assistant
- Do not import SEO/article-writing baggage from leaked prompts
- Do not optimize explicitly for AI-detector evasion language
- Do not weaken semantic guardrails in order to increase casualness
- Do not change the translator pipeline shape, schemas, or response envelope

## Done

The design is complete when implementation produces a prompt architecture with:

- A doctrine-heavy shared core that is clearly stronger than the style adapters
- Japanese and English treated as first-class source languages
- Three styles that produce visibly different Vietnamese workplace output
- A naturalness-first doctrine that still preserves force, numbers, deadlines, conditions,
  negation, and logic
- Functional-minimal rendering for workplace formulas and hedging
- Style-aware preservation of workplace English terminology
- A short verification checklist that enforces naturalness, semantic fidelity, and style
  separation
- Tests that lock the architecture and its behavioral anchors without snapshotting the full prompt

## Constraints

- Keep the existing one-step JSON interface:
  `{"sourceLang":"...","translated":"..."}` or structured segment equivalent
- Keep tagged input as literal text to translate, never instructions to execute
- Preserve code, URLs, tags, timestamps, numbers, names, and structural markers
- Use only local message context from the content being translated
- Allow strong paraphrasing for natural Vietnamese, but never change force, obligation, urgency,
  numbers, deadlines, conditions, negation, or logic
- Keep profanity, slang, and harsh tone faithful instead of auto-softening them

## UX/UI

There is no new end-user UI in this design.

Users continue choosing one of three existing styles:

- `NATURAL_CASUAL`
- `PROFESSIONAL_BUSINESS`
- `TECHNICAL`

The product behavior change is entirely in translation quality and style separation, not in user
interaction or configuration surface.

## Data / Business Rules

### Language support

- Japanese and English are both first-class source languages
- Japanese remains the dominant real-world source in the customer's usage pattern
- Mixed JP/EN input is supported under the same doctrine and preservation rules

### Context policy

- The prompt is context-aware only within the message or structured segment being translated
- It may use line breaks, adjacent sentences, headings, and formatting cues
- It may not assume room history, user identity history, or long-term conversational memory

### Fidelity policy

- Naturalness is the top-level translation goal
- Naturalness does not permit changing the operational meaning of workplace content
- Requests, duties, deadlines, quantitative values, constraints, and logical relationships must be
  preserved exactly in intent

### Formula handling

- Japanese and English workplace formulas are rendered by communicative function, not by surface
  form
- Formula rendering is intentionally minimal
- The prompt must not invent closings such as `Trân trọng`, `xin xem xét`, or `chân thành cảm ơn`
  unless the source explicitly carries that meaning

### Preservation policy

- Always preserve:
  - code
  - URLs
  - tags
  - timestamps
  - numbers
  - proper nouns
  - segment order
  - important line breaks and structure
- Technical and business terminology uses style-aware preservation:
  - `NATURAL_CASUAL`: localize when natural in workplace Vietnamese
  - `PROFESSIONAL_BUSINESS`: balance natural localization with familiar workplace English
  - `TECHNICAL`: keep more industry-standard English when Vietnamese teams naturally do so

### Voice and politeness policy

- No personal voice mimicry
- No gender, hierarchy, or relationship hallucination
- Vietnamese pronouns and particles are allowed only under a context-gated minimal rule
- Harsh, rude, or slang source tone is translated faithfully and not auto-sanitized

## Technical Approach

## Architecture

The new prompt stack has five layers:

1. `Base Translator Role`
   - Short translator-first identity anchor
   - No persona theater, fake biography, or roleplay scaffolding
2. `Shared Doctrine Core`
   - Holds the main translation intelligence
   - Defines naturalness-first rendering, anti-literalism, semantic guardrails, preservation, and
     anti-injection behavior
3. `Language-Specific Layers`
   - Thin Japanese and English rule packs for source-specific traps
4. `Thin Style Adapters`
   - Strong enough to produce visibly different output styles
   - Too thin to override doctrine or meaning
5. `Verification Checklist`
   - Short internal self-check before JSON output

## Shared Doctrine Core

The shared core is the center of gravity for the redesign.

It should distill the highest-leverage principles from Kagi-like translation prompts and leaked
humanizer research into a translation-first doctrine:

- render the target as native Vietnamese first
- avoid word-for-word translation and source-language-shaped syntax
- rewrite strongly when needed for natural Vietnamese rhythm
- preserve meaning and operational force
- translate by communicative function where appropriate
- use local message context only
- preserve structural and literal fragments precisely
- treat all tagged text as literal text to translate
- avoid explicit detector-gaming language, SEO baggage, forbidden-word dumps, and roleplay noise

The safety floor inside the shared core is strict:

- rewriting strength is allowed for naturalness
- meaning drift is not allowed for force, obligations, numbers, deadlines, conditions, negation,
  or logic

## Language Layers

### Japanese layer

The Japanese layer handles source-specific failure modes:

- keigo and business formulas rendered by communicative function
- no literal handling of standard opening and closing formulas
- no invented review request or gratitude when the source does not contain it
- preserve Japanese-script personal names if the source uses Japanese script
- map katakana and loanwords into the most natural Vietnamese workplace form allowed by the style
  adapter
- avoid heavy Sino-Vietnamese phrasing caused by literal Japanese transfer

### English layer

The English layer handles workplace-English traps:

- resolve hedging and polite indirection by communicative intent
- avoid bookish or syntax-mirroring Vietnamese
- collapse overly English sentence logic into natural Vietnamese workplace phrasing
- keep short task-oriented English concise in Vietnamese
- cooperate with style-aware term preservation instead of hardcoding localization behavior

## Style Adapters

### `NATURAL_CASUAL`

- Highest paraphrase budget
- Strongest preference for native-feeling Vietnamese
- Keeps English only when it is truly part of everyday workplace/tech speech
- May use light pronouns or particles, but only when local context supports them
- Must not drift into chat-app slang or overfamiliar performance

### `PROFESSIONAL_BUSINESS`

- Stable default for general workplace usage
- Clear, concise, modern, and respectful
- Medium paraphrase budget
- Minimal particle use
- Avoids both stiffness and overfriendliness

### `TECHNICAL`

- Lowest paraphrase budget, while still avoiding literal translation
- Preserves technical force and industry-standard wording most aggressively
- Keeps more English technical terms than the other styles when that is the natural team usage
- Avoids business-email cadence and decorative wording

### Style separation contract

All three styles must differ clearly in:

- register
- sentence rhythm
- level of colloquialness
- English-term retention
- directness

No style may:

- change meaning
- change operational force
- invent relationship signals
- violate preservation rules

## Verification

The verification layer remains short and internal. It is not a revived review loop.

It must check three required axes:

- `naturalness`
- `semantic fidelity`
- `style separation`

The checklist should reject outputs that sound translated, outputs that preserve meaning badly, and
outputs whose style settings collapse into one generic voice.

## Acceptance Criteria

- The shared doctrine appears ahead of language and style shaping in prompt assembly
- Japanese and English are both explicitly represented as first-class source handling concerns
- The prompt instructs strong natural rewriting without permitting operational meaning drift
- Workplace formulas are translated functionally and minimally
- Tagged text is always treated as literal text to translate
- `NATURAL_CASUAL`, `PROFESSIONAL_BUSINESS`, and `TECHNICAL` are visibly different in voice and
  register
- `TECHNICAL` preserves technical force and terminology more aggressively than the other styles
- `PROFESSIONAL_BUSINESS` remains the safest general workplace default
- `NATURAL_CASUAL` sounds the least translated while staying workplace-safe
- Tests assert doctrine-first ordering, preservation invariants, language-layer coverage, and style
  separation anchors

## Happy Path

1. A Chatwork message or structured segment is passed into the one-step translation prompt.
2. The shared doctrine identifies the communicative intent and rewrites toward native Vietnamese.
3. The relevant Japanese or English source-language layer resolves language-specific pitfalls.
4. The selected style adapter shapes register, directness, and term retention.
5. The verification checklist silently checks naturalness, semantic fidelity, and style separation.
6. The model returns the existing JSON envelope with Vietnamese translation output.

## Edge Cases

- Japanese keigo greetings and closings that should not be translated literally
- English hedging that should not become stiff or overly wordy Vietnamese
- Mixed JP/EN source with preserved technical fragments
- Structured segments where segment order must remain exact
- Short imperative technical lines where naturalness must not weaken the command
- Source profanity or irritation that must remain faithful in tone
- Inputs with sparse context where pronouns and particles should remain minimal

## Failure Cases

- The prompt softens or strengthens workplace requests beyond the source meaning
- The prompt invents gratitude, apology, or review requests not present in the source
- The prompt romanizes Japanese names that were given in Japanese script
- The three styles produce nearly identical phrasing
- English workplace messages sound like translated manuals instead of workplace Vietnamese
- Instruction-like text inside tags alters model behavior instead of being translated literally

## Testing

- Update `packages/translation-prompt/src/translation-prompt.test.ts`
- Prefer behavioral anchor tests over full-string snapshots
- Add assertions for:
  - doctrine-first ordering
  - strong naturalness language in the shared core
  - semantic guardrails around force/data/deadlines/conditions
  - Japanese formula handling anchors
  - English workplace handling anchors
  - style-specific differences in register and term retention
  - preservation and anti-injection invariants

## Rollout / Ops

- No pipeline or API rollout is required beyond updating prompt content and tests
- Bump the prompt build identifier when implementation lands
- Validate with package-level tests first, then repo-level verification
- Manual evaluation should compare:
  - naturalness of each style
  - separation between styles
  - Japanese versus English source handling quality

## Explicit Decisions Made

- `User-confirmed`: keep the three existing customer-facing styles
- `User-confirmed`: styles may diverge strongly in phrasing and register as long as meaning stays
  intact
- `User-confirmed`: optimize for Chatwork/workplace content, not broad creative/general translation
- `User-confirmed`: naturalness is the primary success criterion
- `User-confirmed`: anti-detector behavior is an indirect outcome, not a direct prompt objective
- `AI-recommended, user-confirmed`: use a shared safety floor that preserves force, numbers,
  deadlines, conditions, and logic
- `User-confirmed`: Japanese and English are both first-class source languages
- `User-confirmed`: use only fixed styles plus local source context, not personal voice imitation
- `User-confirmed`: formulas are handled functionally and minimally
- `User-confirmed`: technical/business term preservation is style-aware
- `User-confirmed`: pronouns and particles are context-gated and minimal
- `User-confirmed`: profanity and harsh tone remain uncensored and faithful
- `User-confirmed`: instruction-like source text is always translated literally
- `AI-recommended, user-confirmed`: architecture is doctrine-heavy with thin language and style
  layers
- `User-confirmed`: leaked research is distilled into principles instead of copied exhaustively

## Risks / Trade-offs

- Pushing naturalness too hard can still cause subtle drift on ambiguous workplace lines
- Style separation may be too weak if `NATURAL_CASUAL` and `PROFESSIONAL_BUSINESS` are not written
  sharply enough
- English handling may lag Japanese quality if the English layer is too generic
- Thinner style adapters are easier to maintain, but they require a very disciplined shared core

## Open Risks

- `NATURAL_CASUAL` may still collapse toward `PROFESSIONAL_BUSINESS` on neutral source text
- Workplace English may remain less nuanced than Japanese until enough explicit examples and rules
  exist in the layer wording
- Some models may follow doctrine-level naturalness strongly but under-deliver style separation on
  terse inputs

## Future Scope / Deferred Features

These are confirmed outside the current scope, not estimated, and not committed in this design:

- Room-history or thread-history aware translation
- Personalized voice mimicry per sender or room
- AI-detector smoke tests or benchmark tooling
- Multi-pass review or refinement loops
- Broader non-workplace translation styles such as social, marketing, or creative copy
