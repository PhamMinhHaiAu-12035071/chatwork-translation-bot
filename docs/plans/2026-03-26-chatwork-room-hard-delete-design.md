# Chatwork Room Hard Delete Design

**Date:** 2026-03-26
**Status:** Approved for implementation planning

## Goal

Make dashboard room deletion perform a real destructive delete against Chatwork, not just remove
the local bot configuration. The final behavior must match Chatwork's destructive-delete semantics
while staying visually consistent with the existing neubrutalism dashboard.

## Problem

The current implementation deletes only the local room config:

- `POST /api/rooms` creates the destination room on Chatwork
- `DELETE /api/rooms/:id` only removes the local config from the translator store
- the dashboard modal copy currently says the delete only affects the dashboard list

That behavior leaves a real destination room alive on Chatwork even though the dashboard reports
that the room was deleted.

## External References

- Chatwork API delete-room endpoint:
  `https://developer.chatwork.com/reference/delete-rooms-room_id`
- Chatwork OAuth scope appendix showing `rooms:write` covers `DELETE /rooms/{room_id}`:
  `https://developer.chatwork.com/docs/oauth`
- Chatwork help article showing admin-only delete and the three destructive confirmations:
  `https://help.chatwork.com/hc/ja/articles/900004316923-%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97%E3%83%81%E3%83%A3%E3%83%83%E3%83%88-%E3%83%80%E3%82%A4%E3%83%AC%E3%82%AF%E3%83%88%E3%83%81%E3%83%A3%E3%83%83%E3%83%88%E3%81%8C%E5%89%8A%E9%99%A4%E3%81%95%E3%82%8C%E3%81%BE%E3%81%97%E3%81%9F`

## Approved Product Decisions

These decisions were confirmed during the design interview:

- Delete must remove the destination room on Chatwork, not only local dashboard state.
- The system must perform a true hard delete with no local archive or recovery record.
- If Chatwork returns `404` for the destination room, treat it as already deleted and still clean
  up the local config.
- If Chatwork delete fails with any non-`404` error, keep the local config and surface the error
  to the dashboard.
- The dashboard must warn clearly that the source-room webhook still needs to be removed manually
  in Chatwork Admin because the bot cannot automate that cleanup.
- The dashboard delete modal should visually match the existing neubrutalism system and borrow the
  three destructive confirmation points from Chatwork's native delete UI.

## Scope

### In scope

- Add Chatwork room-deletion support to `@chatwork-bot/chatwork`
- Change translator delete flow to Chatwork-first hard delete
- Remove local room-config archiving from room deletion
- Change dashboard delete confirmation UX and copy
- Add delete outcome reporting for `deleted` vs `already_deleted`
- Update tests covering HTTP client, translator routes, store behavior, dashboard modal, and toast
  handling

### Out of scope

- Automatic removal of the source-room webhook in Chatwork Admin
- Any recovery or restore flow for deleted rooms
- Deleting or repairing historical orphan configs outside the current delete action
- Introducing background jobs or async delete orchestration
- Changing room creation, enable, disable, or translation logic beyond what delete flow now needs

## Architecture

## High-level flow

```text
Dashboard delete confirm
  -> DELETE /api/rooms/:id
  -> translator loads room config by local id
  -> translator calls Chatwork DELETE /rooms/{destinationRoomId}
       -> 2xx: continue
       -> 404: treat as already deleted, continue
       -> other error: stop and return error
  -> translator hard-deletes local config
  -> translator returns outcome:
       - deleted
       - already_deleted
  -> dashboard updates local state and shows matching toast
```

## Package responsibilities

### `@chatwork-bot/chatwork`

Add one new capability:

- `deleteRoom(roomId, token): Promise<void>`

This will:

- call `DELETE https://api.chatwork.com/v2/rooms/{room_id}`
- reuse the existing error mapping through `ChatworkApiError` and `ChatworkRateLimitError`
- expose the new helper through the package barrel

### `@chatwork-bot/translator`

The translator owns orchestration and local state mutation:

- load room config by local id
- call Chatwork delete for the stored `destinationRoomId`
- classify `404` as `already_deleted`
- remove local config only after successful remote delete or `404`
- surface a structured success response back to the dashboard

### `packages/dashboard`

The dashboard owns the destructive UX:

