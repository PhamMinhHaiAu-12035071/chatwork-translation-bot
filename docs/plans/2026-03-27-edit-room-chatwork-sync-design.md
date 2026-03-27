# Edit Room Chatwork Sync Design

**Date:** 2026-03-27
**Status:** Approved
**Prepared by:** AI-assisted

## Objective

Make room edits update the Chatwork destination room name when `destinationRoomName` changes, and make the edit success flow return to the dashboard list just like room creation.

## Approved Decisions

- `edit room` must fail as a whole if Chatwork rename fails.
- `edit room` should mirror the current `create room` consistency model:
  Chatwork side effect first, local persistence second.
- Successful edit should show a success toast, navigate to `/`, and pass `spotlightRoomId`.

## Current Behavior

- `POST /api/rooms` creates the destination room on Chatwork first, then writes the local room config.
- `PUT /api/rooms/:id` only updates the local JSON-backed store.
- `RoomDetailPage` stays on the detail route after a successful save.

## Target Behavior

### Backend

When `PUT /api/rooms/:id` receives a changed `destinationRoomName`:

1. Load the existing room config.
2. Compare the current name to the requested name.
3. If the name changed, call Chatwork `PUT /rooms/{room_id}` first.
4. If the Chatwork call fails, return `502` and do not persist any local changes from that request.
5. If the Chatwork call succeeds, persist the local update.

If `destinationRoomName` did not change, skip the Chatwork rename and keep the current local-only update behavior for the remaining fields.

### Frontend

After a successful edit:

1. Show the existing success toast with the updated room name.
2. Navigate back to `/`.
3. Pass `{ spotlightRoomId: result.data.id }` in router state.

## Consistency Model

This intentionally mirrors the existing create flow. It does not attempt a compensating rollback if Chatwork rename succeeds but local persistence fails afterward. That residual inconsistency risk already exists in room creation and remains out of scope for this change.

## Testing Strategy

- Add Chatwork client coverage for `PUT /rooms/{room_id}`.
- Add translator route coverage for:
  - rename success
  - rename failure blocking local persistence
  - no rename call when the name is unchanged
- Update dashboard detail page coverage to assert redirect-to-list behavior after successful save.

## Out of Scope

- Compensating rollback when Chatwork rename succeeds but local persistence fails.
- Syncing any Chatwork fields other than room name.
- Broader dashboard flow changes unrelated to edit success behavior.
