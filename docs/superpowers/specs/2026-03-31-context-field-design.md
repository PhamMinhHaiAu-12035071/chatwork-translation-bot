# Context Field Feature — Design Spec

**Version:** 1.0  
**Date:** 2026-03-31  
**Prepared by (AI-assisted):** Claude Sonnet 4.6 + user review  
**Status:** Approved — ready for implementation planning

---

## Objective

Add an optional **Room Context** field to each room configuration. This field lets users describe the room's domain, purpose, and members in plain text. The context is injected into the AI system prompt on every translation for that room, helping the LLM focus its translation role, choose appropriate register/honorifics, and produce sharper, more contextually accurate Vietnamese output.

Analogy: similar to "Act as a Senior Google Developer" role prompting — the context grounds the AI in the room's world before it translates.

---

## Scope

**In scope:**

- `context` field on Create Room and Edit Room forms (optional textarea)
- Collapsible UI section with split editor + template gallery
- 5 built-in global templates (hardcoded in frontend)
- System prompt injection: `## Room Context\n{context}` appended when non-empty
- Character limit: 500 characters (~125–167 tokens)
- Backend storage in existing JSON-file room config

**Non-goals / Out of scope:**

- User-managed template CRUD (custom template creation/editing)
- Per-room custom templates
- Context versioning or history
- Token counting validation (character limit is sufficient enforcement)
- Content moderation beyond maxLength

---

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

All new code covered by unit tests. No existing tests broken.

---

## Architecture

### Data flow (end-to-end)

```
Dashboard (Edit/Create Room)
  └─ POST/PUT /api/rooms  { ..., context: string | null }
       └─ RoomConfigStore.create / .update
            └─ Persisted in room-configs.json
                 └─ webhook/handler.ts reads roomConfig.context
                      └─ TranslationPipeline(executor, { translationStyle, roomContext })
                           └─ buildStructuredTranslationPrompts(segments, style, msgCtx, roomContext?)
                                └─ system prompt = SHARED_SYSTEM + contextSection? + styleSection
```

### Prompt injection

When `roomContext` is non-empty string:

```
[SHARED_SYSTEM]                     ← unchanged
[## Room Context + enforcement]     ← new, injected only when non-empty (see format below)
[## Active Style: ...]              ← unchanged styleSection
```

When `roomContext` is null/empty/undefined → section is omitted entirely. Backward compatible.

#### Context section format (enforcement-first)

The section must open with an explicit **action instruction** before the user-supplied text, so the LLM is told to act on it rather than just read it. This is critical — a context block with no directive risks being treated as passive background noise.

```
## Room Context
Apply this context to every translation in this room:
- Use member names and roles to determine correct honorifics (anh/chị/ông/bà/em/tôi).
- Use the domain and project description to calibrate terminology and register.
- When a member's gender or seniority is stated, always apply it in pronouns and address forms.

{roomContext.trim()}
```

**Why this works:** Placing the imperative verbs ("Apply", "Use", "calibrate") at the top of the section ensures they are parsed in the same attention window as the rules above them in `SHARED_SYSTEM`. LLMs reliably follow explicit directives in system prompts; implicit data alone is often under-applied.

#### CORE_DOCTRINE conflict — fix required

`sections/core.ts` currently contains:

```
Use only the local message or segment as context.
```

This line means "do not infer from prior conversation history" — correct intent. However, with room context present, the LLM may over-apply this rule and ignore `## Room Context`. The fix is to make the scope of this rule explicit:

```ts
// Before:
'Use only the local message or segment as context.'

// After:
'Use only the local message or segment as translation input. ' +
  'When ## Room Context is present in this prompt, consult it for honorifics, domain terminology, and register — but do not translate it.'
```

This change is minimal, scoped, and does not affect rooms without context (the clause "when ## Room Context is present" makes it conditional).

---

## Data Model

### `translator/src/types/room-config.ts`

```ts
// RoomConfigSchema — add field:
context: z.string().max(500).nullable().optional().default(null)

// CreateRoomRequestSchema — add field:
context: z.string().max(500).nullable().optional().default(null)

// UpdateRoomRequestSchema — add field:
context: z.string().max(500).nullable().optional()
```

`RoomConfig.context` is exposed in `RoomConfigPublic` (no redaction needed).  
Existing rooms without a `context` field parse correctly via `.optional().default(null)`.  
No file migration required — JSON schema version stays at `1`.

---

## API Contract

