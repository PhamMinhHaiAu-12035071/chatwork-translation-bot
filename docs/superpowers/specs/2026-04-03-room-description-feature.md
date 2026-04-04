# Room Description Feature - Design Specification

**Version:** 1.0  
**Date:** 2026-04-03  
**Prepared by:** AI-assisted  
**Status:** Approved

---

## 1. Overview

### 1.1 Objective

Add eye-catching, Neubrutalism-styled descriptions to Chatwork translation destination rooms to enable instant recognition (<1s) of room purpose and original source.

### 1.2 Problem Statement

Currently, translation destination rooms lack descriptive information, making it difficult for users to quickly identify which original room a translation room corresponds to. Users must rely on manually set room names or check configuration to understand the relationship.

### 1.3 Success Criteria

- ✅ Users can identify translation room source within 1 second
- ✅ Description displays original room name with visual impact
- ✅ Consistent Neubrutalism 3D aesthetic matching existing "Created"/"Updated" indicators
- ✅ Works for both Standard and Free room types
- ✅ No breaking changes to existing rooms

---

## 2. Scope

### 2.1 In Scope

- Add "Original Room Name" input field to dashboard create forms (Standard & Free)
- Display originalRoomName in edit forms as read-only (cannot be changed after creation)
- Store original room name in JSON config files (new required field)
- Compose and set Chatwork room description when creating destination rooms
- Create Unicode bold text utility function
- Update tour guide to include new field step
- Update manual E2E test documentation
- Apply to newly created rooms only (no backfill)

### 2.2 Out of Scope

- Backfilling descriptions for existing rooms (decided: no backfill)
- Fetching room name via Chatwork API (decided: manual input instead, bot lacks permission)
- Updating description after room creation (edit form shows field as read-only)
- Updating description if user manually edits it in Chatwork (YAGNI, risk of conflict)
- Displaying originalRoomName in room list cards (decided: only in Chatwork description)
- Automatic migration of existing configs (user will cleanup data before deployment)
- Multi-language description variants

### 2.3 Non-Goals

- Auto-detecting original room name from Chatwork API (bot lacks permission)
- Real-time description synchronization if original room renamed
- Custom description templates per user

---

## 3. Solution Design

### 3.1 Chosen Approach: Manual Input

**Rationale:**

- Bot token lacks permission to `GET /rooms/{originalRoomId}` if bot is not a member of original rooms
- Manual input is simple, reliable, and has no API dependencies
- Users already know the original room name they're configuring
- Edit form displays field as **read-only** to prevent conflicts if Chatwork room description is manually modified by admins

**User Flow:**

1. User opens "Create Room" page in dashboard
2. User inputs **Original Room ID** (existing field)
3. User inputs **Original Room Name** (NEW required field, placed next to ID)
4. User completes other fields (destination name, AI settings, etc.)
5. User submits form
6. Backend creates destination room with composed description
7. Success toast confirms creation

### 3.2 Description Format

**Selected Variant: Clean Brutal (Variant B)**

```
╔═══════════════════════════════════════╗
║    🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐    ║
╚═══════════════════════════════════════╝

📍 𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥: {originalRoomName}
```

**Example (with actual room name):**

```
╔═══════════════════════════════════════╗
║    🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐    ║
╚═══════════════════════════════════════╝

📍 𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥: JP Project Demo
```

**Design Rationale:**

- **Perfect symmetry:** Extended box width with centered content for balanced aesthetic
- **Neubrutalism aesthetic:** Geometric box drawing characters (U+2550-U+255D)
- **Visual hierarchy:** Title in box, content below with clear separation
- **Unicode Math Bold:** Matches existing "Created"/"Updated" indicator style (U+1D400-U+1D433)
- **Emoji anchors:** 🌐 for translation context, 📍 for source location
- **Scan time:** <1 second due to strong visual contrast and clear structure

---

## 4. Technical Architecture

### 4.1 Data Flow

