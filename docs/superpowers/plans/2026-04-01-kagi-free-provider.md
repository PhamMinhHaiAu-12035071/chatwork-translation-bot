# Kagi Free Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Kagi-backed Free Rooms with the same structure-preserving message flow and keyword-handling guarantees as Standard Rooms, while keeping Standard behavior backward-compatible.

**Architecture:** Keep Standard and Free configuration stores separate, but route both room types through a shared translator-local orchestration service. The orchestration owns skip rules, keyword masking/restoration, segment validation, delivery, output writing, and dataset ACK behavior; backend adapters own only provider-specific translation execution. The Free adapter batches all masked segments into one Kagi request per message in the happy path, while the Kagi sidecar serializes browser traffic with pacing and bounded retries.

**Tech Stack:** Bun · TypeScript strict · Elysia · Zod v4 · React Hook Form · Zustand · Puppeteer Real Browser · Docker Compose

---

## Task 1: kagi-sidecar — URL builder and package scaffold

**Files:**

- Create: `packages/kagi-sidecar/package.json`
- Create: `packages/kagi-sidecar/tsconfig.json`
- Create: `packages/kagi-sidecar/src/url-builder.ts`
- Test: `packages/kagi-sidecar/src/url-builder.test.ts`

**Step 1: Write the failing test**

Create `packages/kagi-sidecar/src/url-builder.test.ts` with coverage for:

- `Clear` adds `from`, `to`, `text`, and `preserveFormatting=true`
- `Wild` adds `formality=more`, `formality_context=vi_casual`, `language_complexity=c2`
- `True` adds `style=literal`, `language_complexity=b2`
- `context` is appended only when trimmed non-empty

Include assertions like:

```typescript
expect(buildKagiUrl('Hello', 'Wild')).toContain('formality_context=vi_casual')
expect(buildKagiUrl('Hello', 'Clear')).not.toContain('context')
expect(buildKagiUrl('Hello', 'Clear', 'software team')).toContain('context=')
expect(buildKagiUrl('Hello', 'Clear')).toContain('preserveFormatting=true')
```

**Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/kagi-sidecar && bun test src/url-builder.test.ts
```

Expected: FAIL with missing module or missing export.

**Step 3: Add package scaffolding**

Create `package.json` and `tsconfig.json` using the same monorepo conventions as
other internal packages.

**Step 4: Implement the minimal URL builder**

Create `packages/kagi-sidecar/src/url-builder.ts` with:

```typescript
export const KAGI_STYLE_VALUES = [
  'Wild',
  'Warm',
  'Easy',
  'Clear',
  'Smart',
  'Deep',
  'Fine',
  'Polite',
  'Elegant',
  'True',
  'Precise',
  'Exact',
] as const
export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string
```

Implementation requirements:

- always `from=auto`
- always `to=vi`
- always `text=<input>`
- always `preserveFormatting=true`

> **DEPRECATED (2026-04-09):** This requirement was removed to improve translation quality.
> See `../specs/2026-04-09-remove-preserve-formatting-design.md`.

- add Kagi style params only when needed
- trim `context`
- omit empty `context`

**Step 5: Run the test again**

Run:

```bash
cd packages/kagi-sidecar && bun test src/url-builder.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/kagi-sidecar/
git commit -m "feat(kagi): scaffold sidecar url builder"
```

---

## Task 2: kagi-sidecar — browser translation server

**Files:**

- Create: `packages/kagi-sidecar/src/browser-service.ts`
- Create: `packages/kagi-sidecar/src/server.ts`
- Create: `packages/kagi-sidecar/src/index.ts`

**Step 1: Write a narrow server contract in comments and route tests first if practical**

At minimum codify this contract in code comments and route validation:

```json
POST /translate
{ "text": "Hello", "style": "Clear", "context": "software team" }

