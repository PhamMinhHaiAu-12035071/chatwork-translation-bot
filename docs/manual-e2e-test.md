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
