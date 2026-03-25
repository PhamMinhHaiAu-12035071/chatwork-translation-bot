# Dashboard Multi-Room Translation — Design Spec

**Version:** 1.2
**Date:** 2026-03-25
**Prepared by:** AI-assisted (Claude Code + user collaboration)
**Status:** Approved

---

## Objective

Build a web dashboard (`@chatwork-bot/dashboard`) for managing multi-room Chatwork translation configurations. Replace the current single-room, env-based setup with a dynamic, per-room configuration system backed by JSON file storage.

**Goal:** When a customer sends a message in their Chatwork project room, the system automatically translates it into a designated internal room so the development team (who may not read Japanese) can understand the customer's intent quickly.

## Definition of Done

A fully functional dashboard where a Tech Lead or BPM can:

1. Create a room translation config via a form (6 fields)
2. Follow an interactive webhook setup guide
3. Activate translation by pasting the Chatwork webhook token
4. See translations flowing from original room → destination room

Delivered across 7 incremental phases, each independently shippable and visually verifiable.

## Scope

### In Scope

- Multi-room config CRUD (create, read, update, delete)
- JSON file-based storage with AES-256-GCM encryption for secrets
- REST API in translator service (`/api/rooms/*`)
- React dashboard (separate package) served as static files by translator
- Interactive webhook setup guide with generated URLs
- Per-room AI provider, model, translation style, and API token
- Per-room webhook secret with HMAC signature verification
- Enable/disable toggle + hard delete with archive backup
- Backend refactor: room-specific settings from JSON (breaking change from .env)
- Neubrutalism + Glassmorphism design with candy scrollbar

### Out of Scope (Non-Goals)

- Authentication / authorization
- Real-time translation logs
- System Status & Activity Logs panel
- Auto-add members to destination room
- E2E testing (Playwright/Cypress)
- Vercel serverless deployment

## Constraints

- No auth — dashboard is open access (MVP)
- KISS / YAGNI — minimum viable features per phase
- 7 phases — each must be independently shippable and eye-verifiable
- Bun v1.1+ runtime — all packages must be Bun-compatible
- Existing test coverage must not regress; backend refactor requires >95% coverage

## Actors

| Actor               | Role              | Actions                                                               |
| ------------------- | ----------------- | --------------------------------------------------------------------- |
| Tech Lead / BPM     | Setup & configure | Create room configs, setup webhooks, manage AI settings               |
| Bot Account         | System            | Create destination rooms, send translated messages, call Chatwork API |
| Team Dev (internal) | Consumer          | Read translated messages in destination room                          |
| Chatwork Webhook    | External trigger  | Send POST requests when messages are created/updated                  |

---

## Architecture

### Package Structure

```
@chatwork-bot/dashboard           ← NEW: React SPA
  ├── src/
  │   ├── pages/          (Room List, Room Detail, Webhook Guide)
  │   ├── components/     (forms, cards, layout, UI primitives)
  │   ├── stores/         (Zustand stores)
  │   ├── hooks/          (custom React hooks)
  │   ├── lib/            (API client, validation schemas)
  │   └── styles/         (Tailwind config, global styles)
  └── dist/               (static build output → served by translator)

@chatwork-bot/translator          ← MODIFIED: adds API routes + static serving
  ├── src/routes/api/     (NEW: room config CRUD endpoints)
  ├── src/services/       (NEW: room-config-store, encryption-utils)
  └── data/               (NEW: room-configs.json, room-configs-archive.json)
```

### System Flow

```
[Chatwork Room] --webhook POST--> [webhook-logger:3001]
    |                                    |
    |  ?room_id=XXX                      | extract room_id from query param
    |                                    | call translator internal API to get per-room secret
    |                                    | verify signature (per-room secret)
    |                                    | normalize payload
    |                                    | forward to translator
    |                                    v
    |                             [translator:3000]
    |                                    |
    |                                    | lookup room config from JSON
    |                                    | load per-room: provider, model, style, token
    |                                    | run translation pipeline
    |                                    | send to destination room
    |                                    v
    |                             [Destination Room] <-- team reads translations
    |
    +-- [Dashboard SPA] ---------> [translator:3000/api/rooms/*]
         React + Vite                    |
         served as static files          | CRUD room configs
         by translator                   | create dest room on Chatwork
                                         | encrypt/decrypt secrets
                                         v
                                  [data/room-configs.json]
```

