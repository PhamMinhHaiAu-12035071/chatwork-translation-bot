# Natural-First Newline Policy — Design Document

**Date**: 2026-03-04
**Status**: Approved
**Scope**: `packages/core` + `packages/translator`

---

## Problem

The newline placeholder strategy (`[[NL]]`) enforces strict newline parity, but this can make translations feel mechanical and reduce natural prose quality.

For this project, the product decision is:

- Prioritize natural, human-readable Vietnamese first.
- Keep original formatting only as a best effort.
- Paragraph breaks (`\n\n`) are preferred when natural.
- Single line breaks (`\n`) may be smoothed into prose.

---

## Policy Decision

1. Context scope remains one message only.
2. No retry when newline shape differs.
3. No post-processing to inject/recover newlines.
4. No newline mismatch logging/telemetry in this iteration.
5. Output schema stays unchanged (`cleanText`, `translatedText`, `sourceLang`, `targetLang`, `timestamp`).

---

## Technical Direction

### Prompt contract

Prompt must explicitly instruct:

- Natural, idiomatic Vietnamese prose.
- Preserve paragraph breaks (blank lines) when it still reads naturally.
- Single line breaks can be smoothed for readability.
- No `[[NL]]` token handling.

### Service contract

Both OpenAI and Gemini services:

- Send raw `cleanText` to `buildTranslationPrompt`.
- Return `translatedText` as-is from model output.
- Perform no newline encode/decode transform.

### Translator pipeline contract

`handleTranslateRequest` and output writer remain schema-compatible:

- `translation.cleanText` = cleaned input sent to model.
- `translation.translatedText` = model output as-is (no newline normalization).

---

## Tradeoffs

| Aspect            | Decision               | Rationale                                              |
| ----------------- | ---------------------- | ------------------------------------------------------ |
| Newline fidelity  | Best-effort only       | Better prose and readability are prioritized           |
| Placeholder token | Removed                | Avoid rigid formatting constraints and token artifacts |
| Recovery strategy | No retry / no auto-fix | Keep pipeline simple and deterministic                 |
| Observability     | No mismatch logs       | Minimize operational noise for this phase              |

---

## Validation Targets

1. Runtime code contains no `encodeNewlines`, `decodeNewlines`, or `[[NL]]` token logic.
2. Prompt includes natural-first + paragraph-best-effort instructions.
3. Service tests prove pass-through output for newline variants.
4. Handler regression confirms pipeline does not alter model newlines.

---

## Supersedes

This design supersedes archived placeholder plans:

- `docs/archive/2026-03-04-newline-placeholder-design.md`
- `docs/archive/2026-03-04-newline-placeholder-implementation.md`
