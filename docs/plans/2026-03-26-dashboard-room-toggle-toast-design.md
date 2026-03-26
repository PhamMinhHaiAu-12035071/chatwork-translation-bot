# Dashboard Room Toggle Toast Design

**Date:** 2026-03-26

## Goal

Make the room toggle toast on the dashboard clearly identify which room was enabled or paused.

## Current Behavior

`RoomListPage` toggles a room and shows a generic toast:

- `Room enabled`
- `Room disabled`

This confirms the action happened, but it does not tell the operator which room was affected.

## Approved UX

When the user toggles a room from the dashboard list, the toast should include the room name:

- `"Sakura Desk JP" is now enabled`
- `"Sakura Desk JP" is now paused`

## Scope

In scope:

- Dashboard room list toggle toast copy
- Tests covering the new message format

Out of scope:

- Other dashboard toasts
- Room detail page messaging
- Toast styling or motion behavior

## Design

Keep the change local to `RoomListPage`.

1. Add a small helper that builds the toggle toast message from:
   - `destinationRoomName`
   - current enabled state
2. Update the toggle handler to receive the room name and emit the approved copy.
3. Update tests to lock the wording and wiring.

## Rationale

This is the smallest change that improves clarity without introducing a new toast abstraction or changing unrelated message copy.
