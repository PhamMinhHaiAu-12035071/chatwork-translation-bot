import { create } from 'zustand'
import { apiClient, ApiError } from '~/lib/api-client'
import type {
  AiProvider,
  CreateRoomInput,
  DeleteRoomResult,
  ProviderInfo,
  RoomConfigPublic,
  TranslationStyle,
  UpdateRoomInput,
} from '~/lib/api-types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export type { AiProvider, TranslationStyle }
export type Room = RoomConfigPublic

interface RoomStoreState {
  rooms: Room[]
  providers: ProviderInfo[]
  listState: LoadState
  listError: string | null
  actionError: string | null
  fetchRooms: () => Promise<void>
  fetchProviders: () => Promise<void>
  createRoom: (input: CreateRoomInput) => Promise<Room>
  updateRoom: (id: string, input: UpdateRoomInput) => Promise<Room>
  deleteRoom: (id: string) => Promise<DeleteRoomResult>
  enableRoom: (id: string) => Promise<void>
  disableRoom: (id: string) => Promise<void>
  clearActionError: () => void
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function upsertRoom(rooms: Room[], nextRoom: Room): Room[] {
  return rooms.some((room) => room.id === nextRoom.id)
    ? rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))
    : [...rooms, nextRoom]
}

export const useRoomStore = create<RoomStoreState>()((set) => ({
  rooms: [],
  providers: [],
  listState: 'idle',
  listError: null,
  actionError: null,

  fetchRooms: async () => {
    set({ listState: 'loading', listError: null })

    try {
      const response = await apiClient.listRooms()
      set({
        rooms: response.data ?? [],
        listState: 'success',
        listError: null,
      })
    } catch (error) {
      set({
        listState: 'error',
        listError: getErrorMessage(error, 'Failed to load rooms'),
      })
    }
  },

  fetchProviders: async () => {
    try {
      const response = await apiClient.listProviders()
      set({ providers: response.data ?? [] })
    } catch {
      set({ providers: [] })
    }
  },

  createRoom: async (input) => {
    set({ actionError: null })

    try {
      const response = await apiClient.createRoom(input)
      const room = response.data
      if (room === undefined) {
        throw new Error('No data returned from createRoom')
      }

      set((state) => ({ rooms: [...state.rooms, room] }))
      return room
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to create room') })
      throw error
    }
  },

  updateRoom: async (id, input) => {
    set({ actionError: null })

    try {
      const response = await apiClient.updateRoom(id, input)
      const room = response.data
      if (room === undefined) {
        throw new Error('No data returned from updateRoom')
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
      return room
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to update room') })
      throw error
    }
  },

  deleteRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await apiClient.deleteRoom(id)
      const result = response.data
      if (result === undefined) {
        throw new Error('No data returned from deleteRoom')
      }

      set((state) => ({ rooms: state.rooms.filter((room) => room.id !== id) }))
      return result
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to delete room') })
      throw error
    }
  },

  enableRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await apiClient.enableRoom(id)
      const room = response.data
      if (room === undefined) {
        return
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to enable room') })
      throw error
    }
  },

  disableRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await apiClient.disableRoom(id)
      const room = response.data
      if (room === undefined) {
        return
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to disable room') })
      throw error
    }
  },

  clearActionError() {
    set({ actionError: null })
  },
}))

export const selectRooms = (state: RoomStoreState) => state.rooms
export const selectRoomById = (id: string) => (state: RoomStoreState) =>
  state.rooms.find((room) => room.id === id)
export const selectListState = (state: RoomStoreState) => state.listState
export const selectListError = (state: RoomStoreState) => state.listError
export const selectFetchRooms = (state: RoomStoreState) => state.fetchRooms
export const selectCreateRoom = (state: RoomStoreState) => state.createRoom
export const selectUpdateRoom = (state: RoomStoreState) => state.updateRoom
export const selectDeleteRoom = (state: RoomStoreState) => state.deleteRoom
export const selectEnableRoom = (state: RoomStoreState) => state.enableRoom
export const selectDisableRoom = (state: RoomStoreState) => state.disableRoom
export type { DeleteRoomResult }
