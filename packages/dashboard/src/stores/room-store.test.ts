import { describe, expect, it } from 'bun:test'
import type { Room } from '~/stores/room-store'
import { SEEDED_ROOMS, useRoomStore } from '~/stores/room-store'

interface ExpectedRoomInput {
  originalRoomId: number
  destinationRoomName: string
  aiProvider: 'openai' | 'gemini'
  aiModel: string | null
  translationStyle: 'AUTO_CONTEXT' | 'NATURAL_CASUAL' | 'PROFESSIONAL_BUSINESS' | 'TECHNICAL'
  aiApiToken: string
}

const INITIAL_ROOMS: Room[] = SEEDED_ROOMS.map((room) => ({ ...room }))

function resetStore() {
  useRoomStore.setState({
    rooms: INITIAL_ROOMS.map((room) => ({ ...room })),
  })
}

describe('room store', () => {
  it('starts with a scrolling-sized seeded dataset for dashboard QA', () => {
    const state = useRoomStore.getState() as {
      rooms: { id: string; destinationRoomName: string; enabled: boolean }[]
    }

    expect(SEEDED_ROOMS).toHaveLength(12)
    expect(state.rooms).toHaveLength(12)
    expect(state.rooms.map((room) => room.id)).toEqual(SEEDED_ROOMS.map((room) => room.id))
    expect(state.rooms.map((room) => room.destinationRoomName)).toContain('Sakura Desk JP')
    expect(state.rooms.map((room) => room.destinationRoomName)).toContain('Gamma Team EN')
    expect(state.rooms.map((room) => room.destinationRoomName)).toContain('Kyoto Finance Hub')
    expect(state.rooms.some((room) => room.enabled)).toBe(true)
    expect(state.rooms.some((room) => !room.enabled)).toBe(true)
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
    expect(useRoomStore.getState().rooms).toHaveLength(11)
    expect(useRoomStore.getState().rooms.map((room) => room.id)).not.toContain('room-001')
  })
})
