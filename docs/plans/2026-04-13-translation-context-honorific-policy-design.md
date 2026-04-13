# Translation Context Honorific Policy Design

**Date:** 2026-04-13
**Status:** Approved
**Approach:** Prompt Policy Enhancement with LLM-First Context Matching

## Problem

The current translator already injects room-level `Translation Context` into the system prompt and message-level `mentionHint` into the user prompt. That gives the LLM some room context, but it does not explicitly teach the model how to:

- match names in the incoming Chatwork message with names or aliases mentioned in `Translation Context`
- prefer a Latin alias when the context provides both a Japanese name and a Latin display form
- use optional gender, role, job title, or seniority hints to choose safer Vietnamese address forms
- degrade gracefully when the room context is incomplete, freeform, or unrelated

The user's desired behavior is intentionally soft:

- no strict `members[]` schema
- no parser that extracts room members into structured runtime data
- no runtime validation that fails because the context is unstructured
- no forced romanization when the room context does not explicitly provide a trusted display name

This is a prompt-quality improvement, not a room-data modeling project.

## Current State

The current relevant behavior already exists in three places:

- `packages/translator/src/services/room-translation-orchestrator.ts`
  - trims `room.context`
  - forwards it into the standard backend
  - forwards `mentionHint` when mention metadata exists
- `packages/translator/src/pipeline/pipeline.ts`
  - forwards `roomContext` and `mentionHint` into the prompt builder
- `packages/translation-prompt/src/translation-prompt.ts`
  - injects `## Room Context` into the system prompt
  - injects `<MENTION_CONTEXT>` into the user prompt

The missing piece is instruction quality: the system prompt does not yet give the model a precise policy for handling person metadata from freeform room context.

## User-Confirmed Decisions

| #       | Decision                                                                                                     | Status   | Provenance     |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------- | -------------- |
| DEC-001 | Keep `Translation Context` as freeform room text                                                             | Accepted | user-confirmed |
| DEC-002 | Do not introduce a first-class `members[]` schema                                                            | Accepted | user-confirmed |
| DEC-003 | Do not parse room context into structured runtime member records                                             | Accepted | user-confirmed |
| DEC-004 | Let the LLM match names in the raw message against names or aliases described in `Translation Context`       | Accepted | user-confirmed |
| DEC-005 | If `Translation Context` provides both Latin alias and Japanese name, Vietnamese output should prefer Latin  | Accepted | user-confirmed |
| DEC-006 | If `Translation Context` only provides the original Japanese name, keep it as-is and do not force romaji     | Accepted | user-confirmed |
| DEC-007 | Gender, role, job title, and seniority hints are optional; use them only when clearly stated                 | Accepted | user-confirmed |
| DEC-008 | Missing or messy context must never break translation flow                                                   | Accepted | user-confirmed |
| DEC-009 | `mentionHint` remains a supporting signal for who the message is addressing, not a replacement for room text | Accepted | user-confirmed |

## Scope

**In-scope:**

- strengthen the `Translation Context` instruction block in the prompt builder
- teach the model how to combine `Translation Context` and `mentionHint`
- codify fallback behavior for missing, ambiguous, or irrelevant person metadata
- update prompt tests to lock the new policy text
- bump the prompt build ID because system-prompt semantics change

**Out-of-scope:**

- any new room config schema field such as `members[]`
- any parser that attempts to normalize `Translation Context` into runtime person objects
- any new Chatwork API lookup for room members
- any new runtime error path for malformed or unstructured room context
- any guarantee that the LLM will always infer the perfect honorific in every ambiguous case

## Chosen Direction

Use a prompt-only policy enhancement centered in `@chatwork-bot/translation-prompt`.

This keeps the architecture aligned with the user's intent:

- room config keeps storing freeform `context`
- webhook flow remains unchanged
- orchestrator keeps forwarding `room.context` and `mentionHint`
- the LLM receives clearer instructions on how to use those inputs

This is the narrowest change that materially improves quality without drifting into soft-structured parsing or schema work.

## Architecture

### Data Flow

```
Create/Edit room
  -> save freeform Translation Context
  -> room config store persists `context`

Webhook trigger
  -> translator resolves room config
  -> orchestrator forwards trimmed `room.context`
  -> orchestrator forwards existing `mentionHint` when available
  -> pipeline builds prompts
  -> prompt policy teaches the LLM how to:
       - match names in message vs context
       - prefer trusted Latin alias when present
       - use optional role/gender/seniority hints
       - fall back safely when confidence is low
  -> LLM produces Vietnamese translation
```

### Packages Affected

| Package                            | Changes                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `@chatwork-bot/translation-prompt` | Main implementation: stronger room-context policy text and prompt build ID bump           |
| `@chatwork-bot/translator`         | No intended runtime code changes; existing context + mention forwarding remain sufficient |

## Design Details

### 1. System Prompt Policy

The `CONTEXT_ENFORCEMENT_HEADER` in `packages/translation-prompt/src/translation-prompt.ts` should be expanded so the LLM is explicitly told:

