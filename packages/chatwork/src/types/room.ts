export interface Room {
  room_id: number
  name: string
}

export interface CreateRoomParams {
  name: string
  /** Comma-separated list of account IDs for admins */
  members_admin_ids: string
  description?: string
  icon_preset?: string
}

export interface CreateRoomResult {
  room_id: number
}
