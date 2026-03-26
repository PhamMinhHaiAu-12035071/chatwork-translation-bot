# Dashboard Create Room List Spotlight Design

**Date:** 2026-03-26

## Goal

After creating a room successfully, return the user to the dashboard room list, place the new room at the top, and briefly spotlight it before the card settles back into the normal neubrutalism presentation.

## Current Behavior

- `RoomCreatePage` navigates to the new room detail route immediately after create success.
- `useRoomStore.createRoom()` appends the new room to the end of the local `rooms` array.
- `RoomListPage` does not receive any context about which room was just created, so the list has no transient focus state.

This works functionally, but it is not the strongest management-dashboard flow. The user finishes a create action and then lands in a single-room view instead of returning to the global list where they can confirm the new room exists in the system.

## Approved UX

- After a successful room creation, show the existing success toast and navigate back to the dashboard list (`/`).
- The newly created room must render as the first card in the list.
- That first card must auto-highlight for a short time, then return to its normal theme without user interaction.
- No auto-scroll is needed.

## Scope

In scope:

- Post-create redirect behavior
- Deterministic newest-first room ordering in the dashboard store
- Transient spotlight styling and timing for the newly created room card
- Tests that lock redirect, ordering, and spotlight behavior

Out of scope:

- Room detail page behavior after manual navigation
- Persistent pinning or starring of rooms
- Backend/API ordering changes
- New toast variants or copy changes

## Design

### 1. Redirect back to the list with explicit spotlight context

`RoomCreatePage` should stop navigating to `/rooms/:id` after success. Instead, it should navigate to `/` and pass route state containing the created room id, for example `spotlightRoomId`.

This keeps the create flow explicit: the create page owns the knowledge that a room was just created, and the list page owns the rendering of the transient highlight.

### 2. Make room ordering deterministic and newest-first

The dashboard store should own a single sorting rule for rooms: newest first by `createdAt`, with a stable fallback for ties if needed. That rule should be applied in both fetch and mutation paths so the list order does not drift between initial load, create success, and later refreshes.

This matters because client-only prepending is too brittle. If the list later refetches and the backend returns a different order, the new-room spotlight would appear disconnected from the actual card position.

### 3. Add a transient spotlight state in the list page

`RoomListPage` should read the route state on mount/navigation, copy `spotlightRoomId` into local component state, and clear it after a short timer of roughly 2.4 seconds. After consuming it, the page should also clear the route state to avoid replaying the spotlight on unrelated future navigations.

The spotlight state should be purely presentational. It should not live in the shared store because it is a one-shot routing concern, not domain data.

### 4. Match the existing neubrutalism language

The highlighted card should feel more “freshly stamped” than “glowing SaaS alert.” The motion and visuals should stay aligned with the dashboard’s current brutal cards, sticker labels, and hard-edged shadow treatment.

Recommended treatment:

- Temporarily shift the card background toward a brighter butter/lime accent
- Slightly strengthen the offset shadow and border contrast
- Show a small temporary sticker such as `New` or `Fresh`
- Animate color and shadow back to the base card state using `framer-motion`

This should avoid large scale or bounce animations that would break the dashboard’s compact card rhythm. If reduced motion is enabled, keep the highlight but drop the animated interpolation.

## Rationale

This flow better matches a room-management dashboard:

- create action returns the user to the overview they were managing
- the new room is immediately visible because it is first
- the transient spotlight removes the need to visually search for the new card

It is also small in surface area. The change stays local to the create page, room store, and list page, with no backend contract changes required.
