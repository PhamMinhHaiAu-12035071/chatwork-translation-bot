# Dashboard Phase 7: Full Workflow End-to-End — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the complete end-to-end workflow: dashboard → create room config (with webhook secret) → room ready → enable translation → send message in original room → translation appears in destination room. Includes Docker Compose updates, static file serving, Dockerfile multi-stage build, and a manual E2E test checklist.

**Architecture:** The translator serves the dashboard as static files from `packages/dashboard/dist/`. In development, Vite dev proxy forwards `/api/*` to translator. In production, a multi-stage Dockerfile builds the dashboard first, then copies the dist into the translator image. Docker Compose orchestrates translator + webhook-logger with shared `INTERNAL_API_SECRET`. Zrok tunnel exposes the translator, making the dashboard and webhook endpoints accessible externally.

**Tech Stack:** React 19, Vite 6, Elysia, Docker (multi-stage), Docker Compose, Zrok, bun:test

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** Full manual workflow — user reads webhook guide → sets up Chatwork webhook → creates room on dashboard (with webhook secret) → enables room → sends message → translation appears in destination room.

---

## ⚠️ UX Flow (post-Phase 5 — no activation step)

The backend requires `webhookSecret` at room creation time. There is NO separate "activate webhook" step. The correct E2E flow is:

1. **Read Webhook Guide** — user learns how to set up a Chatwork webhook
2. **Set up webhook on Chatwork** — create webhook in Chatwork Admin, get the webhook token (= `webhookSecret`)
3. **Create room on dashboard** — fill form including `webhookSecret`, `aiApiToken`, etc.
4. **Room created** — `POST /api/rooms` creates Chatwork destination room, returns `webhookUrl`. Room starts as `enabled: false`
5. **Enable room** — user clicks enable on Room Detail. `POST /api/rooms/:id/enable`
6. **Translation active** — messages in original room are translated to destination room
7. **Disable/Enable** — toggle via separate `POST /api/rooms/:id/enable` and `POST /api/rooms/:id/disable` endpoints

---

## File Map

| File                                        | Action | Responsibility                                                                         |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `packages/translator/src/server.ts`         | Modify | Serve dashboard static files from `../dashboard/dist/`                                 |
| `packages/translator/src/routes/static.ts`  | Create | Static file serving route for SPA (catch-all for client-side routing)                  |
| `Dockerfile`                                | Modify | Multi-stage: stage 1 builds dashboard, stage 2 copies dist into translator             |
| `docker-compose.yml`                        | Modify | Add `INTERNAL_API_SECRET`, `ROOM_CONFIG_ENCRYPTION_KEY`, volume for `data/`            |
| `packages/translator/src/env-schema.ts`     | Modify | Add `ROOM_CONFIG_ENCRYPTION_KEY` and `INTERNAL_API_SECRET` to schema                   |
| `packages/webhook-logger/src/env-schema.ts` | Modify | Add `INTERNAL_API_SECRET`, `TRANSLATOR_INTERNAL_URL`, remove `CHATWORK_WEBHOOK_SECRET` |
| `.env.example`                              | Modify | Document new env vars, mark removed ones                                               |
| `docs/manual-e2e-test.md`                   | Create | Step-by-step manual E2E test checklist                                                 |

---

## Task 1: Serve dashboard static files from translator

**Files:**

- Create: `packages/translator/src/routes/static.ts`
- Modify: `packages/translator/src/server.ts`

- [ ] **Step 1: Create static file serving route**

```typescript
// packages/translator/src/routes/static.ts
import { Elysia } from 'elysia'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

const DASHBOARD_DIST = resolve(import.meta.dir, '../../../dashboard/dist')

export const staticRoutes = new Elysia()
  .get('/assets/*', ({ params }) => {
    const filePath = join(DASHBOARD_DIST, 'assets', params['*'])
    if (!existsSync(filePath)) return new Response('Not found', { status: 404 })
    return Bun.file(filePath)
  })
  .get('/favicon.ico', () => {
    const filePath = join(DASHBOARD_DIST, 'favicon.ico')
    if (!existsSync(filePath)) return new Response('', { status: 204 })
    return Bun.file(filePath)
  })
```