- the room context may contain structured or unstructured notes
- it may mention people, aliases, roles, titles, gender, seniority, or team norms
- person metadata is optional and should only be used when clearly stated
- names in the current message may correspond to names or aliases in room context
- when the context provides both a Japanese name and a Latin alias, prefer the Latin alias in Vietnamese output
- when the context only provides the original Japanese name, keep that name and do not invent a romanized form
- when metadata is incomplete or ambiguous, translate conservatively and naturally rather than guessing

This policy must be short enough to avoid bloating the prompt, but explicit enough to reduce common failure modes.

### 2. Soft Reference Model

`Translation Context` is treated as a soft reference block, not a strict schema.

That means the model can benefit from inputs like:

```text
Members:
- Tanaka Taro / 田中太郎 (PM, male)
- Yui Sato / 佐藤結衣 (Designer, female)
Tone: Professional and respectful.
```

but it should also tolerate freeform notes like:

```text
Tanaka is the male PM. Sarah is the female client contact.
This room is polite but not ceremonial.
```

or unrelated notes like:

```text
Internal engineering room. Keep technical English terms.
```

If there is no reliable people metadata, the model should simply use whatever contextual benefit exists and continue translating normally.

### 3. Relationship Between `mentionHint` and `Translation Context`

These two signals solve different problems:

- `mentionHint` answers: who is being addressed in this message, and is the addressing singular or plural?
- `Translation Context` answers: if that person is known in this room, what optional metadata exists about their name, role, gender, or status?

The model should be guided to combine them:

- use `mentionHint` to identify the likely addressee focus
- then inspect `Translation Context` for matching person notes
- if a reliable match exists, apply the stored naming and honorific guidance
- if not, keep the addressing safe and non-committal

### 4. Naming Rules

When translating into Vietnamese:

- if context contains both Latin alias and Japanese name:
  - use the Latin alias in the final Vietnamese output
  - use the Japanese name only as a matching anchor
- if context contains only the Japanese name:
  - keep that original name
  - do not force a romaji guess
- if context contains only a Latin display name:
  - use that Latin display name when the message clearly refers to the same person
- if there is no reliable match:
  - preserve the message text naturally without inventing a new display name

### 5. Honorific Rules

The prompt should teach the LLM to use optional person metadata conservatively:

- use gender, role, title, or seniority only when clearly provided
- if gender or role is unclear, do not over-assert a specific social relationship
- prefer polished business-safe Vietnamese forms over overconfident guessing
- when confidence is low, degrade gracefully rather than forcing `anh/chị/ông/bà/...`

This feature does not encode a deterministic mapping table in runtime code. It improves the model's reasoning conditions.

### 6. Failure and Fallback Behavior

The enhancement must not create new runtime failure modes.

Expected behavior:

- `room.context` is `null` -> no room-context section
- `room.context` is empty or whitespace-only -> no effective room-context section
- `room.context` is freeform and does not mention people -> translation still works
- `room.context` mentions people without gender/role -> the model may use names if helpful, but must not guess extra metadata
- `room.context` contains conflicting or ambiguous people notes -> the model should translate conservatively

At worst, the system should fail open into the current prompt behavior, never fail closed due to room context shape.

## Examples

### Example A: Alias + Japanese Name + Gender

```text
Translation Context:
Members:
- Tanaka Taro / 田中太郎 (PM, male)

Incoming message:
[To:123]田中太郎
確認お願いします
```

Desired output style:

```text
Anh Tanaka Taro vui lòng xác nhận giúp.
```

### Example B: Japanese Name Only

```text
Translation Context:
Members:
- 田中太郎 (PM, male)

Incoming message:
田中太郎さん、確認お願いします
```

Desired output style:

```text
Anh 田中太郎 vui lòng xác nhận giúp.
```

The model should not invent `Tanaka Taro` if that alias was never supplied.

### Example C: No Person Metadata

```text
Translation Context:
Internal engineering room. Keep technical English terms.

Incoming message:
[To:123]Yamada
お疲れ様です
```

Desired behavior:

- translation still succeeds
- the engineering tone hint can still help
- the model must not pretend it knows Yamada's role or gender

## Testing Strategy

### Unit Tests — `@chatwork-bot/translation-prompt`

Add or update tests in `packages/translation-prompt/src/translation-prompt.test.ts` to verify that the system prompt:

- treats room context as structured or unstructured optional guidance
- instructs the model to match message names against context aliases
- prefers Latin alias over Japanese name when both are supplied
- forbids forced romanization when no alias is supplied
- uses person metadata only when clearly stated
- falls back safely when metadata is missing or ambiguous

### Existing Coverage to Preserve

Existing tests already cover:

- room-context section injection
- `mentionHint` user-prompt injection
- keyword hint injection

Those tests should continue passing without widening the runtime surface area.

### Verification Level

This change is fundamentally prompt-policy oriented. Unit tests can lock the prompt text, but they cannot guarantee exact LLM phrasing in every real translation. Real-world quality should be validated afterward with manual or dataset-driven evaluation.

## Non-Goals

This design does not introduce:

- a people directory in room settings
- deterministic runtime honorific resolution
- an alias parser for freeform room text
- any promise that every ambiguous interpersonal nuance can be solved from prompt policy alone

The goal is narrower and pragmatic: improve the model's odds of choosing the right Vietnamese naming and address style when the user has already supplied helpful context.