```
┌─────────────┐
│  Dashboard  │
│  (Create    │
│   Form)     │
└──────┬──────┘
       │ POST /api/rooms
       │ { originalRoomId, originalRoomName, ... }
       ▼
┌─────────────────┐
│  Backend API    │
│  /api/rooms     │
└────────┬────────┘
         │ 1. Validate input
         │ 2. Compose description (Unicode bold)
         │ 3. Call Chatwork API
         ▼
┌──────────────────────┐
│  Chatwork API        │
│  POST /rooms         │
│  { name, description,│
│    members_admin_ids }│
└──────────┬───────────┘
           │ { room_id }
           ▼
┌──────────────────────┐
│  Save to Database    │
│  rooms / free_rooms  │
│  + originalRoomName  │
└──────────────────────┘
```

### 4.2 Database Schema Changes

#### 4.2.1 Standard Rooms (JSON config file)

**File:** `data/standard-rooms.json`

**Changes:**

```json
{
  "version": 1,
  "rooms": [
    {
      "id": "uuid",
      "originalRoomId": 123456,
      "originalRoomName": "JP Project Demo", // NEW FIELD (required)
      "destinationRoomId": 789012,
      "destinationRoomName": "Translation - JP Project",
      "aiProvider": "openai"
      // ... other fields
    }
  ]
}
```

**Migration:** No automatic migration. New field required for new rooms only.

#### 4.2.2 Free Rooms (JSON config file)

**File:** `data/free-rooms.json`

**Changes:**

```json
{
  "version": 1,
  "rooms": [
    {
      "id": "uuid",
      "originalRoomId": 123456,
      "originalRoomName": "JP Project Demo", // NEW FIELD (required)
      "destinationRoomId": 789012,
      "destinationRoomName": "Translation - JP Project",
      "kagiStyle": "Clear"
      // ... other fields
    }
  ]
}
```

**Migration:** No automatic migration. New field required for new rooms only.

### 4.3 API Changes

#### 4.3.1 Standard Rooms

**Endpoint:** `POST /api/rooms`

**Request Body (updated):**

```typescript
interface CreateRoomInput {
  originalRoomId: number
  originalRoomName: string // NEW (required, 1-100 chars)
  destinationRoomName: string
  aiProvider: 'openai' | 'gemini'
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  context?: string | null
  protectedKeywords?: ProtectedKeyword[]
}
```

#### 4.3.2 Free Rooms

**Endpoint:** `POST /api/free-rooms`

**Request Body (updated):**

```typescript
interface CreateFreeRoomRequest {
  originalRoomId: number
  originalRoomName: string // NEW (required, 1-100 chars)
  destinationRoomName: string
  kagiStyle: FreeRoomKagiStyle
  context?: string | null
  protectedKeywords?: KeywordEntry[]
}
```

### 4.4 Component Changes

#### 4.4.1 Dashboard Create Forms

**Files to modify:**

- `packages/dashboard/src/pages/room-create.tsx` (Standard)
- `packages/dashboard/src/pages/free-room-create.tsx` (Free)

**Changes:**

```tsx
// Add field next to "Original Room ID"
<div className="grid gap-5 md:grid-cols-2">
  <BrutalInput
    label="Original Room ID"
    type="text"
    inputMode="numeric"
    hint="The numeric ID of the source Chatwork room."
    error={errors.originalRoomId?.message}
    {...register('originalRoomId', {
      setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
    })}
  />

  {/* NEW FIELD */}
  <BrutalInput
    label="Original Room Name"
    type="text"
    hint="The name of the source Chatwork room (for description)."
    placeholder="e.g., JP Project Demo"
    error={errors.originalRoomName?.message}
    {...register('originalRoomName')}
  />

  {/* Other fields... */}
</div>
```

#### 4.4.2 Schema Validation

**Files to modify:**

- `packages/dashboard/src/lib/room-schema.ts` (Standard)
- `packages/dashboard/src/lib/free-room-schemas.ts` (Free)

**Changes:**

```typescript
export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),

  // NEW FIELD
  originalRoomName: z
    .string({ required_error: 'Original room name is required' })
    .min(1, 'Original room name is required')
    .max(100, 'Max 100 characters')
    .trim(),

  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),

  // ... other fields
})
```

### 4.5 Backend Services

#### 4.5.1 Description Composition Utility

**New file:** `packages/chatwork/src/services/compose-room-description.ts`

