import { create } from 'zustand'
import { ApiError } from '~/lib/api-client'
import {
  freeRoomApiClient,
  type CreateFreeRoomInput,
  type FreeRoomConfigPublic,
  type UpdateFreeRoomInput,
} from '~/lib/free-room-api'
import type { DeleteRoomResult } from '~/lib/api-types'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export type FreeRoom = FreeRoomConfigPublic

interface FreeRoomStoreState {
  rooms: FreeRoom[]
  listState: LoadState
  listError: string | null
  actionError: string | null
  fetchFreeRooms: () => Promise<void>
  createFreeRoom: (input: CreateFreeRoomInput) => Promise<FreeRoom>
  updateFreeRoom: (id: string, input: UpdateFreeRoomInput) => Promise<FreeRoom>
  deleteFreeRoom: (id: string) => Promise<DeleteRoomResult>
  enableFreeRoom: (id: string) => Promise<void>
  disableFreeRoom: (id: string) => Promise<void>
  clearActionError: () => void
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function sortRoomsByCreatedAtDesc(rooms: FreeRoom[]): FreeRoom[] {
  return [...rooms].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function upsertRoom(rooms: FreeRoom[], nextRoom: FreeRoom): FreeRoom[] {
  const nextRooms = rooms.some((room) => room.id === nextRoom.id)
    ? rooms.map((room) => (room.id === nextRoom.id ? nextRoom : room))
    : [...rooms, nextRoom]

  return sortRoomsByCreatedAtDesc(nextRooms)
}

export const useFreeRoomStore = create<FreeRoomStoreState>()((set) => ({
  rooms: [],
  listState: 'idle',
  listError: null,
  actionError: null,

  fetchFreeRooms: async () => {
    set({ listState: 'loading', listError: null })

    try {
      const response = await freeRoomApiClient.listFreeRooms()
      set({
        rooms: sortRoomsByCreatedAtDesc(response.data ?? []),
        listState: 'success',
        listError: null,
      })
    } catch (error) {
      set({
        listState: 'error',
        listError: getErrorMessage(error, 'Failed to load free rooms'),
      })
    }
  },

  createFreeRoom: async (input) => {
    set({ actionError: null })

    try {
      const response = await freeRoomApiClient.createFreeRoom(input)
      const room = response.data
      if (room === undefined) {
        throw new Error('No data returned from createFreeRoom')
      }

      set((state) => ({
        rooms: sortRoomsByCreatedAtDesc([...state.rooms, room]),
        listState: 'success',
        listError: null,
      }))
      return room
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to create free room') })
      throw error
    }
  },

  updateFreeRoom: async (id, input) => {
    set({ actionError: null })

    try {
      const response = await freeRoomApiClient.updateFreeRoom(id, input)
      const room = response.data
      if (room === undefined) {
        throw new Error('No data returned from updateFreeRoom')
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
      return room
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to update free room') })
      throw error
    }
  },

  deleteFreeRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await freeRoomApiClient.deleteFreeRoom(id)
      const result = response.data
      if (result === undefined) {
        throw new Error('No data returned from deleteFreeRoom')
      }

      set((state) => ({ rooms: state.rooms.filter((room) => room.id !== id) }))
      return result
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to delete free room') })
      throw error
    }
  },

  enableFreeRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await freeRoomApiClient.enableFreeRoom(id)
      const room = response.data
      if (room === undefined) {
        return
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to enable free room') })
      throw error
    }
  },

  disableFreeRoom: async (id) => {
    set({ actionError: null })

    try {
      const response = await freeRoomApiClient.disableFreeRoom(id)
      const room = response.data
      if (room === undefined) {
        return
      }

      set((state) => ({ rooms: upsertRoom(state.rooms, room) }))
    } catch (error) {
      set({ actionError: getErrorMessage(error, 'Failed to disable free room') })
      throw error
    }
  },

  clearActionError() {
    set({ actionError: null })
  },
}))

export const selectFreeRooms = (state: FreeRoomStoreState) => state.rooms
export const selectFreeRoomById = (id: string) => (state: FreeRoomStoreState) =>
  state.rooms.find((room) => room.id === id)
export const selectFreeListState = (state: FreeRoomStoreState) => state.listState
export const selectFreeListError = (state: FreeRoomStoreState) => state.listError
export const selectFetchFreeRooms = (state: FreeRoomStoreState) => state.fetchFreeRooms
export const selectCreateFreeRoom = (state: FreeRoomStoreState) => state.createFreeRoom
export const selectUpdateFreeRoom = (state: FreeRoomStoreState) => state.updateFreeRoom
export const selectDeleteFreeRoom = (state: FreeRoomStoreState) => state.deleteFreeRoom
export const selectEnableFreeRoom = (state: FreeRoomStoreState) => state.enableFreeRoom
export const selectDisableFreeRoom = (state: FreeRoomStoreState) => state.disableFreeRoom
export type { DeleteRoomResult }
