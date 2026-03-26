# Dashboard Room Success Toast Design

**Date:** 2026-03-26

## Goal

Make room creation and room update success toasts identify the affected room by name, using the same quoted-room style as the room toggle toast.

## Current Behavior

- `RoomCreatePage` shows `Room created successfully!`
- `RoomDetailPage` shows `Room updated successfully!`

These messages confirm the action, but they do not say which room was created or updated.

## Approved UX

Use room-name-aware success copy:

- `"Sakura Desk JP" was created successfully`
- `"Sakura Desk JP" was updated successfully`

## Scope

In scope:

- Create-room success toast
- Update-room success toast
- Tests that lock the new wording

Out of scope:

- Webhook activation toast
- Delete toast
- Toggle toast behavior
- Toast styling or animation

## Design

Keep the change local and minimal:

1. Add a small pure helper in `RoomCreatePage` for create success copy.
2. Add a small pure helper in `RoomDetailPage` for update success copy.
3. Build toast text from `destinationRoomName` in submitted form data so the message reflects the actual room name saved by the action.
4. Update tests to assert the new wording and reject the generic success strings.

## Rationale

This keeps the wording consistent with the recent room toggle toast improvement while avoiding a larger toast abstraction that is not needed yet.
