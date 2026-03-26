# Chatwork Room Hard Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dashboard room deletion perform a real Chatwork room delete, then hard-delete the
local config with no archive, while updating the dashboard modal and toasts to match the new
destructive semantics.

**Architecture:** The translator becomes a Chatwork-first delete orchestrator: it loads the local
room config, calls Chatwork `DELETE /rooms/{destinationRoomId}`, treats remote `404` as
`already_deleted`, and only then removes the local config. The dashboard consumes a JSON delete
outcome and updates its neubrutalist destructive-confirm UX to require three explicit
confirmations plus a manual webhook warning.

**Tech Stack:** TypeScript, Elysia, React 19, Zustand, bun:test

**Spec:** `docs/plans/2026-03-26-chatwork-room-hard-delete-design.md`

---

### Task 1: Add Chatwork room-delete support

**Files:**

- Modify: `packages/chatwork/src/interfaces/chatwork-api.ts`
- Modify: `packages/chatwork/src/http/chatwork-api-client.ts`
- Modify: `packages/chatwork/src/http/chatwork-api-client.test.ts`
- Create: `packages/chatwork/src/services/delete-room.ts`
- Create: `packages/chatwork/src/services/delete-room.test.ts`
- Modify: `packages/chatwork/src/index.ts`

**Step 1: Write the failing tests**

- add `deleteRoom()` coverage to `chatwork-api-client.test.ts`
- add service-level `delete-room.test.ts`
- assert the client sends `DELETE /rooms/{room_id}` with `X-ChatWorkToken`

**Step 2: Run the new failing tests**

Run:
`bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/delete-room.test.ts`

Expected:

- `deleteRoom` tests fail because the method and service do not exist yet

**Step 3: Write the minimal implementation**

- extend `IChatworkApiClient` with `deleteRoom(roomId, token): Promise<void>`
- implement the method in `chatwork-api-client.ts`
- add `services/delete-room.ts`
- export `deleteRoom` from `packages/chatwork/src/index.ts`

**Step 4: Run the tests again**

Run:
`bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/delete-room.test.ts`

Expected:

- both test files pass

### Task 2: Convert local delete to hard-delete with no archive

**Files:**

- Modify: `packages/translator/src/services/room-config-store.ts`
- Modify: `packages/translator/src/services/room-config-store.test.ts`

**Step 1: Write the failing tests**

- update the store delete test to assert the room is removed without archive expectations
- add a test that no `room-configs-archive.json` file is required for delete to succeed

**Step 2: Run the failing store test**

Run:
`bun test packages/translator/src/services/room-config-store.test.ts`

Expected:

- delete-related assertions fail against the old archive behavior

**Step 3: Write the minimal implementation**

- remove archive append logic from `RoomConfigStore.delete()`
- keep delete atomic for `room-configs.json`

**Step 4: Run the store test again**

Run:
`bun test packages/translator/src/services/room-config-store.test.ts`

Expected:

- store tests pass

### Task 3: Make translator delete Chatwork-first and return an outcome envelope

**Files:**

- Modify: `packages/translator/src/routes/rooms.ts`
- Modify: `packages/translator/src/routes/rooms.test.ts`

**Step 1: Write the failing route tests**

- mock `deleteRoom` from `@chatwork-bot/chatwork`
- add tests for:
  - `deleted`
  - `already_deleted` on Chatwork `404`
  - non-`404` Chatwork failure aborting local cleanup
- change existing delete expectations from `204` to `200` with outcome JSON

**Step 2: Run the failing route tests**

Run:
`bun test packages/translator/src/routes/rooms.test.ts`

Expected:

- delete-route assertions fail because the route still returns `204` and never calls Chatwork

**Step 3: Write the minimal implementation**

- import `deleteRoom` from `@chatwork-bot/chatwork`
- load the room config before delete
- call remote delete first
- treat `ChatworkApiError` with `statusCode === 404` as `already_deleted`
- on success or `404`, delete the local config and return:
  `{"success":true,"data":{"outcome":"deleted"|"already_deleted"}}`
- keep `404` for missing local room config
- return `502` for non-`404` Chatwork delete failures

