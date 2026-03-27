# Manual E2E Test Checklist — Multi-Room Translation

## Prerequisites

- [ ] `ROOM_CONFIG_ENCRYPTION_KEY` set (generate: `openssl rand -hex 32`)
- [ ] `CHATWORK_API_TOKEN` set (bot account token)
- [ ] `ZROK_ENABLE_TOKEN` and `ZROK_UNIQUE_NAME` set (see `docs/operations/zrok.md`)
- [ ] Bot account has room creation permission
- [ ] Run `bun run dev` — starts all services (translator, webhook-logger, gateway, zrok)
- [ ] Verify zrok public URL appears in Docker logs (e.g. `https://<name>.share.zrok.io`)

## Happy Path

### 1. Dashboard Access

- [ ] Open `http://localhost:8080` (or zrok public URL) → dashboard loads
- [ ] Navigation works: Room List, Webhook Guide pages
- [ ] Empty state shows "Create your first translation room" CTA

### 2. Read Webhook Guide

- [ ] Navigate to Webhook Guide page
- [ ] Step-by-step instructions are clear and complete
- [ ] Guide explains: go to Chatwork Admin → create webhook → save it for the room

### 3. Set Up Chatwork Webhook (manual — outside dashboard)

- [ ] Go to Chatwork Admin → Integrations → Webhooks
- [ ] Create new webhook:
  - Name: "Translation Bot Test"
  - URL: `https://<zrok-name>.share.zrok.io/webhook` (shown in Docker logs at startup)
  - Events: "Message created" + "Message updated"
  - Room: select original room
- [ ] Save the webhook in Chatwork

### 4. Create Room Config on Dashboard

- [ ] Click "+ New Room"
- [ ] Fill form:
  - Original Room ID: (your test Chatwork room ID)
  - Destination Room Name: "Test Translation Room"
  - AI Provider: select one
  - AI Model: select or leave default
  - Translation Style: select one
  - AI API Token: (valid token for chosen provider)
- [ ] Submit → success toast → redirect to Room Detail
- [ ] Verify on Chatwork: destination room was created
- [ ] Room Detail shows the room info and active status controls

### 5. Test Translation

- [ ] Send a message in the original Chatwork room
- [ ] Wait 5-10 seconds
- [ ] Check destination room → translated message appears
- [ ] Verify translation matches the selected style

### 6. Disable/Enable Toggle

- [ ] Click "Disable" on Room Detail or Room List
- [ ] Send another message in original room
- [ ] Verify NO translation appears in destination room
- [ ] Click "Enable" again
- [ ] Send another message → translation resumes

### 7. Edit Room Config

- [ ] Open Room Detail → edit AI model or translation style
- [ ] Save changes → success toast
- [ ] Send message → verify translation uses new settings

### 8. Delete Room

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
- [ ] Expected: translator skips the request because no room config exists, and no translation is sent

### Webhook for Disabled Room

- [ ] Disable a room, then send a webhook for that room
- [ ] Expected: translator skips the request because the room is disabled, and no translation is sent

## Cleanup

- [ ] Delete test room configs via dashboard
- [ ] Remove test webhook from Chatwork Admin
- [ ] Optionally: delete the destination rooms from Chatwork
