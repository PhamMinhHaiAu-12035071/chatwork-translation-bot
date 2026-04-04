import type { DeleteRoomResult } from '~/lib/api-types'

export const toastMessages = {
  roomCreated: (name: string) => `"${name}" was created successfully`,
  roomUpdated: (name: string) => `"${name}" was updated successfully`,
  roomDeleted: (name: string, outcome: DeleteRoomResult['outcome']) => {
    if (outcome === 'already_deleted') {
      return `Room "${name}" was already gone on Chatwork. Dashboard cleanup is complete`
    }
    return `Room "${name}" deleted from Chatwork and dashboard`
  },
  roomEnabled: (name: string) => `"${name}" is now enabled`,
  roomDisabled: (name: string) => `"${name}" is now paused`,
}