**Step 4: Run the route tests again**

Run:
`bun test packages/translator/src/routes/rooms.test.ts`

Expected:

- route tests pass

### Task 4: Update dashboard delete contracts and state handling

**Files:**

- Modify: `packages/dashboard/src/lib/api-types.ts`
- Modify: `packages/dashboard/src/lib/api-client.ts`
- Modify: `packages/dashboard/src/lib/api-client.test.ts`
- Modify: `packages/dashboard/src/stores/room-store.ts`
- Modify: `packages/dashboard/src/stores/room-store.test.ts`

**Step 1: Write the failing dashboard data tests**

- add a delete outcome type to the test expectations
- update `api-client.test.ts` so delete expects a `200` JSON envelope instead of `204`
- update room-store tests to consume and return the delete outcome

**Step 2: Run the failing dashboard data tests**

Run:
`bun test packages/dashboard/src/lib/api-client.test.ts packages/dashboard/src/stores/room-store.test.ts`

Expected:

- delete client/store assertions fail because the code still assumes `204`

**Step 3: Write the minimal implementation**

- add a `DeleteRoomOutcome` type
- change `apiClient.deleteRoom()` to return the success envelope with outcome data
- change the room store delete action to return the delete outcome after removing the room from
  local state

**Step 4: Run the dashboard data tests again**

Run:
`bun test packages/dashboard/src/lib/api-client.test.ts packages/dashboard/src/stores/room-store.test.ts`

Expected:

- both test files pass

### Task 5: Upgrade the delete modal to match Chatwork destructive semantics

**Files:**

- Modify: `packages/dashboard/src/components/organisms/delete-room-confirm-modal.tsx`
- Modify: `packages/dashboard/src/components/organisms/delete-room-confirm-modal.test.tsx`
- Modify: `packages/dashboard/src/pages/room-list.tsx`
- Modify: `packages/dashboard/src/pages/room-list.test.tsx`
- Modify: `packages/dashboard/src/styles/global.css`

**Step 1: Write the failing UI tests**

- add modal tests for:
  - three required checkboxes
  - disabled destructive CTA until all are checked
  - manual webhook warning panel
  - updated destructive button label
- update room-list tests to assert delete toast handling for `deleted` and `already_deleted`

**Step 2: Run the failing UI tests**

Run:
`bun test packages/dashboard/src/components/organisms/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- modal and room-list tests fail against the old lightweight delete copy

**Step 3: Write the minimal implementation**

- add three checkbox confirmations to the modal
- disable the destructive button until all are checked
- add the manual webhook warning panel
- update CTA label to `Delete (I have confirmed)`
- keep styling aligned with existing neubrutalism tokens and class patterns in `global.css`
- update room-list delete handling so toast copy matches `deleted` vs `already_deleted`

**Step 4: Run the UI tests again**

Run:
`bun test packages/dashboard/src/components/organisms/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- modal and page tests pass

### Task 6: Verify the integrated change

**Files:**

- Verify only:
  - `packages/chatwork/src/**/*`
  - `packages/translator/src/**/*`
  - `packages/dashboard/src/**/*`
  - `docs/plans/2026-03-26-chatwork-room-hard-delete-design.md`

**Step 1: Run targeted package tests**

Run:
`bun test packages/chatwork/src/http/chatwork-api-client.test.ts packages/chatwork/src/services/delete-room.test.ts packages/translator/src/services/room-config-store.test.ts packages/translator/src/routes/rooms.test.ts packages/dashboard/src/lib/api-client.test.ts packages/dashboard/src/stores/room-store.test.ts packages/dashboard/src/components/organisms/delete-room-confirm-modal.test.tsx packages/dashboard/src/pages/room-list.test.tsx`

Expected:

- all targeted tests pass

**Step 2: Run package-level type checks**

Run:

- `bun run --cwd packages/dashboard typecheck`
- `bun run typecheck`

Expected:

- type checks pass

**Step 3: Run lint**

Run:
`bun run lint`

Expected:

- lint passes

**Step 4: Run the repo validation gate**

Run:
`bun test && bun run typecheck && bun run lint`

Expected:

- full validation passes