- require three destructive confirmation checkboxes before enabling the final delete button
- show a separate manual-cleanup warning for the source-room webhook
- keep the visual system aligned with the current neubrutalism modal style
- show distinct success messaging for:
  - room deleted on Chatwork and dashboard
  - room already missing on Chatwork, local config cleaned up

## API Contract

## `DELETE /api/rooms/:id`

### Success

```ts
{
  success: true,
  data: {
    outcome: 'deleted' | 'already_deleted'
  }
}
```

### Errors

- `404` when the local room config id does not exist
- `502` when Chatwork delete fails with any non-`404` upstream error
- `500` when Chatwork delete succeeded but local hard delete failed afterward

### Notes

- `204 No Content` is intentionally replaced with a JSON success envelope so the dashboard can
  distinguish normal delete from the already-deleted cleanup path.
- The translator should preserve the current error-envelope shape:
  `{ error: string, details?: unknown }`

## Data and Business Rules

- Local room identity continues to be the UUID config id in `room-configs.json`.
- Remote destructive delete targets `destinationRoomId`.
- Local delete must not append to `room-configs-archive.json`.
- A Chatwork `404` is treated as terminal success for local cleanup because the desired remote end
  state already exists: the room no longer exists.
- A Chatwork `401`, `403`, `429`, or `5xx` must abort local deletion.
- If Chatwork delete succeeds but local delete fails, the system must not attempt to recreate the
  remote room because the operation is irreversible and recreation would not restore the deleted
  state anyway.

## UX / UI

The delete modal stays inside the existing dashboard neubrutalism visual language:

- thick dark border
- offset drop shadow
- cream / blush surfaces
- Shantell Sans headings and Zen Maru Gothic body copy
- strong red CTA reserved for the irreversible delete action

### Modal structure

- sticker label
- destructive title: `Delete <room name>?`
- Chatwork-style pre-delete checklist with three required checkboxes
- separate warning panel about manual source-room webhook removal
- mini room preview card
- actions:
  - `Cancel`
  - `Delete (I have confirmed)`

### Checklist copy

- deleting applies to everyone in the group chat
- messages, tasks, files, and bookmarks are deleted
- deleted data cannot be restored

### Warning panel copy

- source-room webhook cleanup remains manual in Chatwork Admin
- deleting the destination room does not remove the webhook from the source room

## Failure Handling

### Remote delete fails before local cleanup

- local config remains unchanged
- dashboard shows error toast
- modal stays dismissible

### Remote delete returns `404`

- local config is still removed
- dashboard shows a warning-style success toast indicating Chatwork room was already gone

### Remote delete succeeds but local delete fails

- API returns `500`
- translator logs a structured error including:
  - local room id
  - destination room id
  - delete outcome reached before failure
- no recovery attempt is made

## Testing Strategy

### Chatwork package

- unit tests for `deleteRoom()` success and error mapping
- HTTP client tests for `DELETE /rooms/{room_id}`
- barrel export coverage through existing import paths

### Translator

- route tests for:
  - normal delete
  - already deleted (`404`)
  - Chatwork failure aborting local cleanup
  - local room missing
- store tests updated so delete no longer archives

### Dashboard

- API client tests for delete success envelope
- store tests for delete outcome handling
- modal tests for:
  - three destructive confirmations
  - disabled CTA until all are checked
  - manual webhook warning copy
  - updated destructive button label
- page integration tests for delete flow wiring and toast copy

## Acceptance Criteria

- Deleting a room from the dashboard removes the destination room on Chatwork.
- Local config is removed only after Chatwork confirms deletion or returns `404`.
- No new room record is appended to `data/room-configs-archive.json`.
- Dashboard modal requires all three destructive confirmations before delete is possible.
- Dashboard warns that source-room webhook removal is still manual.
- A remote `404` still cleans up the local config and surfaces an `already_deleted` outcome.
- Non-`404` Chatwork failures leave the local config intact and surface an error.

## Risks and Trade-offs

- The local system can still become temporarily inconsistent if Chatwork delete succeeds but local
  persistence fails. This is accepted because the delete is irreversible and no meaningful rollback
  exists.
- Removing local archive reduces operational recovery options by design. This is intentional and
  matches the approved product direction that keeping recovery metadata no longer has value once the
  Chatwork room is truly gone.