#### Webhook Secret Resolution (C2)

webhook-logger needs per-room webhook secrets for HMAC verification, but secrets are stored in translator's JSON. Solution:

1. translator exposes internal endpoint: `GET /internal/room-secret?room_id=XXX`
   - Returns `{ secret: string }` (decrypted webhook secret for that room)
   - Only accessible from internal network (webhook-logger → translator)
   - Returns 404 if room not found or disabled
2. webhook-logger extracts `room_id` from webhook URL query param
3. webhook-logger calls translator to fetch the decrypted secret
4. webhook-logger verifies HMAC with that secret, then forwards the normalized payload

This keeps room config ownership in translator and avoids duplicating the JSON store.

**Caching:** webhook-logger caches room secrets in-memory with 60-second TTL to avoid HTTP round-trip on every webhook. Cache is keyed by `room_id`. On cache miss or expiry, fetches from translator.

**Failure mode:** If translator's internal API is unreachable during a cache miss, webhook-logger returns 503 and logs the error. Cached secrets continue working during brief translator outages.

**Access control:** `/internal/*` endpoints are protected by a shared secret header (`X-Internal-Secret`) validated against `INTERNAL_API_SECRET` env var (shared between webhook-logger and translator). This prevents external access to decrypted secrets even if the port is accidentally exposed. In Docker Compose, both services share the same internal network and this secret is set via environment.

### API Contract

```
GET    /api/rooms              → List all room configs (secrets redacted)
GET    /api/rooms/:id          → Get single room config
POST   /api/rooms              → Create room config + create dest room on Chatwork
PUT    /api/rooms/:id          → Update room config
DELETE /api/rooms/:id          → Hard delete + archive to backup file

POST   /api/rooms/:id/enable   → Enable webhook listening
POST   /api/rooms/:id/disable  → Disable webhook listening

GET    /api/providers          → List available providers + models from registry

# Internal API (not exposed to dashboard, webhook-logger only)
GET    /internal/room-secret?room_id=XXX  → Decrypted webhook secret for HMAC verification
```

**GET /api/providers response:**

```typescript
{
  success: true,
  data: Array<{
    id: string              // e.g. 'openai', 'gemini'
    name: string            // e.g. 'OpenAI', 'Google Gemini'
    models: string[]        // e.g. ['gpt-4o', 'gpt-4o-mini']
    defaultModel: string    // e.g. 'gpt-4o'
  }>
}
```

**Note:** `cursor` provider is excluded from this endpoint — it is local-dev only and not available for room configuration.

**Response format:**

```typescript
{ success: boolean; data?: T; error?: string }
```

**Create flow (POST /api/rooms):**

1. Validate input (Zod schema)
2. Check `originalRoomId` uniqueness → 409 if duplicate
3. Warn if `destinationRoomName` matches existing (response includes warning)
4. Call Chatwork `POST /rooms` to create destination room → if fails, return error (atomic)
5. Encrypt `aiApiToken` with AES-256-GCM
6. Save config to JSON with `enabled: false`
7. Return config with generated webhook URL

**Room config resolution (translator handler):**
When translator receives a forwarded command from webhook-logger via `POST /internal/translate`:

1. Extract `sourceRoomId` from the `TranslationIngressCommand` DTO
2. Lookup `RoomConfig` where `originalRoomId === sourceRoomId` (O(1) via `Map<number, RoomConfig>` in memory)
3. If not found → log warning, return 404 (silent failure — webhook-logger already returned 200 to Chatwork)
4. If found but `enabled: false` → log info, return 200 (skip translation)
5. If found and enabled → decrypt per-room AI token, instantiate provider with per-room settings, run pipeline

**Note:** Room-not-found and room-disabled are silent failures visible only in translator logs, not surfaced to Chatwork. This matches the existing fire-and-forget pattern where webhook-logger returns 200 immediately.

**Prerequisite (C1):** `IChatworkApiClient` in `@chatwork-bot/chatwork` currently lacks a `createRoom` method. Must be added before Phase 4:

```typescript
// Add to IChatworkApiClient interface
createRoom(params: {
  name: string
  membersAdminIds: number[]  // required by Chatwork API
  description?: string
}, token: string): Promise<{ room_id: number }>
```