200
{ "translated": "Xin chào" }
```

**Step 2: Implement `browser-service.ts`**

Create a service that:

- lazily launches Puppeteer Real Browser
- keeps a warm browser and warm page alive while healthy
- builds the Kagi URL with `buildKagiUrl()`
- loads the page
- scrapes the translated result
- intercepts and aborts clearly unnecessary requests where safe, such as images,
  fonts, and media
- serializes translation requests so only one browser translation runs at a time
- rejects requests when queue depth or queue wait exceeds configured budgets
- enforces a minimum delay between Kagi requests
- retries retryable failures with bounded backoff and jitter
- detects likely anti-abuse/captcha states and surfaces a typed failure
- resets browser state if the page crashes or translation fails
- assumes anonymous best-effort operation by default; do not require login state

**Step 3: Implement `server.ts`**

Use Elysia with:

- `GET /health`
- `POST /translate`
- Zod-like body validation through Elysia types
- structured logging for request/error events
- structured fields for queue wait, attempt count, backoff, anti-abuse detection,
  and transport latency where practical
- clear non-2xx responses for anti-abuse/throttle situations
- typed non-2xx responses for oversized payload and backpressure rejection

**Step 4: Implement `index.ts`**

Start the server on `KAGI_PORT` defaulting to `3002`.

**Step 5: Run focused checks**

Run:

```bash
cd packages/kagi-sidecar && bun run typecheck
cd packages/kagi-sidecar && bun test
```

Expected: typecheck passes; tests for URL builder still pass.

**Step 6: Commit**

```bash
git add packages/kagi-sidecar/src/
git commit -m "feat(kagi): add sidecar translation server"
```

---

## Task 3: provider-kagi — HTTP client adapter

**Files:**

- Create: `packages/provider-kagi/package.json`
- Create: `packages/provider-kagi/tsconfig.json`
- Create: `packages/provider-kagi/src/types.ts`
- Create: `packages/provider-kagi/src/kagi-client.ts`
- Create: `packages/provider-kagi/src/index.ts`
- Test: `packages/provider-kagi/src/kagi-client.test.ts`

**Step 1: Write the failing test**

Create tests covering:

- successful `translate()`
- trailing slash normalization
- request body contains `text`, `style`, `context`
- non-OK response throws `KagiClientError`
- network failure throws `KagiClientError`
- typed error payloads round-trip useful codes/messages

**Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/provider-kagi && bun test src/kagi-client.test.ts
```

Expected: FAIL because the client does not exist yet.

**Step 3: Implement the client**

Create:

```typescript
export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslateResponse {
  translated: string
}

export class KagiClient {
  async translate(request: KagiTranslateRequest): Promise<KagiTranslateResponse>
}
```

Behavior requirements:

- POST to `/translate`
- JSON request body
- normalize trailing slash on `baseUrl`
- wrap failures in `KagiClientError`

**Step 4: Run the tests**

Run:

```bash
cd packages/provider-kagi && bun test src/kagi-client.test.ts
cd packages/provider-kagi && bun run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/provider-kagi/
git commit -m "feat(kagi): add provider-kagi client"
```

---

## Task 4: translator — Free Room config model and CRUD store

**Files:**

- Create: `packages/translator/src/types/free-room-config.ts`
- Create: `packages/translator/src/services/free-room-config-store.ts`
- Test: `packages/translator/src/services/free-room-config-store.test.ts`

**Step 1: Write the failing store test**

Cover:

- empty store initialization
- create/read/update/delete
- `setEnabled()`
- duplicate `originalRoomId` inside the free store
- atomic persistence + reload from disk

**Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/translator && bun test src/services/free-room-config-store.test.ts
```

Expected: FAIL because the store does not exist yet.

**Step 3: Implement `free-room-config.ts`**

Mirror Standard Room routing fields as closely as possible:

```typescript
export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
```

Also add:

- `CreateFreeRoomRequestSchema`
- `UpdateFreeRoomRequestSchema`
- `FreeRoomConfigFileSchema`

**Step 4: Implement `free-room-config-store.ts`**

Use the same persistence model as `RoomConfigStore`:

- file path `free-room-configs.json`
- in-memory dual index by `id` and `originalRoomId`
- mutex
- atomic write via temp file + rename

**Step 5: Run the tests**

Run:

```bash
cd packages/translator && bun test src/services/free-room-config-store.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/translator/src/types/free-room-config.ts \
        packages/translator/src/services/free-room-config-store.ts \
        packages/translator/src/services/free-room-config-store.test.ts
git commit -m "feat(translator): add free room config store"
```

---

## Task 5: translator — shared backend abstraction and shared orchestration

**Files:**

- Create: `packages/translator/src/services/translation-backend.ts`
- Create: `packages/translator/src/services/message-structure.ts`
- Create: `packages/translator/src/services/room-translation-orchestrator.ts`
- Test: `packages/translator/src/services/room-translation-orchestrator.test.ts`
- Modify: `packages/chatwork/src/services/compose-translated-message-pair.ts`
- Modify: `packages/chatwork/src/services/compose-translated-message-pair.test.ts`
- Modify: `packages/translator/src/services/chatwork-sender.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`

**Step 1: Write the failing orchestrator test**

Cover these invariants:

- skips disabled room
- skips effectively empty input unless literal structure exists
- masks `cleanText` and every `translationInputs[]` element
- restores placeholders on `translatedText` and every `translatedSegments[]`
- throws on segment-count mismatch
- calls the shared delivery path with restored segments
- fails closed when composed output cannot preserve the original structure
- does not deliver any translated body when format integrity validation fails
- completes all format validation before the first outbound Chatwork send

Use assertions like:

```typescript
expect(backend.translate).toHaveBeenCalledWith(
  expect.objectContaining({
    cleanText: expect.any(String),
    translationInputs: ['Hello [COMPANY_1]'],
  }),
)

