import { create } from 'zustand'

export type TranslationStyle =
  | 'AUTO_CONTEXT'
  | 'NATURAL_CASUAL'
  | 'PROFESSIONAL_BUSINESS'
  | 'TECHNICAL'

export type AiProvider = 'openai' | 'gemini'

export interface Room {
  id: string
  originalRoomId: number
  destinationRoomName: string
  aiProvider: AiProvider
  aiModel: string | null
  translationStyle: TranslationStyle
  aiApiToken: string
  webhookToken: string | null
  enabled: boolean
  createdAt: string
}

interface RoomStore {
  rooms: Room[]
  addRoom: (room: Omit<Room, 'id' | 'webhookToken' | 'enabled' | 'createdAt'>) => string
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id' | 'createdAt'>>) => void
  deleteRoom: (id: string) => void
  toggleRoom: (id: string) => void
  activateWebhook: (id: string, webhookToken: string) => void
}

const MOCK_ROOMS: Room[] = [
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

export const useRoomStore = create<RoomStore>()((set) => ({
  rooms: MOCK_ROOMS,

  addRoom: (room) => {
    const id = `room-${String(Date.now())}`

    set((state) => ({
      rooms: [
        ...state.rooms,
        {
          ...room,
          id,
          webhookToken: null,
          enabled: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }))

    return id
  },

  updateRoom: (id, patch) => {
    set((state) => ({
      rooms: state.rooms.map((room) => (room.id === id ? { ...room, ...patch } : room)),
    }))
  },

  deleteRoom: (id) => {
    set((state) => ({
      rooms: state.rooms.filter((room) => room.id !== id),
    }))
  },

  toggleRoom: (id) => {
    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === id ? { ...room, enabled: !room.enabled } : room,
      ),
    }))
  },

  activateWebhook: (id, webhookToken) => {
    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === id ? { ...room, webhookToken, enabled: true } : room,
      ),
    }))
  },
}))