- [ ] **Step 2: Add SPA catch-all for client-side routing**

Add to the same file, AFTER all API and internal routes are registered:

```typescript
// Append to static.ts
export const spaCatchAll = new Elysia().get('*', ({ request }) => {
  const url = new URL(request.url)
  // Don't catch API, internal, or webhook routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/internal/') ||
    url.pathname === '/webhook'
  ) {
    return new Response('Not found', { status: 404 })
  }
  const indexPath = join(DASHBOARD_DIST, 'index.html')
  if (!existsSync(indexPath)) {
    return new Response('Dashboard not built. Run: bun run build:dashboard', { status: 503 })
  }
  return Bun.file(indexPath)
})
```

- [ ] **Step 3: Register static routes in server.ts**

Import and register `staticRoutes` before the SPA catch-all, and `spaCatchAll` LAST (after all other routes):

```typescript
import { staticRoutes, spaCatchAll } from '~/routes/static'

// In the Elysia chain, after API and internal routes:
  .use(staticRoutes)
  // ... all other routes ...
  .use(spaCatchAll) // MUST be last
```

- [ ] **Step 4: Verify static serving works locally**

```bash
cd packages/dashboard && bun run build
cd ../.. && bun run dev:translator
# Open http://localhost:3000 — should serve dashboard
# Open http://localhost:3000/rooms/new — should serve SPA (index.html)
# Open http://localhost:3000/api/rooms — should return JSON (not index.html)
```

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/routes/static.ts packages/translator/src/server.ts
git commit -m "feat(translator): serve dashboard static files with SPA catch-all"
```

---

## Task 2: Multi-stage Dockerfile

**Files:**

- Modify: `Dockerfile`

- [ ] **Step 1: Read the current Dockerfile**

Read the existing Dockerfile to understand the current structure before modifying.

- [ ] **Step 2: Add dashboard build stage**

Add a first stage that builds the dashboard, then copy the dist into the translator stage:

```dockerfile
# Stage 1: Build dashboard
FROM oven/bun:1.1 AS dashboard-builder
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/dashboard/ packages/dashboard/
RUN cd packages/dashboard && bun install && bun run build

# Stage 2: Translator (existing stage, modified)
FROM oven/bun:1.1-distroless
WORKDIR /app
# ... existing COPY commands ...
COPY --from=dashboard-builder /app/packages/dashboard/dist packages/dashboard/dist/
```

Note: Adapt this to the existing Dockerfile structure. The key change is adding the dashboard build stage and the `COPY --from` line.

- [ ] **Step 3: Verify Docker build works**

```bash
docker build -t chatwork-bot-test .
# Should complete without errors
# Dashboard dist should be at /app/packages/dashboard/dist/ in the image
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "build(docker): add multi-stage dashboard build to Dockerfile"
```

---

## Task 3: Update Docker Compose configuration

**Files:**

- Modify: `docker-compose.yml`

- [ ] **Step 1: Read the current docker-compose.yml**

Read existing docker-compose.yml to understand the current service definitions.

- [ ] **Step 2: Add new environment variables to translator service**

```yaml
# Under translator service environment:
ROOM_CONFIG_ENCRYPTION_KEY: ${ROOM_CONFIG_ENCRYPTION_KEY}
INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}
```

- [ ] **Step 3: Add new environment variables to webhook-logger service**

```yaml
# Under webhook-logger service environment:
INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}
TRANSLATOR_INTERNAL_URL: http://translator:3000
```

Remove `CHATWORK_WEBHOOK_SECRET` from webhook-logger if it's still there (now per-room, stored encrypted in room config).

- [ ] **Step 4: Add data volume mount for translator**

```yaml
# Under translator service volumes:
- ./data:/app/data
```

This ensures `room-configs.json` persists across container restarts.

- [ ] **Step 5: Verify docker-compose config is valid**

```bash
docker compose config
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "build(docker): add multi-room env vars and data volume to compose"
```

---

## Task 4: Update .env.example with new env vars

**Files:**

- Modify: `.env.example`

- [ ] **Step 1: Read current .env.example**

- [ ] **Step 2: Update .env.example**

Add new required variables and mark removed ones:

```bash
# === Multi-Room Config (NEW — Phase 4+) ===
# AES-256-GCM encryption key for room config secrets (32 bytes, hex-encoded)
# Generate with: openssl rand -hex 32
ROOM_CONFIG_ENCRYPTION_KEY=