expect(sendTranslatedMessage).toHaveBeenCalledWith(
  expect.anything(),
  expect.anything(),
  expect.objectContaining({
    translatedSegments: ['Xin chao AcmeCorp'],
  }),
)
```

**Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/translator && bun test src/services/room-translation-orchestrator.test.ts
```

Expected: FAIL because the orchestrator does not exist yet.

**Step 3: Implement the backend interface**

Create `translation-backend.ts` with:

```typescript
export interface RoomTranslationBackend<TRuntimeConfig = unknown> {
  readonly kind: 'standard' | 'free'
  translate(input: {
    cleanText: string
    translationInputs: string[]
    roomContext?: string
    keywordSystemHint?: string
    runtimeConfig: TRuntimeConfig
    phaseObserver?: unknown
  }): Promise<{
    sourceLang: string
    translatedText: string
    translatedSegments: string[]
    debug?: unknown
  }>
}
```

**Step 4: Extract shared empty-structure logic**

Move `hasMeaningfulLiteralStructure()` and its helper types out of
`webhook/handler.ts` into `services/message-structure.ts` so Standard and Free
can share the exact same skip logic.

**Step 5: Implement `room-translation-orchestrator.ts`**

This service should own:

- empty/disabled checks
- context trimming
- keyword masking on `cleanText` and `translationInputs`
- backend invocation
- segment-count validation
- keyword restoration on `translatedText` and `translatedSegments`
- output writing
- shared delivery call
- dataset ACK behavior

Keep the interface backend-agnostic.

**Step 6: Add format-integrity validation to the delivery path**

Update `composeTranslatedMessagePair()` and related tests so that:

- the composed body is validated against the original structure before delivery
- unexpected structure changes caused by translated literal content are treated as
  errors
- `sendTranslatedMessage()` reports failure instead of sending malformed output
- metadata send does not start when format validation has already failed

Prefer a structure-signature comparison over fragile string heuristics.

**Step 7: Refactor Standard handler to delegate**

Modify `packages/translator/src/webhook/handler.ts` so it becomes a thin
Standard Room resolver that builds runtime config and calls the orchestrator.
Preserve current public exports and keep existing tests useful.

**Step 8: Run focused translator tests**

Run:

```bash
cd packages/translator && bun test src/services/room-translation-orchestrator.test.ts
cd packages/translator && bun test src/webhook/handler.test.ts
cd packages/translator && bun test src/services/chatwork-sender.test.ts
```

Expected: PASS with Standard behavior unchanged.

**Step 9: Commit**

```bash
git add packages/translator/src/services/translation-backend.ts \
        packages/translator/src/services/message-structure.ts \
        packages/translator/src/services/room-translation-orchestrator.ts \
        packages/translator/src/services/room-translation-orchestrator.test.ts \
        packages/chatwork/src/services/compose-translated-message-pair.ts \
        packages/chatwork/src/services/compose-translated-message-pair.test.ts \
        packages/translator/src/services/chatwork-sender.test.ts \
        packages/translator/src/webhook/handler.ts
git commit -m "refactor(translator): add shared room translation orchestration"
```

---

## Task 6: translator — Standard backend adapter

**Files:**

- Create: `packages/translator/src/services/standard-translation-backend.ts`
- Test: `packages/translator/src/services/standard-translation-backend.test.ts`

**Step 1: Write the failing adapter test**

Cover:

- provider plugin resolution
- pipeline receives `translationInputs[]`
- `translationStyle`, `roomContext`, `keywordSystemHint` reach the pipeline
- returned `translatedSegments[]` length matches pipeline output

**Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/translator && bun test src/services/standard-translation-backend.test.ts
```

Expected: FAIL because the adapter does not exist yet.

**Step 3: Implement the adapter**

Wrap the current Standard-only logic:

- decrypt API token
- resolve provider plugin
- resolve model
- build `TranslationPipeline`
- return `{ sourceLang, translatedText, translatedSegments, debug }`

Do not move keyword masking into this adapter; that now belongs to the shared
orchestrator.

**Step 4: Run the tests**

Run:

```bash
cd packages/translator && bun test src/services/standard-translation-backend.test.ts
cd packages/translator && bun test src/webhook/handler.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/translator/src/services/standard-translation-backend.ts \
        packages/translator/src/services/standard-translation-backend.test.ts
git commit -m "feat(translator): add standard translation backend adapter"
```

---

## Task 7: translator — Free backend, free handler, free routes, and app wiring

**Files:**

- Create: `packages/translator/src/services/kagi-segment-codec.ts`
- Test: `packages/translator/src/services/kagi-segment-codec.test.ts`
- Create: `packages/translator/src/services/free-translation-backend.ts`
- Create: `packages/translator/src/routes/free-rooms.ts`
- Create: `packages/translator/src/routes/free-rooms.test.ts`
- Create: `packages/translator/src/webhook/free-handler.ts`
- Create: `packages/translator/src/webhook/free-handler.test.ts`
- Modify: `packages/translator/src/webhook/router.ts`
- Modify: `packages/translator/src/app.ts`
- Modify: `packages/translator/src/server.ts`
- Modify: `packages/translator/src/index.ts`
- Modify: `packages/translator/src/env-schema.ts`
- Modify: `packages/translator/package.json`

**Step 1: Write the failing Free backend and handler tests**

Cover:

- segment codec round-trips ordered segments through deterministic UUID-scoped
  markers
- Free backend makes one `KagiClient.translate()` call for a multi-segment message
- Free backend returns `translatedSegments[]` with the same length as input
- Free backend fails when marker decoding cannot recover the same segment count
- Free backend fails when decoded output still contains reserved marker residue
- Free backend regenerates the message token if the generated marker collides
  with source text
- Free backend fails fast on oversized payload or segment-count overflow
- Free backend preserves emoji and mixed-language content through encode/decode
- Free handler resolves room from the free store
- Free handler delegates to the shared orchestrator
- router dispatches both Standard and Free handlers for the same webhook
- Free handler failure does not block Standard handler dispatch for the same webhook

**Step 2: Run the tests to verify they fail**

Run:

```bash
cd packages/translator && bun test src/webhook/free-handler.test.ts
cd packages/translator && bun test src/webhook/router.test.ts
```

Expected: FAIL because the free path does not exist yet.

**Step 3: Implement the segment codec and `free-translation-backend.ts`**

Rules:

- input is already masked by the orchestrator
- encode all `translationInputs[]` into one UUID-scoped marker-based payload
- call `KagiClient.translate()` once per message in the happy path
- use the same trimmed `roomContext` for that single request
- decode the translated payload back into ordered segments
- do not add a per-segment fallback path
- throw a typed failure when decode/marker-integrity validation fails
- fail fast before transport when encoded payload exceeds configured size limits
- return:

```typescript
{
  sourceLang: 'auto',
  translatedText: translatedSegments.join('\n'),
  translatedSegments,
}
```

Marker requirements:

- deterministic ASCII-only markers
- low probability of natural translation collisions via per-message UUID token
- parser must validate exact segment count recovery

Suggested shape:

```text
[[CW_SEG_<uuid>_0001]]
Agenda
[[/CW_SEG_<uuid>_0001]]
```

**Step 4: Implement Free Room CRUD routes**

Create `/api/free-rooms` routes mirroring Standard route style:

- `GET /api/free-rooms`
- `GET /api/free-rooms/:id`
- `POST /api/free-rooms`
- `PUT /api/free-rooms/:id`
- `DELETE /api/free-rooms/:id`
- `POST /api/free-rooms/:id/enable`
- `POST /api/free-rooms/:id/disable`

Destination room creation/rename/delete should reuse the same Chatwork service
pattern as Standard routes.

**Step 5: Implement `free-handler.ts`**

Keep it thin:

- resolve free room config by `sourceRoomId`
- build free runtime config
- call shared orchestrator with `FreeTranslationBackend`

Do not duplicate keyword, output, or delivery logic here.

**Step 6: Wire router and startup**

Modify:

- `router.ts` to dispatch both handlers
- `app.ts` and `server.ts` to mount free routes
- `index.ts` to initialize:
  - `FreeRoomConfigStore`
  - `KagiClient`
  - `FreeTranslationBackend`
  - `initFreeTranslateHandler()`
- `env-schema.ts` to add `KAGI_TRANSLATOR_URL`
- `package.json` to add `@chatwork-bot/provider-kagi`

Do not push pacing logic into the orchestrator; keep it inside Kagi-facing code.
Ensure router dispatch keeps Standard and Free failures isolated from one another.

**Step 7: Run the translator suite**

Run:

```bash
cd packages/translator && bun test
cd packages/translator && bun run typecheck
```

Expected: PASS with existing Standard tests still green.

**Step 8: Commit**

```bash
git add packages/translator/src/services/free-translation-backend.ts \
        packages/translator/src/services/kagi-segment-codec.ts \
        packages/translator/src/services/kagi-segment-codec.test.ts \
        packages/translator/src/routes/free-rooms.ts \
        packages/translator/src/routes/free-rooms.test.ts \
        packages/translator/src/webhook/free-handler.ts \
        packages/translator/src/webhook/free-handler.test.ts \
        packages/translator/src/webhook/router.ts \
        packages/translator/src/app.ts \
        packages/translator/src/server.ts \
        packages/translator/src/index.ts \
        packages/translator/src/env-schema.ts \
        packages/translator/package.json
