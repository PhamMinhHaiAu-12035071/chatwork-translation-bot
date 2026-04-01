# Kagi Free Provider Integration — Design Spec

**Version:** 1.0  
**Date:** 2026-04-01  
**Prepared by:** AI-assisted (Claude Sonnet 4.6)  
**Status:** Approved — ready for implementation planning

---

## Objective

Integrate Kagi FastTranslate as a "Free" translation provider into the chatwork-translation-bot monorepo. Users can create "Free Rooms" that translate Chatwork messages via Kagi's web interface — no API key required. The integration must be completely isolated from the existing LLM-based provider system (OpenAI/Gemini) with zero breaking changes.

## Scope

- New `kagi-sidecar` package: Bun HTTP server + Puppeteer Real Browser that wraps Kagi translate
- New `provider-kagi` package: HTTP client that translator uses to call the sidecar
- New `FreeRoomConfig` data model + `FreeRoomConfigStore` in the translator package
- New `handleFreeTranslateRequest()` handler (parallel to existing handler, no modification to existing)
- New Dashboard pages: Free Rooms list, Create Free Room, Edit Free Room
- New sidebar section in dashboard (separate from existing Rooms section)
- New `Dockerfile.kagi` + `kagi-translator` service in docker-compose files
- Keyword masking/restoration and context field supported for Free Rooms

## Non-Goals