Bot account must have permission to create rooms. If bot lacks permission, the API returns an error and the create flow fails atomically (no config saved).

### Data Model

```typescript
interface RoomConfig {
  id: string // UUID v4
  originalRoomId: number // Chatwork room ID — UNIQUE KEY
  destinationRoomId: number // Created by system via Chatwork API
  destinationRoomName: string // User-provided name
  aiProvider: 'openai' | 'gemini'
  aiModel: string | null // null = provider default
  translationStyle: 'AUTO_CONTEXT' | 'NATURAL_CASUAL' | 'PROFESSIONAL_BUSINESS' | 'TECHNICAL'
  encryptedAiApiToken: string // AES-256-GCM encrypted
  encryptedWebhookSecret: string // AES-256-GCM encrypted
  enabled: boolean
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}
```

**File structure:**

```json
// data/room-configs.json
{ "version": 1, "rooms": RoomConfig[] }

// data/room-configs-archive.json (append-only backup)
{ "archived": Array<RoomConfig & { archivedAt: string }> }
```

**File write concurrency:** All writes to `room-configs.json` must go through a single `RoomConfigStore` service that uses an in-memory mutex (e.g., promise queue) to serialize writes. This prevents data loss from concurrent API requests. The store reads the file into memory on startup and writes back atomically (write to `.tmp` then rename).

### Environment Variables (After Refactor)

**Kept (global):**
| Var | Purpose |
|-----|---------|
| `PORT` | Translator port (default 3000) |
| `NODE_ENV` | Environment |
| `CHATWORK_API_TOKEN` | Bot account token (shared across all rooms) |
| `ROOM_CONFIG_ENCRYPTION_KEY` | NEW: AES-256-GCM key for encrypting secrets |
| `LOGGER_PORT` | Webhook logger port |
| `ZROK_*` | Tunnel config |
| `CHATWORK_SKIP_SIGNATURE_VERIFY` | Dev only |

**Added (new):**
| Var | Purpose |
|-----|---------|
| `INTERNAL_API_SECRET` | Shared secret for `/internal/*` endpoints (webhook-logger ↔ translator) |

**Removed (moved to per-room JSON):**
| Var | Replaced by |
|-----|-------------|
| `AI_PROVIDER` | `roomConfig.aiProvider` |
| `AI_MODEL` | `roomConfig.aiModel` |
| `AI_TRANSLATION_STYLE` | `roomConfig.translationStyle` |
| `CHATWORK_DESTINATION_ROOM_ID` | `roomConfig.destinationRoomId` |
| `CHATWORK_WEBHOOK_SECRET` | `roomConfig.encryptedWebhookSecret` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `roomConfig.encryptedAiApiToken` |
| `OPENAI_API_KEY` | `roomConfig.encryptedAiApiToken` |

**webhook-logger env changes:** Remove `CHATWORK_WEBHOOK_SECRET` from Zod schema, add `INTERNAL_API_SECRET` and `TRANSLATOR_INTERNAL_URL` (for room-secret lookup).

**Zod schema location:** `RoomConfig` Zod schema lives in `@chatwork-bot/translator` (backend-only). Dashboard frontend defines its own client-side form schema that maps to the API contract. No shared schema package needed for MVP.

---

## User Experience

### Pages

| Page             | Route        | Purpose                                                     |
| ---------------- | ------------ | ----------------------------------------------------------- |
| Room List        | `/`          | Overview of all room configs, toggle enable/disable, delete |
| Room Create      | `/rooms/new` | Form with 6 fields to create new room config                |
| Room Detail/Edit | `/rooms/:id` | Edit config + Webhook Activation section                    |
| Webhook Guide    | `/guide`     | Step-by-step interactive guide for Chatwork webhook setup   |

### User Flow (2-Phase)

**Phase 1: Create Config**

1. User clicks "+ New Room" on Room List
2. Fills form: Original Room ID, Destination Room Name, AI Provider, AI Model, Translation Style, AI API Token
3. Submits → system creates destination room on Chatwork → saves config with `enabled: false`
4. Redirects to Room Detail page

**Phase 2: Activate** 5. Room Detail shows "Webhook Activation" section with:

