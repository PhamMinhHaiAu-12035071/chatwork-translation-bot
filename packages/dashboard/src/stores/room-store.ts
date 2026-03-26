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

export const SEEDED_ROOMS: Room[] = [
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
  {
    id: 'room-003',
    originalRoomId: 246813579,
    destinationRoomName: 'Kyoto Finance Hub',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-live-mock-003',
    webhookToken: 'cw-token-finance-003',
    enabled: true,
    createdAt: '2026-03-18T07:45:00Z',
  },
  {
    id: 'room-004',
    originalRoomId: 314159265,
    destinationRoomName: 'Nagoya CX Lab',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-pro',
    translationStyle: 'NATURAL_CASUAL',
    aiApiToken: 'gemini-mock-004',
    webhookToken: 'cw-token-cx-004',
    enabled: true,
    createdAt: '2026-03-19T11:20:00Z',
  },
  {
    id: 'room-005',
    originalRoomId: 271828182,
    destinationRoomName: 'Osaka Escalations',
    aiProvider: 'openai',
    aiModel: null,
    translationStyle: 'AUTO_CONTEXT',
    aiApiToken: 'sk-live-mock-005',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-17T16:05:00Z',
  },
  {
    id: 'room-006',
    originalRoomId: 161803398,
    destinationRoomName: 'Fukuoka Retail Ops',
    aiProvider: 'gemini',
    aiModel: null,
    translationStyle: 'TECHNICAL',
    aiApiToken: 'gemini-mock-006',
    webhookToken: 'cw-token-retail-006',
    enabled: true,
    createdAt: '2026-03-16T08:30:00Z',
  },
  {
    id: 'room-007',
    originalRoomId: 112358132,
    destinationRoomName: 'Sapporo QA Den',
    aiProvider: 'openai',
    aiModel: 'gpt-4.1',
    translationStyle: 'TECHNICAL',
    aiApiToken: 'sk-live-mock-007',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-15T13:40:00Z',
  },
  {
    id: 'room-008',
    originalRoomId: 424242424,
    destinationRoomName: 'Yokohama Partner Desk',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.0-flash',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'gemini-mock-008',
    webhookToken: 'cw-token-partner-008',
    enabled: true,
    createdAt: '2026-03-14T10:10:00Z',
  },
  {
    id: 'room-009',
    originalRoomId: 535353535,
    destinationRoomName: 'Kobe Support EN',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    translationStyle: 'NATURAL_CASUAL',
    aiApiToken: 'sk-live-mock-009',
    webhookToken: 'cw-token-support-009',
    enabled: true,
    createdAt: '2026-03-13T09:15:00Z',
  },
  {
    id: 'room-010',
    originalRoomId: 646464646,
    destinationRoomName: 'Sendai Field Notes',
    aiProvider: 'gemini',
    aiModel: null,
    translationStyle: 'AUTO_CONTEXT',
    aiApiToken: 'gemini-mock-010',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-12T18:25:00Z',
  },
  {
    id: 'room-011',
    originalRoomId: 757575757,
    destinationRoomName: 'Hiroshima Legal Drafts',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'sk-live-mock-011',
    webhookToken: 'cw-token-legal-011',
    enabled: true,
    createdAt: '2026-03-11T12:50:00Z',
  },
  {
    id: 'room-012',
    originalRoomId: 868686868,
    destinationRoomName: 'Naha Community Care',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-pro',
    translationStyle: 'NATURAL_CASUAL',
    aiApiToken: 'gemini-mock-012',
    webhookToken: null,
    enabled: false,
    createdAt: '2026-03-10T06:35:00Z',
  },
]

export const useRoomStore = create<RoomStore>()((set) => ({
  rooms: SEEDED_ROOMS.map((room) => ({ ...room })),

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
