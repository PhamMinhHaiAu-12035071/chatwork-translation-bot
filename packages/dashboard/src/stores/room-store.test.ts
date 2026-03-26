import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ApiError, apiClient } from '~/lib/api-client'
import type {
  CreateRoomInput,
  DeleteRoomResult,
  ProviderInfo,
  RoomConfigPublic,
  UpdateRoomInput,
} from '~/lib/api-types'
import { useRoomStore } from '~/stores/room-store'

const LIST_ROOMS_RAW: [RoomConfigPublic, RoomConfigPublic] = [
  {
    id: 'room-001',
    originalRoomId: 123456789,
    destinationRoomId: 99001,
    destinationRoomName: 'Sakura Desk JP',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    enabled: true,
    createdAt: '2026-03-20T09:00:00Z',
    updatedAt: '2026-03-20T09:00:00Z',
  },
  {
    id: 'room-002',
    originalRoomId: 555001,
    destinationRoomId: 99002,
    destinationRoomName: 'Osaka Escalations',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    translationStyle: 'AUTO_CONTEXT',
    enabled: false,
    createdAt: '2026-03-26T12:00:00Z',
    updatedAt: '2026-03-26T12:00:00Z',
  },
]

const OLDER_ROOM = LIST_ROOMS_RAW[0]
const NEWER_ROOM = LIST_ROOMS_RAW[1]
const ORDERED_ROOMS = [NEWER_ROOM, OLDER_ROOM]

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-5.4', 'gpt-4o'],
    defaultModel: 'gpt-5.4',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-pro',
  },
]

const CREATED_ROOM: RoomConfigPublic = {
  id: 'room-002',
  originalRoomId: 555001,
  destinationRoomId: 99002,
  destinationRoomName: 'Osaka Escalations',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  translationStyle: 'AUTO_CONTEXT',
  enabled: false,
  createdAt: '2026-03-26T12:00:00Z',
  updatedAt: '2026-03-26T12:00:00Z',
}

const UPDATED_ROOM: RoomConfigPublic = {
  ...CREATED_ROOM,
  destinationRoomName: 'Osaka Escalations APAC',
  updatedAt: '2026-03-26T12:10:00Z',
}

const ENABLED_ROOM: RoomConfigPublic = {
  ...UPDATED_ROOM,
  enabled: true,
  updatedAt: '2026-03-26T12:11:00Z',
}

type ListRoomsSpy = ReturnType<typeof spyOn<typeof apiClient, 'listRooms'>>
type ListProvidersSpy = ReturnType<typeof spyOn<typeof apiClient, 'listProviders'>>
type CreateRoomSpy = ReturnType<typeof spyOn<typeof apiClient, 'createRoom'>>
type UpdateRoomSpy = ReturnType<typeof spyOn<typeof apiClient, 'updateRoom'>>
type DeleteRoomSpy = ReturnType<typeof spyOn<typeof apiClient, 'deleteRoom'>>
type EnableRoomSpy = ReturnType<typeof spyOn<typeof apiClient, 'enableRoom'>>
type DisableRoomSpy = ReturnType<typeof spyOn<typeof apiClient, 'disableRoom'>>

let listRoomsSpy: ListRoomsSpy
let listProvidersSpy: ListProvidersSpy
let createRoomSpy: CreateRoomSpy
let updateRoomSpy: UpdateRoomSpy
let deleteRoomSpy: DeleteRoomSpy
let enableRoomSpy: EnableRoomSpy
let disableRoomSpy: DisableRoomSpy

function resetStoreState() {
  useRoomStore.setState({
    rooms: [],
    providers: [],
    listState: 'idle',
    listError: null,
    actionError: null,
  })
}

function seedOrderedRooms(rooms: RoomConfigPublic[] = ORDERED_ROOMS) {
  useRoomStore.setState({
    rooms,
    providers: PROVIDERS,
    listState: 'success',
    listError: null,
    actionError: null,
  })
}

beforeEach(() => {
  listRoomsSpy = spyOn(apiClient, 'listRooms').mockImplementation(() =>
    Promise.resolve({ success: true, data: LIST_ROOMS_RAW }),
  )
  listProvidersSpy = spyOn(apiClient, 'listProviders').mockImplementation(() =>
    Promise.resolve({ success: true, data: PROVIDERS }),
  )
  createRoomSpy = spyOn(apiClient, 'createRoom').mockImplementation((_input: CreateRoomInput) =>
    Promise.resolve({ success: true, data: CREATED_ROOM }),
  )
  updateRoomSpy = spyOn(apiClient, 'updateRoom').mockImplementation(
    (_id: string, _input: UpdateRoomInput) =>
      Promise.resolve({
        success: true,
        data: UPDATED_ROOM,
      }),
  )
  deleteRoomSpy = spyOn(apiClient, 'deleteRoom').mockImplementation((_id: string) =>
    Promise.resolve({ success: true, data: { outcome: 'deleted' } }),
  )
  enableRoomSpy = spyOn(apiClient, 'enableRoom').mockImplementation((_id: string) =>
    Promise.resolve({ success: true, data: ENABLED_ROOM }),
  )
  disableRoomSpy = spyOn(apiClient, 'disableRoom').mockImplementation((_id: string) =>
    Promise.resolve({ success: true, data: UPDATED_ROOM }),
  )

  resetStoreState()
})