- Generated webhook URL: `https://{domain}/webhook?room_id={originalRoomId}` (+ Copy button)
- Link to Webhook Guide page
- Input field for webhook token

6. User goes to Chatwork → creates webhook following the guide → copies token
7. User pastes webhook token into dashboard → submits
8. System encrypts token → saves → sets `enabled: true`
9. Translation is now active

### Webhook Guide Content

| Step | Title                 | Content                                                                      |
| ---- | --------------------- | ---------------------------------------------------------------------------- |
| 1    | Access Chatwork Admin | Link + screenshot: Integrations → Webhook                                    |
| 2    | Create New Webhook    | Enter Webhook Name: `[Project Name] Translation Bot`                         |
| 3    | Paste Webhook URL     | Display generated URL + Copy button                                          |
| 4    | Select Events         | Tick "Message created" + "Message updated", select Room Event, enter Room ID |
| 5    | Save & Copy Token     | Copy Webhook Setting Token from Chatwork                                     |
| 6    | Activate on Dashboard | Paste token into dashboard → verify connection                               |

### FE States

| State   | UI                                                      |
| ------- | ------------------------------------------------------- |
| Loading | Skeleton placeholders (Framer Motion fade)              |
| Empty   | Illustration + CTA "Create your first translation room" |
| Error   | Error message + Retry button                            |
| Success | Toast notification (Framer Motion slide-in)             |

---

## Design System

### Visual Direction

**Style:** Neubrutalism + Glassmorphism hybrid ("Elegant Brutal")

| Trait            | Spec                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| Background       | Gradient `#FFF0E5` → `#FFE8F5` (peach → pink)                                          |
| Borders          | 3px solid `#1A1A2E` (navy-black, not pure black)                                       |
| Shadows          | 5px 5px 0 `#1A1A2E` (hard offset, zero blur)                                           |
| Border radius    | 18px cards, 14px buttons, 999px pills                                                  |
| Cards            | Frosted glass: `rgba(255,255,255,0.65)` + `backdrop-filter: blur(8px)` + brutal border |
| Organic elements | Floating circles (decorative, pastel, 40-50% opacity)                                  |
| Sticker labels   | Rotated 1-3deg, border + shadow, uppercase                                             |
| Accent color     | `#D44470` (deep pink)                                                                  |
| Success          | `#7EC8A0` (sage green)                                                                 |
| Warning/Setup    | `#FFD166` (warm yellow)                                                                |
| Noise texture    | SVG fractalNoise overlay at 3% opacity                                                 |
| Scrollbar        | Candy crush style: striped track + gradient thumb with animation                       |

### Typography

| Role              | Font              | Weight  | Size    |
| ----------------- | ----------------- | ------- | ------- |
| Headings (h1, h2) | **Shantell Sans** | 800     | 24-32px |
| Body / UI text    | **Kiwi Maru**     | 400-500 | 14-16px |
| Accent labels     | **Shantell Sans** | 700     | 10-12px |

### Interactions (Framer Motion)

| Element         | Animation                                           |
| --------------- | --------------------------------------------------- |
| Card hover      | `translate(-2px, -2px)`, shadow grows to 8px        |
| Card press      | `translate(3px, 3px)`, shadow collapses             |
| Page transition | Fade + slide (200ms)                                |
| Card entrance   | Staggered "slap down" with bounce easing            |
| Toggle          | Jelly bounce elastic bezier                         |
| Toast           | Slide-in from right                                 |
| Skeleton        | Stepped color blocks (brutal skeleton, not shimmer) |

### Color Palette

```css
:root {
  --bg-gradient-start: #fff0e5;
  --bg-gradient-end: #ffe8f5;
  --border: #1a1a2e;
  --accent: #d44470;
  --success: #7ec8a0;
  --warning: #ffd166;
  --error: #ff6b8a;
  --card-glass: rgba(255, 255, 255, 0.65);
  --text-primary: #1a1a2e;
  --text-secondary: #636e72;
  --organic-circle-1: #ffd1dc;
  --organic-circle-2: #e8deff;
  --organic-circle-3: #d4f5e9;
}
```

---

## Tech Stack