| Method | Endpoint         | Change                                    |
| ------ | ---------------- | ----------------------------------------- |
| `POST` | `/api/rooms`     | Accept `context?: string \| null` in body |
| `PUT`  | `/api/rooms/:id` | Accept `context?: string \| null` in body |
| `GET`  | `/api/rooms`     | Return `context` in each room object      |
| `GET`  | `/api/rooms/:id` | Return `context` in room object           |

No new endpoints. No breaking changes.

---

## Prompt Package Changes

### `translation-prompt/src/translation-prompt.ts`

Add `roomContext?: string` parameter to both build functions:

```ts
export function buildStructuredTranslationPrompts(
  segments: string[],
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  fullMessageContext?: string,
  roomContext?: string, // ← new
): PromptPair

export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string, // ← new
): PromptPair
```

System prompt construction:

```ts
const CONTEXT_ENFORCEMENT_HEADER = `Apply this context to every translation in this room:
- Use member names and roles to determine correct honorifics (anh/chị/ông/bà/em/tôi).
- Use the domain and project description to calibrate terminology and register.
- When a member's gender or seniority is stated, always apply it in pronouns and address forms.`

function buildContextSection(roomContext?: string): string {
  if (!roomContext?.trim()) return ''
  return `## Room Context\n${CONTEXT_ENFORCEMENT_HEADER}\n\n${roomContext.trim()}`
}

// In buildStructuredTranslationPrompts / buildSingleCallPrompts:
const contextSection = buildContextSection(roomContext)
const systemParts = [SHARED_SYSTEM, contextSection, buildTranslationStyleSection(style)]
  .filter(Boolean)
  .join('\n\n')
```

The enforcement header adds ~35 tokens — fixed cost, paid only when context is present.

---

## Pipeline Changes

### `translator/src/pipeline/pipeline.ts`

```ts
// TranslationPipeline constructor opts:
private readonly opts: {
  timeoutMs?: number
  translationStyle?: TranslationStyle
  roomContext?: string     // ← new
}

// Pass to buildSingleCallPrompts / buildStructuredTranslationPrompts
```

### `translator/src/webhook/handler.ts`

```ts
const pipeline = new TranslationPipeline(executor, {
  timeoutMs: effectiveTimeoutMs,
  translationStyle,
  roomContext: roomConfig.context ?? undefined, // ← new
})
```

---

## Dashboard Changes

### `dashboard/src/lib/api-types.ts`

```ts
interface RoomConfigPublic {
  // ... existing fields ...
  context: string | null // ← new
}

interface CreateRoomInput {
  // ... existing fields ...
  context?: string | null // ← new
}

interface UpdateRoomInput {
  // ... existing fields ...
  context?: string | null // ← new
}
```

### `dashboard/src/lib/room-schema.ts`

```ts
// roomCreateSchema and roomEditSchema — add field:
context: z.string().max(500, 'Max 500 characters').optional().default('')
```

**Empty string → null mapping:** The form stores context as `string` (default `''`). Before sending to API (`createRoom` / `updateRoom` in `room-store.ts`), map: `context: data.context?.trim() || null`. This ensures the backend always receives `string | null`, never `''`.

### `dashboard/src/lib/context-templates.ts` _(new file)_

Five built-in global templates. Each has `key`, `icon`, `name`, `description`, and `body`.

| Key         | Icon | Name               | Description                                    |
| ----------- | ---- | ------------------ | ---------------------------------------------- |
| `client`    | 🤝   | Client Project     | Client-facing, formal tone, respectful xưng hô |
| `internal`  | 🏠   | Internal Team      | Dev/design team, casual natural Vietnamese     |
| `tech`      | ⚙️   | Tech Dev Room      | Engineering, preserve English tech terms       |
| `crossteam` | 📋   | Cross-team Meeting | Multi-dept, neutral, professional              |
| `exec`      | 👔   | Executive / Board  | C-level, very formal, ông/bà                   |

Template body content is structured as:

```
Room type: [description]
Project: [project name and purpose]
Members: [Name (Role, gender), ...]
Tone: [guidance for register, honorifics, formality]
```

### `ContextField` component _(new component)_

Location: `dashboard/src/components/molecules/context-field.tsx`

**Behavior:**

- Default state: collapsed — shows `brutal-button` trigger with 🧠 icon, "Translation Context" title, subtitle, "Optional" badge, chevron
- Expanded state: dashed panel appears with split layout
  - Left (1.5fr): labeled textarea (`brutal-input brutal-textarea`), char counter with progress bar, `✕ Clear` button
  - Right (1fr): "⚡ Quick templates" label, 5 `tpl-pill` buttons (vertical list)
  - Click pill → fills textarea, highlights pill active (violet), deactivates others
  - Char counter: live update, turns red when > 450 chars
  - Info note at bottom: "Context được đính vào system prompt cho mọi bản dịch của room này."
- Used in both `RoomCreatePage` and `RoomDetailPage` below the existing fields, inside the Room Configuration card, after a `page-divider-brutal` separator

**Props:**

```ts
interface ContextFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
}
```

---

## Token Budget Analysis

| Item                                   | Tokens (est.)                   |
| -------------------------------------- | ------------------------------- |
| Current system prompt                  | ~720–770                        |
| `## Room Context` header               | ~3                              |
| Enforcement instruction (fixed)        | ~35                             |
| Max context content (500 chars, mixed) | ~125–167                        |
| **New total (max)**                    | ~883–975                        |
| Remaining for user prompt + response   | 127k+ (GPT-4o) / 999k+ (Gemini) |

