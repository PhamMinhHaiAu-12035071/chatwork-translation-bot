import { create } from 'zustand'

interface RoomStore {
  rooms: unknown[]
}

export const useRoomStore = create<RoomStore>()(() => ({
  rooms: [],
}))
