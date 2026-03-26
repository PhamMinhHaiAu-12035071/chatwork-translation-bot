import { describe, expect, it } from 'bun:test'
import type { Room } from '~/stores/room-store'
import { useRoomStore } from '~/stores/room-store'

interface ExpectedRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: 'openai' | 'gemini'
  aiModel: string | null
  translationStyle: 'AUTO_CONTEXT' | 'NATURAL_CASUAL' | 'PROFESSIONAL_BUSINESS' | 'TECHNICAL'
  aiApiToken: string
}

const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-001',
    originalRoomId: 123456789,
    destinationRoomName: 'Sakura Desk JP',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-live-mock-001',
    webhookToken: 'cw-token-abc123',
    enabled: true,
    createdAt: '2026-03-20T09:00:00Z',
  },
  {
    id: 'room-002',
    originalRoomId: 987654321,
    destinationRoomName: 'Gamma Team EN',
    aiProvider: 'gemini',
    aiModel: null,
    translationStyle: 'TECHNICAL',
    aiApiToken: 'gemini-mock-002',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-22T14:30:00Z',
  },
]

function resetStore() {
  useRoomStore.setState({
    rooms: INITIAL_ROOMS.map((room) => ({ ...room })),
  })
}

describe('room store', () => {
  it('starts with the seeded rooms from the phase 3 plan', () => {
    const state = useRoomStore.getState() as {
      rooms: { id: string; destinationRoomName: string; enabled: boolean }[]
    }

    expect(state.rooms).toHaveLength(2)
    expect(state.rooms.map((room) => room.id)).toEqual(['room-001', 'room-002'])
    expect(state.rooms.map((room) => room.destinationRoomName)).toEqual([
      'Sakura Desk JP',
      'Gamma Team EN',
    ])
    expect(state.rooms.map((room) => room.enabled)).toEqual([true, false])
  })

  it('adds a room with generated metadata and disabled webhook state', () => {
    resetStore()

    const state = useRoomStore.getState() as {
      addRoom?: (room: ExpectedRoomInput) => string
      rooms: {
        id: string
        originalRoomId: number
        webhookToken: string | null
        enabled: boolean
        createdAt: string
      }[]
    }

    expect(typeof state.addRoom).toBe('function')
    if (!state.addRoom) {
      return
    }

    const id = state.addRoom({
      originalRoomId: 555001,
      destinationRoomName: 'Osaka Escalations',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: 'sk-new-room',
    })

    const createdRoom = useRoomStore.getState().rooms.find((room) => room.id === id) as
      | {
          id: string
          originalRoomId: number
          webhookToken: string | null
          enabled: boolean
          createdAt: string
        }
      | undefined

    expect(createdRoom).toBeDefined()
    expect(createdRoom?.originalRoomId).toBe(555001)
    expect(createdRoom?.webhookToken).toBeNull()
    expect(createdRoom?.enabled).toBe(false)
    expect(createdRoom?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('updates, toggles, activates, and deletes rooms through store actions', () => {
    resetStore()

    const state = useRoomStore.getState() as {
      updateRoom?: (id: string, patch: { destinationRoomName?: string }) => void
      toggleRoom?: (id: string) => void
      activateWebhook?: (id: string, webhookToken: string) => void
      deleteRoom?: (id: string) => void
    }

    expect(typeof state.updateRoom).toBe('function')
    expect(typeof state.toggleRoom).toBe('function')
    expect(typeof state.activateWebhook).toBe('function')
    expect(typeof state.deleteRoom).toBe('function')

    if (!state.updateRoom || !state.toggleRoom || !state.activateWebhook || !state.deleteRoom) {
      return
    }

    state.updateRoom('room-002', {
      destinationRoomName: 'Gamma Team APAC',
    })
    expect(
      useRoomStore.getState().rooms.find((room) => room.id === 'room-002')?.destinationRoomName,
    ).toBe('Gamma Team APAC')

    state.toggleRoom('room-002')
    expect(useRoomStore.getState().rooms.find((room) => room.id === 'room-002')?.enabled).toBe(true)

    state.activateWebhook('room-002', 'cw-live-002')
    const activatedRoom = useRoomStore.getState().rooms.find((room) => room.id === 'room-002')
    expect(activatedRoom?.webhookToken).toBe('cw-live-002')
    expect(activatedRoom?.enabled).toBe(true)

    state.deleteRoom('room-001')
    expect(useRoomStore.getState().rooms.map((room) => room.id)).toEqual(['room-002'])
  })
})