| Dependency      | Version     | Purpose                                                                 |
| --------------- | ----------- | ----------------------------------------------------------------------- |
| React           | 19 (latest) | UI framework                                                            |
| Vite            | latest      | Build tool + dev server                                                 |
| TailwindCSS     | v4 (latest) | Styling                                                                 |
| Framer Motion   | latest      | Animations                                                              |
| React Router    | v7 (latest) | Routing (3 pages)                                                       |
| React Hook Form | latest      | Form management                                                         |
| Zod             | latest      | Validation (FE form schemas; backend has its own Zod schemas)           |
| Zustand         | latest      | State management                                                        |
| Prettier        | latest      | Code formatting                                                         |
| ESLint          | latest      | Linting                                                                 |
| Husky           | latest      | Git hooks                                                               |
| Lint-Staged     | latest      | Pre-commit checks                                                       |
| @elysiajs/cors  | latest      | CORS for translator (**new dependency** for `@chatwork-bot/translator`) |

---

## Migration (env → JSON)

This is a **breaking change**. There is no automatic migration from the old .env-based single-room config.

**Migration path:**

1. Deploy new version with `ROOM_CONFIG_ENCRYPTION_KEY` set
2. Old env vars (`AI_PROVIDER`, `AI_MODEL`, `CHATWORK_WEBHOOK_SECRET`, etc.) are no longer read
3. User must manually recreate room configs via the dashboard
4. Old `.env` values can be referenced when filling the dashboard form

**Why no auto-migration:** The old config supports exactly one room with no encryption. The new system requires per-room encrypted secrets and a Chatwork API call to create destination rooms. Auto-migration would need to handle encryption key bootstrapping and room creation — complexity not justified for a small number of existing deployments.

---

## Security

| Concern              | Mitigation                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| AI API tokens        | AES-256-GCM encrypted at rest, `ROOM_CONFIG_ENCRYPTION_KEY` from env     |
| Webhook secrets      | AES-256-GCM encrypted at rest, per-room                                  |
| Webhook verification | HMAC-SHA256 per-room (lookup secret by room_id from query param)         |
| CORS                 | `@elysiajs/cors` — dev: allow localhost:5173, prod: same-origin          |
| No auth              | Accepted for MVP — dashboard on internal network or behind reverse proxy |
| Token display        | Secrets never returned in API responses (redacted)                       |

---

## Testing Strategy

| Layer               | Tool                            | Coverage Target           |
| ------------------- | ------------------------------- | ------------------------- |
| Backend unit        | bun:test                        | >95%                      |
| Backend integration | bun:test                        | >95%                      |
| Frontend unit       | Vitest                          | Best effort               |
| Frontend component  | Vitest + @testing-library/react | Best effort               |
| E2E                 | None (MVP)                      | Manual testing in Phase 7 |

### Backend Test Focus

- Room config CRUD service (create, read, update, delete, list)
- Encryption/decryption utils (AES-256-GCM round-trip)
- Webhook routing per-room (lookup, signature verification)
- API endpoints (validation, error responses, edge cases)
- Collision handling (duplicate originalRoomId, duplicate dest name)
- Archive on delete

---

## Deployment

- Docker Compose (existing setup), dashboard build integrated into translator image
- Multi-stage Dockerfile: stage 1 builds dashboard → stage 2 copies into translator
- Portable for: Coolify (Docker Compose native), Heroku (heroku.yml), AWS (ECS/Fargate)
- Zrok tunnel exposes translator → dashboard automatically accessible

---

## 7 Phases

| Phase | Deliverable                                                                                                                                                           | Success Criteria                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1     | Skeleton dashboard: React package + Vite + routing + basic layout                                                                                                     | Runs on `localhost:5173`, shows 3 pages with nav                             |
| 2     | Full Neubrutalism + Glassmorphism design applied                                                                                                                      | Visual matches approved design direction (Elegant Brutal + Shantell Sans)    |
| 3     | UI forms: room config form, webhook guide, activation flow                                                                                                            | All form fields functional, validation works, matches UX spec                |
| 4     | Backend refactor: env → per-room JSON config, API endpoints. **Prereq:** add `createRoom` to `IChatworkApiClient`, add `GET /internal/room-secret` for webhook-logger | All existing + new tests pass, coverage >95%                                 |
| 5     | FE + BE integration: API calls, loading/skeleton/error states                                                                                                         | Network tab shows successful API calls, states render correctly              |
| 6     | Code review: atomic design, clean code, SOLID, loose coupling                                                                                                         | Well-structured packages, maintainable, extensible                           |
| 7     | Full workflow: manual webhook setup → message → translation                                                                                                           | End-to-end: send message in original room → translation appears in dest room |