git commit -m "feat(translator): add free room backend and routing"
```

---

## Task 8: dashboard — shared form primitives for UI parity

**Files:**

- Modify: `packages/dashboard/src/components/molecules/context-field.tsx`
- Modify: `packages/dashboard/src/components/molecules/context-field.test.tsx`
- Modify: `packages/dashboard/src/components/molecules/keyword-protection-field.tsx`
- Modify: `packages/dashboard/src/components/atoms/brutal-select.tsx`
- Modify: `packages/dashboard/src/components/atoms/brutal-select.test.tsx`

**Step 1: Write the failing component tests**

Add tests for:

- `ContextField` honors custom `maxLength`
- `ContextField` renders a configurable note string
- `BrutalSelect` does not open or react when `disabled`
- `KeywordProtectionField` accepts shared structural keyword value props without
  depending on Standard-only schema imports

**Step 2: Run the tests to verify they fail**

Run:

```bash
cd packages/dashboard && bun test src/components/molecules/context-field.test.tsx
cd packages/dashboard && bun test src/components/atoms/brutal-select.test.tsx
```

Expected: FAIL because the shared props do not exist yet.

**Step 3: Implement the shared component adjustments**

Apply these changes:

- `ContextField` props become:

```typescript
interface ContextFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
  maxLength?: number
  note?: string
}
```

- `KeywordProtectionField` uses a shared structural type instead of importing
  Standard-only `KeywordEntryFormInput`
- `BrutalSelect` honors `disabled` both visually and behaviorally

**Step 4: Run the component tests**

Run:

```bash
cd packages/dashboard && bun test src/components/molecules/context-field.test.tsx
cd packages/dashboard && bun test src/components/atoms/brutal-select.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/dashboard/src/components/molecules/context-field.tsx \
        packages/dashboard/src/components/molecules/context-field.test.tsx \
        packages/dashboard/src/components/molecules/keyword-protection-field.tsx \
        packages/dashboard/src/components/atoms/brutal-select.tsx \
        packages/dashboard/src/components/atoms/brutal-select.test.tsx