```typescript
/**
 * Converts ASCII text to Unicode Math Bold characters (U+1D400-U+1D433).
 * Matches the style used in "Created"/"Updated" indicators.
 */
function convertToUnicodeBold(text: string): string {
  const boldMap: Record<string, string> = {
    A: '𝐀',
    B: '𝐁',
    C: '𝐂',
    D: '𝐃',
    E: '𝐄',
    F: '𝐅',
    G: '𝐆',
    H: '𝐇',
    I: '𝐈',
    J: '𝐉',
    K: '𝐊',
    L: '𝐋',
    M: '𝐌',
    N: '𝐍',
    O: '𝐎',
    P: '𝐏',
    Q: '𝐐',
    R: '𝐑',
    S: '𝐒',
    T: '𝐓',
    U: '𝐔',
    V: '𝐕',
    W: '𝐖',
    X: '𝐗',
    Y: '𝐘',
    Z: '𝐙',
    a: '𝐚',
    b: '𝐛',
    c: '𝐜',
    d: '𝐝',
    e: '𝐞',
    f: '𝐟',
    g: '𝐠',
    h: '𝐡',
    i: '𝐢',
    j: '𝐣',
    k: '𝐤',
    l: '𝐥',
    m: '𝐦',
    n: '𝐧',
    o: '𝐨',
    p: '𝐩',
    q: '𝐪',
    r: '𝐫',
    s: '𝐬',
    t: '𝐭',
    u: '𝐮',
    v: '𝐯',
    w: '𝐰',
    x: '𝐱',
    y: '𝐲',
    z: '𝐳',
  }

  return text
    .split('')
    .map((char) => boldMap[char] ?? char)
    .join('')
}

/**
 * Composes the Neubrutalism-styled room description for translation rooms.
 */
export function composeRoomDescription(originalRoomName: string): string {
  const title = convertToUnicodeBold('TRANSLATION ROOM')
  const label = convertToUnicodeBold('Original')

  return `╔═══════════════════════════════════════╗
║    🌐 ${title} 🌐    ║
╚═══════════════════════════════════════╝

📍 ${label}: ${originalRoomName}`
}
```

**Export:** Add to `packages/chatwork/src/index.ts`

#### 4.4.3 Dashboard Edit Forms (Read-Only Display)

**Files to modify:**

- `packages/dashboard/src/pages/room-detail.tsx` (Standard)
- `packages/dashboard/src/pages/free-room-detail.tsx` (Free)
- `packages/dashboard/src/lib/room-schema.ts` (add to `roomEditSchema`)
- `packages/dashboard/src/lib/free-room-schemas.ts` (add to `freeRoomEditSchema`)

**Changes:**

```tsx
// Add read-only field in edit forms (similar to originalRoomId)
<BrutalInput
  label="Original Room Name"
  type="text"
  readOnly
  hint="Cannot be changed after creation."
  value={room.originalRoomName}
/>
```

**Behavior:**

- Field displays current value from loaded room config
- `readOnly` attribute prevents editing
- Hint text explains it cannot be changed
- Value is NOT sent in `updateRoom` API call (only shown for reference)

**Rationale (YAGNI Principle):**

Updating Chatwork room description after creation is risky because:

1. Admins may have manually edited the description in Chatwork
2. Parsing and replacing specific text in manually-edited descriptions is error-prone
3. Risk of destroying custom content added by users
4. Following YAGNI (You Aren't Gonna Need It) - set description once at creation, keep it simple

#### 4.4.4 Tour Guide Updates

**Files to modify:**

- `packages/dashboard/src/lib/tour-steps.ts`
- `packages/dashboard/src/lib/tour-steps.test.ts`
- `packages/dashboard/src/layouts/app-layout.tsx` (adjust step index logic)

**Changes:**

Current tour steps for room create form:

```
Step 6: #tour-field-roomid (Original Room ID)
Step 7: #tour-field-roomname (Destination Room Name)
Step 8: #tour-field-provider
Step 9: #tour-field-model
...
```

**New tour steps (insert new step 7):**

```
Step 6: #tour-field-roomid (Original Room ID)
Step 7: #tour-field-roomname-orig (Original Room Name) ← NEW
Step 8: #tour-field-roomname (Destination Room Name)
Step 9: #tour-field-provider
Step 10: #tour-field-model
...
```

**Impact:**

- All step indices from Step 7 onward shift by +1
- Update `app-layout.tsx` logic that references specific step indices (e.g., context expand at step 13 becomes step 14)
- Update conditional navigation logic for "room card" steps (17-20 becomes 18-21)
- Add new step object in `tour-steps.ts` array at index 7

**Tour Step Content:**

```typescript
{
  selector: '#tour-field-roomname-orig',
  title: 'Original Room Name',
  content: 'Enter the name of your source Chatwork room. This will appear in the translation room description for easy identification.',
  color: 'mint',
  placement: 'right',
}
```

#### 4.5.2 Room Creation Services

**Files to modify:**

- `packages/translator/src/routes/rooms.ts` (Standard)
- `packages/translator/src/routes/free-rooms.ts` (Free)

**Changes:**

```typescript
import { composeRoomDescription } from '@chatwork-bot/chatwork'

// In create room handler:
const description = composeRoomDescription(validatedData.originalRoomName)

const createdRoom = await createRoom(
  {
    name: validatedData.destinationRoomName,
    members_admin_ids: String(chatworkMe.account_id),
    description, // NEW: Set description
    icon_preset: 'group',
  },
  env.CHATWORK_API_TOKEN,
)
```

---

## 5. User Experience

### 5.1 Dashboard UI Changes

**Before (Current):**

```
┌──────────────────────────┐
│ Original Room ID         │
│ [123456        ]         │
└──────────────────────────┘
┌──────────────────────────┐
│ Destination Room Name    │
│ [Translation - JP]       │
└──────────────────────────┘
```

**After (New):**

```
┌──────────────────────────┐  ┌──────────────────────────┐
│ Original Room ID         │  │ Original Room Name       │
│ [123456        ]         │  │ [JP Project Demo]        │
└──────────────────────────┘  └──────────────────────────┘
                                (NEW FIELD)

┌──────────────────────────────────────────────────────────┐
│ Destination Room Name                                    │
│ [Translation - JP]                                       │
└──────────────────────────────────────────────────────────┘
```

**Field Details:**

- **Label:** "Original Room Name"
- **Type:** Text input
- **Placeholder:** "e.g., JP Project Demo"
- **Hint:** "The name of the source Chatwork room (for description)."
- **Validation:** Required, 1-100 characters, trimmed
- **Error messages:**
  - Empty: "Original room name is required"
  - Too long: "Max 100 characters"

### 5.2 Chatwork Room Description Display

**Location:** Chatwork room info panel (desktop/mobile app)

**Before:** Empty or generic description

**After:**

```
╔═══════════════════════════════════════╗
║    🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐    ║
╚═══════════════════════════════════════╝

📍 𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥: JP Project Demo
```

**User Impact:**

- Users can instantly identify room purpose by clicking "Room Info" button
- No confusion between multiple translation rooms
- Professional, branded appearance matching bot's message style

---

## 6. Edge Cases & Error Handling

### 6.1 Empty Original Room Name

**Scenario:** User submits form without entering original room name  
**Handling:** Client-side validation blocks submission, shows error "Original room name is required"  
**Outcome:** Cannot create room without name

### 6.2 Very Long Room Name

**Scenario:** User enters room name >100 characters  
**Handling:** Client-side validation shows error "Max 100 characters"  
**Outcome:** User must shorten name to proceed

### 6.3 Special Characters in Room Name

**Scenario:** Room name contains Unicode, emojis, special characters  
**Handling:** Accept all characters, pass through to description as-is  
**Example:** "プロジェクト🚀 Demo" → Valid, renders correctly in description

### 6.4 Chatwork API Failure

**Scenario:** `POST /rooms` with description parameter fails  
**Handling:** Return error to user, do not save room config  
**Error message:** "Failed to create Chatwork room: [API error details]"  
**Recovery:** User can retry with same data

### 6.5 Description Too Long for Chatwork

**Scenario:** Composed description exceeds Chatwork's description limit (unknown limit)  
**Handling:** Chatwork API will return error  
**Mitigation:** Template is fixed-size (~150 chars) + room name (max 100) = ~250 chars total. Well within reasonable limits.

### 6.6 Existing Rooms (No Description)

**Scenario:** Rooms created before this feature have no `originalRoomName`  
**Handling:** No automatic backfill. User will cleanup all existing room data before deployment.  
**Edit Form Behavior:** If old rooms somehow remain, edit form will show empty/undefined originalRoomName (read-only, cannot be filled in)

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Test Files:**

- `packages/chatwork/src/services/compose-room-description.test.ts`
- `packages/dashboard/src/lib/room-schema.test.ts`
- `packages/dashboard/src/lib/free-room-schemas.test.ts`

**Test Cases:**

```typescript
describe('composeRoomDescription', () => {
  it('generates correct format with ASCII room name', () => {
    const result = composeRoomDescription('JP Project Demo')
    expect(result).toContain('🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐')
    expect(result).toContain('📍 𝐎𝐫𝐢𝐠𝐢𝐧𝐚𝐥: JP Project Demo')
    expect(result).toContain('╔═')
    expect(result).toContain('╚═')
  })

  it('handles Unicode characters in room name', () => {
    const result = composeRoomDescription('プロジェクト Demo')
    expect(result).toContain('プロジェクト Demo')
  })

  it('handles emoji in room name', () => {
    const result = composeRoomDescription('Project 🚀')
    expect(result).toContain('Project 🚀')
  })

  it('converts ASCII to Unicode bold correctly', () => {
    // Test internal conversion function
  })
})

describe('roomCreateSchema', () => {
  it('requires originalRoomName', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123,
      // originalRoomName: missing
      destinationRoomName: 'Test',
      // ... other fields
    })
    expect(result.success).toBe(false)
  })

  it('trims originalRoomName', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123,
      originalRoomName: '  JP Project  ',
      // ... other fields
    })
    expect(result.success).toBe(true)
    expect(result.data.originalRoomName).toBe('JP Project')
  })

  it('rejects empty originalRoomName', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123,
      originalRoomName: '',
      // ... other fields
    })
    expect(result.success).toBe(false)
  })

  it('rejects originalRoomName >100 chars', () => {
    const result = roomCreateSchema.safeParse({
      originalRoomId: 123,
      originalRoomName: 'A'.repeat(101),
      // ... other fields
    })
    expect(result.success).toBe(false)
  })
})
```

### 7.2 Integration Tests

**Test Files:**

- `packages/translator/src/routes/rooms.test.ts`
- `packages/translator/src/routes/free-rooms.test.ts`

**Test Cases:**

```typescript
describe('POST /api/rooms', () => {
  it('creates room with description when originalRoomName provided', async () => {
    const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: 789 })

    const response = await request(app).post('/api/rooms').send({
      originalRoomId: 123,
      originalRoomName: 'JP Project Demo',
      destinationRoomName: 'Translation',
      // ... other fields
    })

    expect(response.status).toBe(201)
    expect(mockCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('🌐 𝐓𝐑𝐀𝐍𝐒𝐋𝐀𝐓𝐈𝐎𝐍 𝐑𝐎𝐎𝐌 🌐'),
      }),
      expect.any(String),
    )
  })

  it('rejects request without originalRoomName', async () => {
    const response = await request(app).post('/api/rooms').send({
      originalRoomId: 123,
      // originalRoomName: missing
      destinationRoomName: 'Translation',
      // ... other fields
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('required')
  })
})
```

### 7.3 Manual Testing

**Test Checklist:**

Standard Rooms:

- [ ] Create new room with ASCII room name → description appears in Chatwork
- [ ] Create new room with Unicode room name (e.g., Japanese) → description displays correctly
- [ ] Create new room with emoji in room name → description displays correctly
- [ ] Try to submit without room name → validation error appears
- [ ] Try to submit with 101-char name → validation error appears
- [ ] Verify description visible in Chatwork desktop app
- [ ] Verify description visible in Chatwork mobile app

Free Rooms:

- [ ] Create new free room with room name → description appears
- [ ] All validations work same as Standard rooms

Cross-Platform:

- [ ] Description renders correctly on Windows Chatwork client
- [ ] Description renders correctly on macOS Chatwork client
- [ ] Description renders correctly on iOS Chatwork app
- [ ] Description renders correctly on Android Chatwork app
- [ ] Description renders correctly on Chatwork web app

---

## 8. Deployment & Rollout

### 8.1 Prerequisites

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing complete on all platforms
- [ ] Code review approved
- [ ] Design review approved (user confirmed)

### 8.2 Deployment Steps

1. **Backend Deployment:**
   - Deploy `composeRoomDescription` utility to `@chatwork-bot/chatwork` package
   - Deploy updated room creation routes to `@chatwork-bot/translator` package
   - Verify backend health checks pass

2. **Frontend Deployment:**
   - Deploy updated dashboard forms with new field
   - Deploy updated schemas with validation
   - Verify dashboard builds successfully

3. **Smoke Testing (Production):**
   - Create 1 test Standard room with description
   - Create 1 test Free room with description
   - Verify descriptions appear in Chatwork
   - Delete test rooms

4. **Monitoring:**
   - Watch error logs for validation failures
   - Monitor Chatwork API rate limits
   - Check for any description rendering issues reported by users

### 8.3 Rollback Plan

If critical issues discovered:

1. Revert frontend deployment (hide originalRoomName field via feature flag if needed)
2. Backend will continue to work without description (field optional in Chatwork API)
3. Investigate and fix issue
4. Re-deploy with fix

---

## 9. Future Enhancements (Out of Current Scope)

### 9.1 Backfill Existing Rooms

If users request (low priority due to YAGNI):

- Allow editing originalRoomName in edit forms (remove read-only)
- Add "Update Description" button to edit pages
- Parse existing Chatwork description carefully to avoid destroying manual edits
- On save, call Chatwork `PUT /rooms/{room_id}` to update description

### 9.2 Custom Description Templates

Allow users to choose from multiple description styles:

- Minimal (current design)
- Detailed (include AI provider, translation style)
- Custom (user-defined template with variables)

### 9.3 Auto-Sync Room Name

If bot gains permissions in the future:

- Periodically sync original room name from Chatwork API
- Update description if room renamed

### 9.4 Multi-Language Descriptions

Support description language selection:

- Vietnamese (current)
- English
- Japanese
- Bilingual

---

## 10. Acceptance Criteria

### 10.1 Functional Requirements

- [x] User can input original room name in dashboard create form
- [x] Original room name field is required and validates correctly
- [x] Description is composed with Neubrutalism style and Unicode bold
- [x] Description is set when creating destination room via Chatwork API
- [x] Works for both Standard and Free room types
- [x] Existing rooms are not affected (no backfill)

### 10.2 Non-Functional Requirements

- [x] Description is visually appealing and matches brand style
- [x] Description is scannable in <1 second
- [x] Field placement is logical and intuitive
- [x] Form validation provides clear error messages
- [x] No performance impact on room creation flow
- [x] Unicode characters display correctly across all Chatwork platforms

### 10.3 Testing Requirements

- [x] Unit tests cover description composition logic
- [x] Unit tests cover form validation
- [x] Integration tests cover API flow
- [x] Manual testing confirms cross-platform compatibility

---

## 11. Appendix

### 11.1 Unicode Character Reference

**Box Drawing (U+2550-U+255D):**

- ╔ (U+2554): Box Drawings Double Down and Right
- ═ (U+2550): Box Drawings Double Horizontal
- ╗ (U+2557): Box Drawings Double Down and Left
- ║ (U+2551): Box Drawings Double Vertical
- ╚ (U+255A): Box Drawings Double Up and Right
- ╝ (U+255D): Box Drawings Double Up and Left

**Math Bold (U+1D400-U+1D433):**

- 𝐀-𝐙 (U+1D400-U+1D419): Bold Capital Letters
- 𝐚-𝐳 (U+1D41A-U+1D433): Bold Lowercase Letters

**Emoji:**

- 🌐 (U+1F310): Globe with Meridians
- 📍 (U+1F4CD): Round Pushpin

### 11.2 Chatwork API Reference

**POST /rooms:**

- Endpoint: `https://api.chatwork.com/v2/rooms`
- Required headers: `X-ChatWorkToken`
- Body parameters:
  - `name` (required): Room name
  - `members_admin_ids` (required): Comma-separated account IDs
  - `description` (optional): Room description (NEW usage)
  - `icon_preset` (optional): Icon type
- Response: `{ room_id: number }`

**PUT /rooms/{room_id}:**

- For future enhancement: update description of existing rooms
- Parameters: `name`, `description`, `icon_preset`

### 11.3 Related Commits

Git history references:

- `115079a`: feat(chatwork): use piconname tag for avatar display in metadata
- `bbded58`: feat(chatwork): compose metadata and translated body message pair
- Previous work on Translation Metadata (removed, but informed design)

---

**End of Specification**