- Modifying any existing provider (openai, gemini, cursor)
- Modifying `handleTranslateRequest()`, `RoomConfigStore`, or `RoomConfig`
- Exposing speaker/addressee gender params in the UI (baked into style presets)
- Production deployment of Kagi sidecar (initially docker-compose only; production Dockerfile included but Chrome infra is user's responsibility)
- Supporting source/target language selection (always `from=auto&to=vi`)

## Definition of Done

- `bun test && bun run typecheck && bun run lint` passes
- Free Rooms CRUD works end-to-end in docker-compose.dev.yml
- Existing rooms still work unchanged (regression test)
- Kagi sidecar translates text via Puppeteer and returns result
- Docker logs distinguish `roomType: 'free'` vs `'standard'`

---

## Architecture

### Data Flow

```
Chatwork Webhook
    ↓
webhook-logger  POST /internal/translate  →  translator
    ↓
translateRoutes — parallel dispatch (3 lines added to router.ts):
    ├─► handleTranslateRequest()          ← UNCHANGED (openai/gemini)
    └─► handleFreeTranslateRequest()      ← NEW, fully isolated
              ↓
              FreeRoomConfigStore.getByOriginalRoomId()
              ↓  (if found + enabled)
              maskKeywords()              ← shared utility, unchanged
              ↓
              HTTP POST kagi-translator:3002/translate
              ↓
              restoreKeywords()           ← shared utility, unchanged
              ↓
              sendTranslatedMessage()     ← shared delivery, unchanged
```

### New Packages & Files

```
packages/
  provider-kagi/              ← NEW package
    src/
      index.ts                  barrel export
      kagi-client.ts            HTTP client → kagi-translator:3002
      kagi-style.ts             KagiStyle → URL params mapping
      types.ts                  KagiStyle enum, request/response types

  kagi-sidecar/               ← NEW package
    src/
      index.ts                  entry point (Bun.serve)
      server.ts                 POST /translate + GET /health routes
      browser-service.ts        Puppeteer Real Browser orchestration
      url-builder.ts            builds translate.kagi.com URL (ported + extended from nghien_cuu_cua_toi)

packages/translator/src/
  types/
    + free-room-config.ts       FreeRoomConfig schema + request schemas (NEW)
  services/
    + free-room-config-store.ts FreeRoomConfigStore (NEW, mirrors RoomConfigStore without encryption)
  webhook/
    + free-handler.ts           handleFreeTranslateRequest() (NEW)
    ~ router.ts                 +2 lines: import + void handleFreeTranslateRequest()
  ~ index.ts                    init FreeRoomConfigStore on startup

packages/dashboard/src/
  pages/
    + free-rooms.tsx            Free Rooms list page
    + free-room-create.tsx      Create Free Room form
    + free-room-detail.tsx      Edit Free Room form
  lib/
    + free-room-schemas.ts      Zod schemas for dashboard forms
    + free-room-api.ts          API client functions for /api/free-rooms
  components/layout/
    ~ sidebar.tsx               +divider + "Free Rooms" + "Create Free Room" items
```

---

## Data Model

### FreeRoomConfig

```typescript
// packages/translator/src/types/free-room-config.ts

export const KAGI_STYLE_VALUES = [
  'Wild', // natural + vi_casual  + c2  — unfiltered, most colloquial
  'Easy', // natural + vi_casual  + b2  — everyday casual
  'Clear', // natural + standard   + standard — neutral default
  'Smart', // natural + vi_formal  + b2  — professional accessible
  'Fine', // natural + vi_formal  + c1  — high-register formal
  'True', // literal + standard   + b2  — literal, precise
] as const
export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

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
  // NOTE: no encryptedAiApiToken — Kagi requires no API key
})

export const FreeRoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(FreeRoomConfigSchema),
})

export const CreateFreeRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1).max(128),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  // NOTE: destinationRoomId is NOT in the API request body.
  // It is resolved at the route layer (same pattern as CreateRoom route).
  // Implementer: follow how the existing POST /api/rooms route derives destinationRoomId.
})

export const UpdateFreeRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).optional(),
  context: z.string().max(100).nullable().optional(),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})
```

### Storage

```
data/
  room-configs.json           ← existing, UNCHANGED
  free-room-configs.json      ← NEW, same { version: 1, rooms: [...] } format
```

`FreeRoomConfigStore` mirrors `RoomConfigStore` exactly (same mutex, atomic write, dual-Map indexing) minus all encryption methods. Constructor signature: `{ dataDir: string }` — no `encryptionKeyHex`.

### Schema diff: RoomConfig vs FreeRoomConfig

| Field                                                      | RoomConfig      | FreeRoomConfig  |
| ---------------------------------------------------------- | --------------- | --------------- |
| id, originalRoomId, destinationRoomId, destinationRoomName | ✓               | ✓               |
| aiProvider / aiModel                                       | ✓               | ✗               |
| translationStyle (LLM 3-style)                             | ✓               | ✗               |
| kagiStyle (6 presets)                                      | ✗               | ✓               |
| encryptedAiApiToken                                        | ✓ required      | ✗ not present   |
| context                                                    | ✓ max 500 chars | ✓ max 100 chars |
| protectedKeywords                                          | ✓ max 50        | ✓ max 50        |
| enabled, createdAt, updatedAt                              | ✓               | ✓               |

---

## KagiStyle → URL Parameters Mapping

```typescript
// packages/provider-kagi/src/kagi-style.ts

export const KAGI_STYLE_PARAMS: Record<KagiStyle, KagiTranslationOptions> = {
  Wild: { style: 'natural', formality: 'vietnamese_casual', readingLevel: 'c2' },
  Easy: { style: 'natural', formality: 'vietnamese_casual', readingLevel: 'b2' },
  Clear: { style: 'natural', formality: 'standard', readingLevel: 'standard' },
  Smart: { style: 'natural', formality: 'vietnamese_formal', readingLevel: 'b2' },
  Fine: { style: 'natural', formality: 'vietnamese_formal', readingLevel: 'c1' },
  True: { style: 'literal', formality: 'standard', readingLevel: 'b2' },
}

// URL builder produces: https://translate.kagi.com/?from=auto&to=vi&text=<text>
//   + &language_complexity=<level>     (if !== 'standard')
//   + &style=literal                   (if style === 'literal')
//   + &formality=more&formality_context=vi_casual   (if formality === 'vietnamese_casual')
//   + &formality=more&formality_context=vi_formal   (if formality === 'vietnamese_formal')
//   + &context=<text>                  (if context provided, max 100 chars)
//
// speakerGender and addresseeGender always default to 'unknown' (omitted from URL)
```

**Note:** `nghien_cuu_cua_toi/src/config/translation.config.ts` is missing `context` param support. The `url-builder.ts` in `kagi-sidecar` must add `?context=<text>` when context is provided — this is a known gap in the research prototype.

---

## Kagi Sidecar Service

### HTTP API

```
POST /translate
Content-Type: application/json
{ "text": "Hello world", "style": "Clear", "context": "software team" }

200 OK
{ "translated": "Xin chào thế giới" }

GET /health → 200 OK { "status": "ok" }
```

Port: `3002` (env: `KAGI_PORT`, default 3002).

### Implementation (kagi-sidecar)

Ported and extended from `nghien_cuu_cua_toi/src/`:

- `KagiBrowserService` — Puppeteer Real Browser, singleton per process, lazy `launch()` on first request
- `KagiUrlBuilder` — builds Kagi translate URL from text + style params + context
- `server.ts` — Bun.serve() with logixlysia request logging (`service: 'kagi-sidecar'`)
- Startup: launches browser once, keeps connection alive across requests

### Error Handling

| Condition                  | Response                                     |
| -------------------------- | -------------------------------------------- |
| Browser launch fails       | 503 + JSON error, log `level: 'error'`       |
| Translation timeout (30s)  | 504 + JSON error                             |
| Scraping returns no result | 500 + JSON error with raw HTML for debugging |
| Invalid `style` enum       | 400 + Zod validation error                   |

---

## Backend: Translator Changes

### router.ts (3 lines added, nothing removed)

```typescript
// existing line (unchanged):
void handleTranslateRequest(body.command, { traceId }).catch(...)

// NEW — parallel dispatch for free rooms:
void handleFreeTranslateRequest(body.command, { traceId, freeRoomStore, kagiUrl }).catch(...)
```

### free-handler.ts (new file)

```typescript
export async function handleFreeTranslateRequest(
  command: TranslationIngressCommand,
  deps: {
    traceId: string
    freeRoomStore: FreeRoomConfigStore
    kagiClient: KagiClient
    chatworkApiToken: string
  },
): Promise<void> {
  const room = deps.freeRoomStore.getByOriginalRoomId(command.sourceRoomId)
  if (room === null) return
  if (!room.enabled) return

  log('info', { event: 'free_translation_ingress', traceId, roomType: 'free', roomId: room.id })

  const cleanText = extractCleanText(command)
  const keywords = room.protectedKeywords ?? []
  const { maskedText, restoreMap } = maskKeywords(cleanText, keywords)

  // Uses kagiClient from provider-kagi package (wraps fetch + error handling)
  // kagiClient is created once at startup and injected via deps (not per-request)
  const { translated } = await deps.kagiClient.translate({
    text: maskedText,
    style: room.kagiStyle,
    context: room.context ?? undefined,
  })
  const finalText = restoreKeywords(translated, restoreMap)

  await sendTranslatedMessage(command, finalText, {
    apiToken: deps.chatworkApiToken,
    destinationRoomId: room.destinationRoomId,
  })

  log('info', { event: 'free_translation_completed', traceId, roomType: 'free', roomId: room.id })
}
```

### index.ts additions

```typescript
// New env var
const kagiUrl = process.env.KAGI_TRANSLATOR_URL ?? 'http://kagi-translator:3002'

// New store (no encryption key needed)
const freeRoomStore = new FreeRoomConfigStore({ dataDir: env.DATA_DIR })
await freeRoomStore.init()
```

---

## Backend: API Routes (Dashboard ↔ Translator)

```
GET    /api/free-rooms           list all free rooms (FreeRoomConfig[])
POST   /api/free-rooms           create (CreateFreeRoomRequest → FreeRoomConfig)
GET    /api/free-rooms/:id       get one
PATCH  /api/free-rooms/:id       update (UpdateFreeRoomRequest)
DELETE /api/free-rooms/:id       delete
PATCH  /api/free-rooms/:id/enabled  toggle { enabled: boolean }
```

All routes use logixlysia request logging with `roomType: 'free'` context tag.
Response shape mirrors `/api/rooms` for consistency.

---

## Dashboard UI

### Routing

| Route             | Component              | Description          |
| ----------------- | ---------------------- | -------------------- |
| `/free-rooms`     | `free-rooms.tsx`       | List all free rooms  |
| `/free-rooms/new` | `free-room-create.tsx` | Create form          |
| `/free-rooms/:id` | `free-room-detail.tsx` | Edit + status toggle |

### Sidebar additions (sidebar.tsx)

```tsx
// After existing "Create Room" item:
<SidebarSeparator />
<SidebarLabel>Free</SidebarLabel>
<SidebarItem to="/free-rooms" icon={<FreeIcon />}>Free Rooms</SidebarItem>
<SidebarItem to="/free-rooms/new" icon={<PlusIcon />}>Create Free Room</SidebarItem>
```

### Create / Edit Free Room form fields

| Field                 | Type              | Notes                                                                 |
| --------------------- | ----------------- | --------------------------------------------------------------------- |
| Original Room ID      | number input      | same as Create Room                                                   |
| Destination Room Name | text input        | same as Create Room                                                   |
| Provider              | select (disabled) | single option "Free", subtitle "Powered by Kagi Translate"            |
| Translation Style     | select            | Wild / Easy / Clear / Smart / Fine / True (default: Clear)            |
| _(no API key field)_  | —                 | badge: "✓ No API key required — free to use"                          |
| Translation Context   | textarea          | max 100 chars + char counter, note "Sent to Kagi as translation hint" |
| Protected Keywords    | keyword field     | same component as Create Room (max 50)                                |

Form uses React Hook Form + Zod (`CreateFreeRoomRequestSchema`). Provider dropdown is `disabled` with a single option — not interactive.

---

## Docker

### Dockerfile.kagi (new)

```dockerfile
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app
# ... copy packages, bun install, bun build kagi-sidecar → dist/kagi.js

FROM zenika/alpine-chrome:with-node AS runtime
# zenika/alpine-chrome provides Chromium on Alpine
WORKDIR /app
COPY --from=builder /app/dist/kagi.js ./kagi.js
ENV NODE_ENV=production
ENV KAGI_PORT=3002
EXPOSE 3002
CMD ["node", "-e", "require('child_process').execFileSync('bun', ['run', 'kagi.js'], {stdio:'inherit'})"]
# NOTE: exact CMD depends on bun availability in zenika/alpine-chrome;
# alternative: install bun in runtime stage via curl
```

### docker-compose.yml (production — new service)

```yaml
kagi-translator:
  build:
    context: .
    dockerfile: Dockerfile.kagi
  env_file: [.env]
  ports: ['${KAGI_PORT:-3002}:3002']
  restart: unless-stopped
  networks: [chatwork-net]
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:3002/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

### docker-compose.dev.yml (dev — new service)

```yaml
kagi-translator:
  image: zenika/alpine-chrome:with-node
  dns: [1.1.1.1, 8.8.8.8]
  sysctls: [net.ipv6.conf.all.disable_ipv6=1]
  command: sh -c "npm install -g bun && bun install && bun --hot packages/kagi-sidecar/src/index.ts"
  working_dir: /app
  volumes: [.:/app, node_modules:/app/node_modules, bun_cache:/root/.bun/install/cache]
  environment:
    - HUSKY=0
    - BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache
  ports: ['${KAGI_PORT:-3002}:3002']
  tty: true
  networks: [chatwork-net]
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:3002/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
```

### New environment variable

```bash
# .env (add to existing)
KAGI_TRANSLATOR_URL=http://kagi-translator:3002   # internal service URL
KAGI_PORT=3002                                     # expose port
```

---

## Logging

All new code uses structured JSON logging consistent with the existing translator pattern:

```json
{ "level": "info",  "service": "translator",    "event": "free_translation_ingress",   "roomType": "free", "traceId": "..." }
{ "level": "info",  "service": "translator",    "event": "free_translation_completed", "roomType": "free", "traceId": "..." }
{ "level": "warn",  "service": "translator",    "event": "free_room_not_found",        "roomType": "free", "sourceRoomId": 123 }
{ "level": "error", "service": "translator",    "event": "free_translation_failed",    "roomType": "free", "traceId": "...", "error": "..." }
{ "level": "info",  "service": "kagi-sidecar",  "event": "translate_request",          "style": "Clear", "hasContext": true }
{ "level": "error", "service": "kagi-sidecar",  "event": "browser_error",              "operation": "translate", "error": "..." }
```

API routes in translator use `logixlysia` middleware (existing pattern). Kagi sidecar server also uses logixlysia for HTTP request logs.

---

## Acceptance Criteria

- [ ] Create Free Room → saved to `data/free-room-configs.json`, not `room-configs.json`
- [ ] Edit Free Room → updates file atomically (no corruption under concurrent writes)
- [ ] Chatwork message to a free-room-configured source room → triggers `handleFreeTranslateRequest`, NOT `handleTranslateRequest`
- [ ] Same source room ID with both regular + free room → both handlers run independently to their respective destination rooms
- [ ] Keyword masking: protected keywords are masked before sending to Kagi, restored in final message
- [ ] Context (≤ 100 chars): sent as `?context=` param to Kagi URL
- [ ] kagiStyle "Wild" → URL contains `formality=more&formality_context=vi_casual&language_complexity=c2`
- [ ] kagiStyle "True" → URL contains `style=literal&language_complexity=b2`
- [ ] kagiStyle "Clear" → URL has no extra params beyond `from=auto&to=vi&text=...`
- [ ] Docker logs show `roomType: 'free'` for all free translation events
- [ ] All existing regular room tests pass unchanged
- [ ] `bun test && bun run typecheck && bun run lint` green

## Happy Path

1. User opens dashboard → sees "Free Rooms" section in sidebar
2. Clicks "Create Free Room" → fills form (no API key field), selects style "Easy", saves
3. Config written to `data/free-room-configs.json`
4. Chatwork message arrives → webhook → translator dispatches to both handlers
5. `handleFreeTranslateRequest` matches room → masks keywords → calls kagi sidecar
6. Kagi sidecar builds URL → Puppeteer navigates → scrapes translation → returns
7. Keywords restored → message sent to destination Chatwork room

## Edge Cases

- Kagi sidecar down → `handleFreeTranslateRequest` logs error, does NOT affect regular translation
- Same `originalRoomId` in both stores → both handlers fire, deliver to respective destination rooms
- Context > 100 chars → Zod validation rejects at API layer (400)
- Kagi returns empty string → sidecar returns 500, handler logs error, no message sent
- `protectedKeywords` empty array or undefined → masking is no-op, safe

## Failure Cases

- Kagi service unavailable (site down, bot detection) → sidecar returns 503 → handler error log
- Puppeteer browser crash → sidecar attempts re-launch on next request (lazy init pattern)
- `free-room-configs.json` corrupted → `FreeRoomConfigStore.init()` throws `INVALID_CONFIG_FILE`, server startup fails with clear error

---

## Explicit Decisions

| #       | Decision                                                                                   | Provenance     |
| ------- | ------------------------------------------------------------------------------------------ | -------------- |
| DEC-001 | Kagi runs as sidecar service, not embedded in translator                                   | user-confirmed |
| DEC-002 | 6 translation style presets: Wild/Easy/Clear/Smart/Fine/True                               | user-confirmed |
| DEC-003 | Separate sidebar sections for Standard and Free rooms                                      | user-confirmed |
| DEC-004 | Context field supported (max 100 chars), maps to `?context=` Kagi URL param                | user-stated    |
| DEC-005 | Approach A: separate `handleFreeTranslateRequest()`, zero modification to existing handler | user-confirmed |
| DEC-006 | All API routes use logixlysia; logs include `roomType: 'free' \| 'standard'`               | user-stated    |
| DEC-007 | FreeRoomConfig: no API token, no LLM fields, separate Zod schema                           | user-confirmed |
| DEC-008 | Dashboard form: provider = "Free" (disabled), badge "No API key required"                  | user-confirmed |
| DEC-009 | 2 separate JSON files: `room-configs.json` + `free-room-configs.json`                      | user-confirmed |

## Open Risks

- **Kagi bot detection**: `puppeteer-real-browser` mitigates this but is not guaranteed. Kagi may tighten restrictions. No fallback currently designed.
- **zenika/alpine-chrome base image**: CMD for running bun in this image needs validation during implementation — bun installation approach in that image needs to be confirmed.
- **`nghien_cuu_cua_toi` prototype gaps**: The research code is missing `context` param. The `kagi-sidecar` URL builder must add this — verified requirement from user.
- **Translation quality**: Kagi accuracy vs LLM varies by domain. No quality guarantee.

## Out of Scope

- Speaker/addressee gender parameters exposed in UI
- Source/target language selector (always auto→vi)
- Post-processing Free Room translations with an LLM
- Cursor provider in Free Rooms
- Rate limiting or queuing for Kagi requests
- Archival/soft-delete for Free Rooms (delete is hard delete, same as current rooms)

## Future Scope / Deferred Features

_(Confirmed out of scope for this iteration — not estimated, not committed)_

- Gender params in Free Room UI
- Target language selection per Free Room
- LLM post-processing layer for Free Room output
- Free Room translation quality metrics / dataset-runner integration