Well within budget for all supported providers. Enforcement header is a fixed ~35-token cost paid only when context is present.

---

## Acceptance Criteria

### Happy path

- [ ] Create Room with context filled → context stored in room config JSON
- [ ] Edit Room → context pre-filled with saved value, editable
- [ ] Click template pill → textarea fills with template content
- [ ] Translation pipeline uses context in system prompt when non-empty
- [ ] System prompt contains `## Room Context` header + enforcement instruction + context body
- [ ] System prompt enforcement instruction contains "anh/chị/ông/bà" and "calibrate terminology"
- [ ] Existing rooms without context field → translate without change (prompt identical to before)

### Edge cases

- [ ] Context = empty string → no context section injected into prompt
- [ ] Context = null → no context section injected
- [ ] Context = 500 chars exactly → accepted
- [ ] Context = 501 chars → rejected by Zod validation with error message
- [ ] Click second pill → deactivates first pill, loads new template
- [ ] Click `✕ Clear` → textarea empty, all pills deactivated, counter resets to 0/500

### Failure cases

- [ ] POST /api/rooms with context > 500 chars → 400 Bad Request
- [ ] PUT /api/rooms/:id with context > 500 chars → 400 Bad Request

---

## Testing Strategy

| Layer                           | What to test                                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translation-prompt` unit tests | `buildStructuredTranslationPrompts` with `roomContext` present → system prompt contains enforcement header + context body; section absent when `roomContext` null/empty/undefined; `CONTEXT_ENFORCEMENT_HEADER` contains imperative directives |
| `translation-prompt` unit tests | `sections/core.ts` CORE_DOCTRINE contains updated "local message or segment as translation input" phrasing with conditional `## Room Context` clause                                                                                           |
| `translator` unit tests         | `TranslationPipeline` passes `roomContext` to prompt builder; `rooms.ts` accepts/validates `context` field in create and update                                                                                                                |
| `dashboard` unit tests          | `roomCreateSchema` / `roomEditSchema` validates max 500; `ContextField` renders collapsed by default; click pill fills textarea; char counter updates                                                                                          |

---

## Explicit Decisions Made

| Decision                                    | Source                        | Notes                                                                                  |
| ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| System prompt injection (not user prompt)   | User confirmed (Turn 1)       | Context is room-level static, fits system prompt role                                  |
| 500 character limit                         | AI-recommended, user approved | ≈125–167 tokens; sufficient for room type + members + tone note                        |
| 5 built-in templates, hardcoded in frontend | User confirmed (Turn 3)       | No template CRUD needed; editable in textarea is sufficient                            |
| Collapsible trigger (hidden by default)     | User selected V5 UX           | Field is optional; hiding avoids form clutter                                          |
| Split editor + gallery layout               | User selected V8 layout       | Side-by-side makes template pills and textarea visible together                        |
| No JSON file migration                      | AI-inferred from schema       | `.optional().default(null)` handles existing rooms transparently                       |
| Enforcement header in context section       | User confirmed (Turn 4)       | Explicit imperative directives prevent LLM from treating context as passive background |
| Fix CORE_DOCTRINE conflict                  | AI-recommended, user approved | Narrow the "local context only" rule so it doesn't override `## Room Context` guidance |

---

## Open Risks

None unconfirmed. All major decisions have been locked by user.

---

## Future Scope / Deferred Features

The following items were discussed but confirmed **out of scope** for this feature:

- **User-managed template CRUD** — global template library with create/edit/delete via UI
- **Per-room custom templates** — templates saved and reused within a single room
- **Context versioning** — history of context changes per room
- **Token counting validation** — actual token count enforcement beyond character limit