git commit -m "refactor(dashboard): share room form primitives"
```

---

## Task 9: dashboard — Free Room schemas, store, pages, and navigation

**Files:**

- Create: `packages/dashboard/src/lib/free-room-schemas.ts`
- Create: `packages/dashboard/src/lib/free-room-schemas.test.ts`
- Create: `packages/dashboard/src/lib/free-room-api.ts`
- Create: `packages/dashboard/src/stores/free-room-store.ts`
- Create: `packages/dashboard/src/pages/free-rooms.tsx`
- Create: `packages/dashboard/src/pages/free-room-create.tsx`
- Create: `packages/dashboard/src/pages/free-room-detail.tsx`
- Create: `packages/dashboard/src/pages/free-room-create.test.tsx`
- Create: `packages/dashboard/src/pages/free-room-detail.test.tsx`
- Modify: `packages/dashboard/src/router.tsx`
- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

**Step 1: Write the failing schema and page tests**

Cover:

- create/edit schema validation
- create page shows a disabled Free provider and no API token field
- detail page uses the same `ContextField` and `KeywordProtectionField`
- router exposes `/free-rooms`, `/free-rooms/new`, `/free-rooms/:id`
- sidebar shows Free navigation entries

**Step 2: Run the tests to verify they fail**

Run:

```bash
cd packages/dashboard && bun test src/lib/free-room-schemas.test.ts
cd packages/dashboard && bun test src/pages/free-room-create.test.tsx
cd packages/dashboard && bun test src/pages/free-room-detail.test.tsx
```

Expected: FAIL because the free dashboard surface does not exist yet.

**Step 3: Implement schemas and API client**

Create:

- `free-room-schemas.ts`
- `free-room-api.ts`
- `free-room-store.ts`

Route contract must mirror Standard data access patterns closely:

- list
- get
- create
- update
- delete
- enable
- disable

**Step 4: Implement the Free pages**

UI rules:

- same section order as Standard create/detail pages
- same page shell/card language
- same toast semantics
- same optimistic enable/disable behavior
- provider fixed to "Free" and disabled
- no API token input
- context uses `maxLength={100}`

**Step 5: Wire router and sidebar**

Add:

- `/free-rooms`
- `/free-rooms/new`
- `/free-rooms/:id`

Navigation copy should clearly separate Standard and Free sections while keeping
the same dashboard tone.

**Step 6: Run the dashboard suite**

Run:

```bash
cd packages/dashboard && bun test
cd packages/dashboard && bun run typecheck
```

Expected: PASS with old Standard page tests still green.

**Step 7: Commit**

```bash
git add packages/dashboard/src/lib/free-room-schemas.ts \
        packages/dashboard/src/lib/free-room-schemas.test.ts \
        packages/dashboard/src/lib/free-room-api.ts \
        packages/dashboard/src/stores/free-room-store.ts \
        packages/dashboard/src/pages/free-rooms.tsx \
        packages/dashboard/src/pages/free-room-create.tsx \
        packages/dashboard/src/pages/free-room-detail.tsx \
        packages/dashboard/src/pages/free-room-create.test.tsx \
        packages/dashboard/src/pages/free-room-detail.test.tsx \
        packages/dashboard/src/router.tsx \
        packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): add free room management UI"
```

---

## Task 10: infrastructure and final verification

**Files:**

- Create: `Dockerfile.kagi`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `.env.example` or relevant env docs if present
- Modify: `packages/translator/src/app.test.ts` or integration tests if needed

**Step 1: Add container wiring**

Create `Dockerfile.kagi` and add `kagi-translator` to compose files.

Add sidecar envs for transport safety, for example:

- `KAGI_PORT=3002`
- `KAGI_MIN_INTERVAL_MS`
- `KAGI_MAX_RETRIES`
- `KAGI_RETRY_BASE_MS`
- `KAGI_REQUEST_TIMEOUT_MS`
- `KAGI_MAX_QUEUE_DEPTH`
- `KAGI_MAX_QUEUE_WAIT_MS`
- `KAGI_MAX_ENCODED_PAYLOAD_CHARS`
- `KAGI_MAX_SEGMENT_COUNT`

No Kagi account/session env should be required for the baseline design.

**Step 2: Verify health and local wiring**

Check that:

- `KAGI_TRANSLATOR_URL` points to `http://kagi-translator:3002`
- the sidecar exposes `GET /health`
- the sidecar enforces serialized request handling
- the sidecar rejects backlog overflow with typed errors
- translator starts with both Standard and Free room APIs mounted
- Free-side startup/config issues do not alter Standard route mounting

**Step 3: Run full repo verification**

Run:

```bash
bun test
bun run typecheck
bun run lint
```

Expected: all commands pass.

**Step 4: Smoke-check the user-critical scenarios**

Manually verify:

- one Standard room + one Free room can share the same `originalRoomId`
- Standard room still behaves exactly as before
- Free room preserves quote/hr/reply structure
- Free room keyword masking/restoration matches Standard behavior
- Free room performs one Kagi translation request per message in the happy path
- Free room does not deliver output when marker decode or structure validation
  fails
- Free room does not start metadata/body delivery when format validation fails
- Free anti-abuse/throttle failures produce detailed structured logs
- Free failure does not stop Standard delivery for the same webhook
- oversized or over-segmented Free payloads fail fast with detailed typed errors
- logs omit raw source/translated text by default while still including hashes,
  counts, timings, and failure stage fields
- mixed-language and emoji-heavy inputs still round-trip correctly through codec
- dashboard Free pages feel close to Standard pages

**Step 5: Commit**

```bash
git add Dockerfile.kagi docker-compose.yml docker-compose.dev.yml .env.example
git commit -m "chore(infra): wire kagi sidecar into local runtime"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-01-kagi-free-provider.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