---

## Edge Cases & Failure Modes

| Scenario                                     | Handling                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Chatwork API fails during dest room creation | Atomic: don't save config, return specific error to FE                                                    |
| Chatwork rate limit                          | Return error with retry-after info, FE shows "wait X seconds"                                             |
| Duplicate originalRoomId                     | Block: return 409 Conflict                                                                                |
| Duplicate destinationRoomName                | Warn: return success with warning field                                                                   |
| Webhook for unknown room_id                  | Skip: log warning, return 200 (don't break Chatwork retry)                                                |
| Webhook for disabled room                    | Skip: log info, return 200                                                                                |
| Webhook signature mismatch                   | Return 422 (existing behavior)                                                                            |
| Bot not in original room                     | Graceful fallback: display `Room #ID` and `#accountId` instead of names                                   |
| Invalid/expired AI API token                 | Translation fails, logged, no retry (user must update token)                                              |
| Bot lacks room-creation permission           | Return specific error "Bot account does not have permission to create rooms", FE shows setup instructions |
| JSON file corruption                         | Startup validation with Zod, fail fast with clear error                                                   |
| Encryption key missing                       | Startup guard: fail fast, require ROOM_CONFIG_ENCRYPTION_KEY                                              |
| Concurrent file writes                       | In-memory mutex serializes all writes; atomic write via tmp+rename                                        |

---

## Acceptance Criteria

### Happy Path

1. User opens dashboard → sees empty Room List with CTA
2. Clicks "New Room" → fills form → submits → dest room created on Chatwork
3. Sees Room Detail with webhook URL + activation section
4. Follows webhook guide → sets up webhook on Chatwork → copies token
5. Pastes token → activates → room shows "Active" status
6. Someone sends message in original Chatwork room
7. Translation appears in destination room within seconds

### Edge Cases Verified

- Cannot create duplicate room for same originalRoomId
- Warning shown for duplicate dest room name
- Enable/disable toggle works, translation stops/resumes accordingly
- Delete with confirmation → room removed from list, archived to backup
- Form validation: required fields, valid room ID format, valid API token format

---

## Explicit Decisions Made

All 32 decisions documented in decision log during brainstorming session. Key decisions:

- **DEC-001** Multi-room support (user-stated)
- **DEC-002** JSON file storage over SQLite (user-stated, KISS)
- **DEC-003** Shared bot token with graceful fallback (user-confirmed)
- **DEC-008** AES-256-GCM encryption for secrets (user-stated)
- **DEC-018** Atomic create: dest room first, then save (user-stated)
- **DEC-027** 2-phase flow: create → activate (user-stated)
- **DEC-029** Breaking change: room-specific env vars removed (user-stated)
- **DEC-031** Design: Elegant Brutal (glassmorphism + neubrutalism) (user-stated)
- **DEC-032** Fonts: Shantell Sans + Kiwi Maru (user-stated)

---

## Open Risks

| Risk                                                   | Impact                                        | Mitigation                                                                       |
| ------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Bot account lacks room-creation permission on Chatwork | Blocks core create flow                       | Verify bot permissions before Phase 4; document required Chatwork admin setup    |
| JSON file storage performance at scale (>100 rooms)    | Slow reads on every webhook                   | Acceptable for MVP; in-memory cache with file-backed persistence already planned |
| No auth on dashboard                                   | Anyone with network access can modify configs | MVP constraint — document that dashboard should be behind VPN/reverse proxy      |
| Chatwork API rate limits during bulk operations        | Room creation may fail                        | Return error with retry-after; no bulk operations in MVP                         |

---

## Future Scope / Deferred Features

These items are confirmed out of current scope, not estimated, and not committed:

- Auto-add members to destination room (optional member IDs field)
- Vercel deployment (requires separating static FE from server)
- E2E testing with Playwright
- Authentication / authorization
- Real-time translation activity logs
- Dark mode
- Archive file rotation (room-configs-archive.json grows unbounded in MVP)
