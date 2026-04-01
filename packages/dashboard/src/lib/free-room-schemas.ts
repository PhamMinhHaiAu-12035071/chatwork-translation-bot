import { z } from 'zod'

export const FREE_ROOM_KAGI_STYLES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const

export type FreeRoomKagiStyle = (typeof FREE_ROOM_KAGI_STYLES)[number]

export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Wild: 'Wild',
  Easy: 'Easy',
  Clear: 'Clear',
  Smart: 'Smart',
  Fine: 'Fine',
  True: 'True',
}

export const FREE_ROOM_PROVIDER_OPTIONS = [
  {
    value: 'kagi-free',
    label: 'Kagi Translate Free',
  },
] as const

export const FREE_ROOM_CONTEXT_MAX_LENGTH = 100
export const FREE_ROOM_CONTEXT_NOTE = 'This context is sent to Kagi as request context.'

const keywordEntrySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Max 100 characters'),
  category: z.enum(['company', 'person', 'project', 'code', 'other'] as const),
  placeholder: z.string().max(50, 'Max 50 characters').optional(),
})

export type FreeRoomKeywordEntry = z.infer<typeof keywordEntrySchema>

export const freeRoomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLES, {
    required_error: 'Kagi style is required',
  }),
  context: z
    .string()
    .max(FREE_ROOM_CONTEXT_MAX_LENGTH, 'Max 100 characters')
    .optional()
    .default(''),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
})

export type FreeRoomCreateInput = z.infer<typeof freeRoomCreateSchema>

export const freeRoomEditSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLES, {
    required_error: 'Kagi style is required',
  }),
  context: z
    .string()
    .max(FREE_ROOM_CONTEXT_MAX_LENGTH, 'Max 100 characters')
    .optional()
    .default(''),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
})

export type FreeRoomEditInput = z.infer<typeof freeRoomEditSchema>