# Shared secret for internal API communication (translator ↔ webhook-logger)
# Generate with: openssl rand -hex 16
INTERNAL_API_SECRET=

# === Removed (moved to per-room config via dashboard) ===
# AI_PROVIDER          → roomConfig.aiProvider
# AI_MODEL             → roomConfig.aiModel
# AI_TRANSLATION_STYLE → roomConfig.translationStyle
# CHATWORK_DESTINATION_ROOM_ID → roomConfig.destinationRoomId
# CHATWORK_WEBHOOK_SECRET      → roomConfig.encryptedWebhookSecret
# GOOGLE_GENERATIVE_AI_API_KEY → roomConfig.encryptedAiApiToken
# OPENAI_API_KEY               → roomConfig.encryptedAiApiToken
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): document new multi-room env vars and removed single-room vars"
```

---

## Task 5: Add build scripts to root package.json

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Read root package.json**

- [ ] **Step 2: Add dashboard build scripts**

Add convenience scripts for building and running the full system:

```json
{
  "scripts": {
    "build:dashboard": "cd packages/dashboard && bun run build",
    "dev:full": "concurrently \"bun run dev:translator\" \"bun run dev:dashboard\"",
    "prebuild": "bun run build:dashboard"
  }
}
```

Note: Only add scripts that don't already exist. Adapt to the existing script naming convention.

- [ ] **Step 3: Verify scripts work**

```bash
bun run build:dashboard
# Should produce packages/dashboard/dist/ with index.html
```

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "build(repo): add dashboard build scripts to root package.json"
```

---

## Task 6: Write manual E2E test checklist

**Files:**

- Create: `docs/manual-e2e-test.md`

- [ ] **Step 1: Create the E2E test checklist**

```markdown
# Manual E2E Test Checklist — Multi-Room Translation

## Prerequisites

- [ ] `ROOM_CONFIG_ENCRYPTION_KEY` set (generate: `openssl rand -hex 32`)
- [ ] `INTERNAL_API_SECRET` set (generate: `openssl rand -hex 16`)
- [ ] `CHATWORK_API_TOKEN` set (bot account token)
- [ ] Bot account has room creation permission
- [ ] Translator running on port 3000
- [ ] Webhook-logger running on port 3001
- [ ] Zrok tunnel active (or ngrok/other tunnel for webhook URL)

## Happy Path

### 1. Dashboard Access

- [ ] Open `http://localhost:3000` → dashboard loads
- [ ] Navigation works: Room List, Webhook Guide pages
- [ ] Empty state shows "Create your first translation room" CTA

### 2. Read Webhook Guide

- [ ] Navigate to Webhook Guide page
- [ ] Step-by-step instructions are clear and complete
- [ ] Guide explains: go to Chatwork Admin → create webhook → copy token

### 3. Set Up Chatwork Webhook (manual — outside dashboard)

- [ ] Go to Chatwork Admin → Integrations → Webhooks
- [ ] Create new webhook:
  - Name: "Translation Bot Test"
  - URL: will be provided by dashboard after room creation (or use tunnel URL + `/webhook`)
  - Events: "Message created" + "Message updated"
  - Room: select original room
- [ ] Save and copy the webhook token (this is the `webhookSecret`)

### 4. Create Room Config on Dashboard

- [ ] Click "+ New Room"
- [ ] Fill form:
  - Original Room ID: (your test Chatwork room ID)
  - Destination Room Name: "Test Translation Room"
  - AI Provider: select one
  - AI Model: select or leave default
  - Translation Style: select one
  - AI API Token: (valid token for chosen provider)
  - Webhook Secret: (paste the token copied from step 3)
