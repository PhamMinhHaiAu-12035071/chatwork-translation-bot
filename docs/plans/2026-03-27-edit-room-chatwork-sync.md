# Edit Room Chatwork Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync destination room renames to Chatwork during room edit and redirect back to the dashboard list after a successful edit.

**Architecture:** Extend the Chatwork package with a minimal `updateRoom` API wrapper, make the translator room update route call Chatwork before persisting local name changes, and align the dashboard edit success flow with the existing create success navigation.

**Tech Stack:** Bun, TypeScript, Elysia, React Router, Zustand, Bun test

---

### Task 1: Add Chatwork update-room API coverage

**Files:**

- Modify: `packages/chatwork/src/http/chatwork-api-client.test.ts`
- Create: `packages/chatwork/src/services/update-room.test.ts`

**Step 1: Write the failing tests**

- Add a client test asserting `PUT https://api.chatwork.com/v2/rooms/{room_id}` with `X-ChatWorkToken` and form body `name=...`.
- Add a client error-path test asserting non-OK responses throw `ChatworkApiError`.
- Add a service wrapper test asserting `updateRoom()` forwards to the client correctly.

**Step 2: Run tests to verify they fail**

Run: `bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/update-room.test.ts`

Expected: failures because `updateRoom` does not exist yet.

**Step 3: Write minimal implementation**

- Add `UpdateRoomParams` in `packages/chatwork/src/types/room.ts`.
- Add `updateRoom` to `packages/chatwork/src/interfaces/chatwork-api.ts`.
- Implement `chatworkApiClient.updateRoom(...)` in `packages/chatwork/src/http/chatwork-api-client.ts`.
- Add `packages/chatwork/src/services/update-room.ts`.
- Export the new type and service from `packages/chatwork/src/index.ts`.

**Step 4: Run tests to verify they pass**

Run: `bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/update-room.test.ts`

Expected: PASS

### Task 2: Make translator room updates atomic with Chatwork rename

**Files:**

- Modify: `packages/translator/src/routes/rooms.ts`
- Modify: `packages/translator/src/routes/rooms.test.ts`

**Step 1: Write the failing tests**

- Add a route test asserting changed `destinationRoomName` calls Chatwork rename before local persistence.
- Add a route test asserting Chatwork rename failure returns `502` and leaves local data unchanged.
- Add a route test asserting unchanged room name skips the Chatwork rename call.

**Step 2: Run tests to verify they fail**

Run: `bun test packages/translator/src/routes/rooms.test.ts`

Expected: failures because the route does not call Chatwork rename yet.

**Step 3: Write minimal implementation**

- Import `updateRoom` from `@chatwork-bot/chatwork`.
- In `PUT /api/rooms/:id`, load the existing room first.
- When the requested `destinationRoomName` differs from the current one, call Chatwork rename first.
- On Chatwork failure, return `502` without calling `store.update(...)`.
- Otherwise persist the local patch as before.

**Step 4: Run tests to verify they pass**

Run: `bun test packages/translator/src/routes/rooms.test.ts`

Expected: PASS

### Task 3: Align dashboard edit success flow with create flow

**Files:**

- Modify: `packages/dashboard/src/pages/room-detail.tsx`
- Modify: `packages/dashboard/src/pages/room-detail.test.tsx`

**Step 1: Write the failing test**

- Extend the detail page source-based test to assert success flow navigates to `/` with `spotlightRoomId: result.data.id`.

**Step 2: Run test to verify it fails**

Run: `bun test packages/dashboard/src/pages/room-detail.test.tsx`

Expected: failure because the page currently stays on the detail route.

**Step 3: Write minimal implementation**

- After a successful `updateRoom(...)`, keep the success toast and add `navigate('/', { state: { spotlightRoomId: result.data.id } })`.

**Step 4: Run test to verify it passes**

Run: `bun test packages/dashboard/src/pages/room-detail.test.tsx`

Expected: PASS

### Task 4: Verify the changed surface together

**Files:**

- Modify: none

**Step 1: Run targeted verification**

Run: `bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/update-room.test.ts packages/translator/src/routes/rooms.test.ts packages/dashboard/src/pages/room-detail.test.tsx`

Expected: PASS

**Step 2: Run broader safety checks**

Run: `bun run typecheck`

Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`

Expected: PASS
