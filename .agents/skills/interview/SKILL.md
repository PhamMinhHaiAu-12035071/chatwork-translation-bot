---
name: interview
description: Requirement interview wizard. Transform vague requirements into a clear, unambiguous spec using structured Q&A. Use when the user says "interview me", "help me define requirements", "turn this idea into a spec", "I have a vague idea", or wants to clarify a feature before implementing.
metadata:
  version: 1.0.0
  author: au-agentic
---

<!-- au-agentic v1.0.0 | tool: codex -->

# Interview

Conduct a structured requirement interview to transform vague requirements into a clear, unambiguous spec before planning or implementation.

## Quick Start

Use `ask_user_question` (or `request_user_input` if available) to ask structured questions. If neither tool is available, ask questions directly in chat as numbered lists.

Example of a good first question:

```
ask_user_question({
  question: "What do you want to build?",
  type: "text"
})
```

## Phase 1: Lock Scope

Ask one question at a time to lock these 8 items. Only move to Phase 2 when ALL 8 have status `accepted` in the decision log:

1. `objective` — What is the specific goal?
2. `definition of done` — When is it considered done?
3. `scope` — What is in scope?
4. `non-goals` — What is explicitly NOT in scope?
5. `constraints` — Technical, time, or team constraints?
6. `environment` — Where will it run? What is the stack?
7. `dependencies` — External dependencies?
8. `risk/safety` — Biggest risks?

## Preflight Check for Multiple-Choice Questions

**REQUIRED:** Before showing ANY multiple-choice question (2+ options), you MUST self-check and self-correct:

1. **Has Recommended Option:** At least 1 option clearly marked `(Recommended)` or carrying a recommended label
2. **Has Explanation:** The recommended option must include 1–2 sentences explaining WHY you chose it
3. **Quality of Explanation:** The explanation must be grounded in concrete context: current codebase patterns, constraints, trade-offs, or blast radius

**Auto-Fix Process:**

- If you are about to show a multiple-choice question that is missing any of the above, STOP
- Add the recommended label and explanation RIGHT NOW before showing it to the user
- Basis for the recommendation: current codebase context, conservative defaults (smallest blast radius + lowest migration cost), or existing patterns
- If you have no codebase context, pick the option with the smallest blast radius and lowest migration cost, and state clearly "This is a conservative default since we lack specific context"

**Required Format:**

**Recommended:** Option X — [1–2 sentences of specific, context-grounded reasoning]

**Options:**

1. Option X (Recommended)
2. Option Y
3. Option Z

**Example:**

```
**Recommended:** Option A — I pick this because the current codebase already uses pattern X in module Y; keeping consistency reduces blast radius during maintenance.

**Options:**
1. Option A (Recommended)
2. Option B
3. Not sure, use recommended
```

**Fail-Fast Guarantee:** This check happens BEFORE you show the question. The user only ever sees the corrected version.

## Phase 2: Deep Dive

Cover: technical implementation, UI/UX, data model, business rules, edge cases, error handling, testing, rollout, security, performance, trade-offs.

## Question Rules

- Ask **1 question per turn**, highest leverage first
- Use numbered choices: `1. Option A  2. Option B (Recommended)`
- Mark the recommended option clearly with `(Recommended)` label
- **NOTE:** See "Preflight Check for Multiple-Choice Questions" above for how to self-check and self-correct before showing a question.
- Allow short answers: `1`, `2`, or `defaults`
- For yes/no: use `ask_user_question` with `type: "confirm"`
- For free text: use `type: "text"`

## Tracking (maintain throughout)

| Tracker         | Format              |
| --------------- | ------------------- | ------ | ------------- | ----------- | ------ |
| decision log    | `[DEC-###] Decision | Status | Provenance    | Risk        | Notes` |
| working spec    | `Goal               | Actors | Core flows    | Constraints | Open`  |
| coverage matrix | `Domain             | Status | Last Updated` |

## Output

When all material ambiguity is resolved, render a **final interview report** as markdown directly in chat. Do not write to a file.

The report recaps the entire interview session so the user can review, and must include:

1. **Rounds summary** — table of each round in order: `Round N | Topic | Question | Answer | Decision`
2. **Decision log** — full log with provenance for each major decision (user-stated, user-confirmed, or AI-recommended accepted by user)
3. **Working spec snapshot** — final version
4. **Coverage matrix** — final version
5. **Scope boundary log** + **scope extension backlog** (render as `Future Scope / Deferred Features` section; mark items as out-of-scope, not estimated, not committed)

Highlight any remaining `high-risk assumption` with the `[UNCONFIRMED - HIGH RISK]` label — do not mix with confirmed decisions.

## References

- Full methodology rules: `references/methodology.md`

## Common Issues

### ask_user_question not available

Ask questions directly in chat as numbered lists. The user can reply with `1`, `2`, or the full answer.

### User answers very short (3 turns in a row, <10 words each)

Offer to batch-confirm remaining items with recommended defaults, mark as `assumed-pending`, review in the closing sequence.

### Contradiction detected

State the two conflicting answers explicitly. Ask which is correct. Mark the superseded option as `superseded` in the decision log.