- [ ] Submit → success toast → redirect to Room Detail
- [ ] Verify on Chatwork: destination room was created
- [ ] Room Detail shows room info with `enabled: false` status

### 5. Enable Translation

- [ ] On Room Detail page, click "Enable" button
- [ ] Room status changes to `enabled: true` (active)
- [ ] Room List shows room as active (green status)

### 6. Test Translation

- [ ] Send a message in the original Chatwork room
- [ ] Wait 5-10 seconds
- [ ] Check destination room → translated message appears
- [ ] Verify translation matches the selected style

### 7. Disable/Enable Toggle

- [ ] Click "Disable" on Room Detail or Room List
- [ ] Send another message in original room
- [ ] Verify NO translation appears in destination room
- [ ] Click "Enable" again
- [ ] Send another message → translation resumes

### 8. Edit Room Config

- [ ] Open Room Detail → edit AI model or translation style
- [ ] Save changes → success toast
- [ ] Send message → verify translation uses new settings

### 9. Delete Room

- [ ] Click delete on Room List or Room Detail page
- [ ] Confirm deletion in modal
- [ ] Room disappears from list
- [ ] Verify `data/room-configs-archive.json` contains the deleted config

## Edge Cases

### Duplicate Room

- [ ] Try creating a room with the same Original Room ID
- [ ] Expected: 409 error, form shows "Room already exists" or similar error

### Invalid AI API Token

- [ ] Create room with an invalid AI API token
- [ ] Enable room → send message
- [ ] Translation should fail (check translator logs)
- [ ] Dashboard should still work (room remains enabled but translations fail silently)

### Webhook for Unknown Room

- [ ] Send a webhook request with an unknown room_id
- [ ] Expected: webhook-logger gets 404 from internal-room-secret, logs warning

### Webhook for Disabled Room

- [ ] Disable a room, then send a webhook for that room
- [ ] Expected: internal-room-secret returns 404 (room not enabled), no translation

### Missing Webhook Secret

- [ ] Try submitting create form without Webhook Secret
- [ ] Expected: form validation error, submit blocked

## Cleanup

- [ ] Delete test room configs via dashboard
- [ ] Remove test webhook from Chatwork Admin
- [ ] Optionally: delete the destination rooms from Chatwork
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-e2e-test.md
git commit -m "docs(testing): add manual E2E test checklist for full workflow"
```

---

## Task 7: Final quality gate and integration verification

- [ ] **Step 1: Run full quality checks**

```bash
bun run typecheck && bun test && bun run lint
```

All must pass with zero errors.

- [ ] **Step 2: Build dashboard and verify static serving**

```bash
bun run build:dashboard
cd packages/translator && bun run dev
# Open http://localhost:3000 — dashboard should load
# Navigate to /rooms/new — SPA routing should work
# Open /api/rooms — should return JSON
```

- [ ] **Step 3: Verify Docker build**

```bash
docker compose build
docker compose up -d
# Open http://localhost:3000 — full system running
docker compose down
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(repo): Phase 7 complete — full workflow integration ready for E2E testing"
```

---

## Ship & Review

**User action:** Follow the manual E2E test checklist in `docs/manual-e2e-test.md`:

1. Start translator + webhook-logger + Zrok tunnel
2. Open `http://localhost:3000` → dashboard loads
3. Read Webhook Guide → set up Chatwork webhook → get secret token
4. Create room on dashboard (with webhook secret + AI token)
5. Enable room on Room Detail
6. Send message in original room → translation appears in destination room

**Success criteria:**

1. `bun run typecheck && bun test && bun run lint` — all pass
2. Dashboard served as static files from translator (no separate dev server needed in prod)
3. Docker multi-stage build works
4. Full workflow: webhook guide → create room (with secret) → enable → message → translation
5. Enable/disable toggle stops/resumes translation
6. Delete archives config to backup file
7. All edge cases in checklist verified

**This is the final phase. After user approval, the project is complete.**