afterEach(() => {
  listRoomsSpy.mockRestore()
  listProvidersSpy.mockRestore()
  createRoomSpy.mockRestore()
  updateRoomSpy.mockRestore()
  deleteRoomSpy.mockRestore()
  enableRoomSpy.mockRestore()
  disableRoomSpy.mockRestore()
})

describe('room store', () => {
  it('defines selector helpers that are actually consumed by dashboard pages', async () => {
    const source = await Bun.file(new URL('./room-store.ts', import.meta.url)).text()

    expect(source).toContain('export const selectRooms =')
    expect(source).toContain('export const selectRoomById = (id: string) =>')
    expect(source).toContain('export const selectFetchRooms =')
    expect(source).toContain('export const selectCreateRoom =')
    expect(source).toContain('export const selectUpdateRoom =')
    expect(source).toContain('export const selectEnableRoom =')
    expect(source).toContain('export const selectDisableRoom =')
    expect(source).toContain('export const selectDeleteRoom =')
    expect(source).not.toContain('export const selectProviders =')
    expect(source).not.toContain('export const selectIsLoading =')
    expect(source).not.toContain('export const selectFetchProviders =')
  })

  it('hydrates rooms and listState from the API client', async () => {
    const state = useRoomStore.getState()

    expect(state.rooms).toEqual([])
    expect(state.listState).toBe('idle')

    await state.fetchRooms()

    const nextState = useRoomStore.getState()
    expect(listRoomsSpy).toHaveBeenCalledTimes(1)
    expect(nextState.rooms).toEqual([LIST_ROOMS_RAW[1], LIST_ROOMS_RAW[0]])
    expect(nextState.listState).toBe('success')
    expect(nextState.listError).toBeNull()
  })

  it('captures ApiError messages when fetching rooms fails', async () => {
    listRoomsSpy.mockImplementationOnce(() => Promise.reject(new ApiError('Network error', 503)))

    await useRoomStore.getState().fetchRooms()

    const nextState = useRoomStore.getState()
    expect(nextState.listState).toBe('error')
    expect(nextState.listError).toBe('Network error')
  })

  it('loads provider metadata for the create and edit forms', async () => {
    await useRoomStore.getState().fetchProviders()

    expect(listProvidersSpy).toHaveBeenCalledTimes(1)
    expect(useRoomStore.getState().providers).toEqual(PROVIDERS)
  })

  it('inserts newly created rooms ahead of older rooms', async () => {
    useRoomStore.setState({
      rooms: [OLDER_ROOM],
      providers: PROVIDERS,
      listState: 'idle',
      listError: null,
      actionError: null,
    })

    const created = await useRoomStore.getState().createRoom({
      originalRoomId: 555001,
      destinationRoomName: 'Osaka Escalations',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: 'sk-new-room',
      webhookSecret: 'cw-secret-555001',
    })

    expect(created).toEqual(CREATED_ROOM)
    expect(useRoomStore.getState().rooms).toEqual([CREATED_ROOM, OLDER_ROOM])
    expect(useRoomStore.getState().listState).toBe('success')
    expect(useRoomStore.getState().listError).toBeNull()
  })

  it('keeps the newest room first while updating, enabling, disabling, and deleting rooms', async () => {
    seedOrderedRooms()

    const updated = await useRoomStore.getState().updateRoom(CREATED_ROOM.id, {
      destinationRoomName: 'Osaka Escalations APAC',
      webhookSecret: 'cw-secret-rotated',
    })
    expect(updated).toEqual(UPDATED_ROOM)
    expect(useRoomStore.getState().rooms).toEqual([UPDATED_ROOM, OLDER_ROOM])

    await useRoomStore.getState().enableRoom(CREATED_ROOM.id)
    expect(useRoomStore.getState().rooms).toEqual([ENABLED_ROOM, OLDER_ROOM])

    await useRoomStore.getState().disableRoom(CREATED_ROOM.id)
    expect(useRoomStore.getState().rooms).toEqual([UPDATED_ROOM, OLDER_ROOM])

    const deleteResult = await useRoomStore.getState().deleteRoom(CREATED_ROOM.id)
    expect(deleteResult).toEqual<DeleteRoomResult>({ outcome: 'deleted' })
    expect(useRoomStore.getState().rooms).toEqual([OLDER_ROOM])
  })
})
