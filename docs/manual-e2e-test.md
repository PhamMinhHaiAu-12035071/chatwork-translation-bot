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
  - Original Room Name: "Test Source Room" (visible field above Destination Room Name)
  - Destination Room Name: "Test Translation Room"
  - AI Provider: select one
  - AI Model: select or leave default
  - Translation Style: select one
  - AI API Token: (valid token for chosen provider)
- [ ] Submit → success toast → redirect to Room Detail
- [ ] Verify on Chatwork: destination room was created
- [ ] Room Detail shows the room info and active status controls

### Test Case: Create Translation Room

1. Open dashboard → "Create Room" page
2. Fill form:
   - Original Room ID: `123456789`
   - **Original Room Name:** `E2E Test Room`
   - Destination Room Name: `E2E-Translation`
   - AI Provider: `gemini`
   - Translation Style: `NATURAL_CASUAL`
3. Submit form
4. **Verify** success toast: `"E2E-Translation" was created successfully`
5. Open destination room in Chatwork
6. **Verify** room description displays:

   ```
   ◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
   ╰┈☆ Original ☆┈╯: E2E Test Room
   ```

**Expected:** All decorative symbols, light box drawing, and emoji render correctly

#### Create Room Test Cases: originalRoomName Field

**Field Presence Verification**

- [ ] Original Room Name field appears in the create room form
- [ ] Field is positioned between Original Room ID and Destination Room Name
- [ ] Field label is "Original Room Name"
- [ ] Field has placeholder text "e.g., Team Chat"

**Validation Tests**

- [ ] Try submitting form with empty Original Room Name → error: "Original room name is required"
- [ ] Try entering 101 characters → error: "Must be 100 characters or less"
- [ ] Enter valid name (1-100 chars) → form submits successfully
- [ ] Enter exactly 100 characters → form submits successfully

**Description Verification in Chatwork**

- [ ] After creating room, check destination room description in Chatwork
- [ ] Verify banner line includes: `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦`
- [ ] Verify original reference line: `╰┈☆ Original ☆┈╯:` followed by your Original Room Name value
- [ ] **Expected:** Decorative symbols (`◦•●◉✿╰┈☆╯`), light box drawing, and any emoji in the name render correctly in Chatwork

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

#### Edit Room Test Cases: originalRoomName Field

**Read-Only Field Verification**

- [ ] Open edit form for existing room
- [ ] Verify Original Room Name field is present and visible
- [ ] Verify field displays the saved originalRoomName value
- [ ] Field should be read-only (grayed out or disabled appearance)

**Hint Text Check**

- [ ] Verify hint text below field: "Room name cannot be changed after creation"
- [ ] Hint text should use muted/gray styling

**Cannot Edit Verification**

- [ ] Try to click or focus the Original Room Name field
- [ ] Verify field does not become editable
- [ ] Verify cursor shows "not-allowed" or field remains non-interactive
- [ ] Submit form with other changes → verify originalRoomName remains unchanged

### 7.1. Tour Guide Test Cases

**Step 7 Highlights Original Room Name Field**

- [ ] Start guided tour from dashboard
- [ ] Progress through steps 1-6 normally
- [ ] On step 7, verify spotlight/highlight appears on Original Room Name field
- [ ] Verify tooltip/popover explains: "Name of your original Chatwork room"
- [ ] Field should be visually emphasized (e.g., ring/border highlight)

**All Subsequent Steps Work**

- [ ] Click "Next" to proceed to step 8
- [ ] Verify step 8 highlight moves to next field correctly
- [ ] Continue through remaining tour steps
- [ ] Verify all steps complete without errors
- [ ] Verify tour completes successfully and closes properly

**Tour Skip and Restart**

- [ ] Start tour again
- [ ] Skip directly to step 7 (if skip functionality exists)
- [ ] Verify step 7 still correctly highlights Original Room Name field
- [ ] Exit tour midway and restart
- [ ] Verify step 7 behavior remains consistent

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
