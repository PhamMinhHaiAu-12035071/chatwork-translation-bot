import { type KagiStyle } from '@chatwork-bot/provider-kagi'
import { z } from 'zod'

/**
 * ACTIVE_KAGI_STYLES - Styles verified and enabled for dashboard
 *
 * Currently only "Wild" has been manually verified with UI interaction approach.
 * To enable additional styles:
 * 1. Follow verification checklist in docs/kagi-style-verification.md
 * 2. Test in nghien_cuu_cua_toi environment
 * 3. Verify "chim mồi" requirements for each formality
 * 4. Add verified style to this array
 * 5. Update FREE_ROOM_KAGI_STYLE_LABELS and FREE_ROOM_KAGI_STYLE_DESCRIPTIONS below
 */
const ACTIVE_KAGI_STYLES = ['Wild'] as const satisfies readonly KagiStyle[]

export const FREE_ROOM_KAGI_STYLES = ACTIVE_KAGI_STYLES

export type FreeRoomKagiStyle = (typeof FREE_ROOM_KAGI_STYLES)[number]

export const FREE_ROOM_KAGI_STYLE_LABELS: Record<FreeRoomKagiStyle, string> = {
  Wild: 'Wild',
}

export const FREE_ROOM_KAGI_STYLE_DESCRIPTIONS: Record<FreeRoomKagiStyle, string> = {
  Wild: 'Casual Vietnamese, suitable for friends or peers',
}

export function getFreeRoomKagiStyleDescription(style: FreeRoomKagiStyle): string {
  return FREE_ROOM_KAGI_STYLE_DESCRIPTIONS[style]
}

export const FREE_ROOM_PROVIDER_OPTIONS = [
  {
    value: 'kagi-free',
    label: 'Translate Free',
  },
] as const

export const FREE_ROOM_CONTEXT_MAX_LENGTH = 100
export const FREE_ROOM_CONTEXT_NOTE = 'This context helps guide the translation output.'

const keywordEntrySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Max 100 characters'),
  category: z.enum(['company', 'person', 'project', 'code', 'other'] as const),
  placeholder: z.string().max(50, 'Max 50 characters').optional(),
})

export type FreeRoomKeywordEntry = z.infer<typeof keywordEntrySchema>

const baseFreeRoomFields = {
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  originalRoomName: z
    .string({ required_error: 'Original room name is required' })
    .min(1, 'Original room name is required')
    .max(100, 'Max 100 characters')
    .trim(),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLES, {
    required_error: 'Translation style is required',
  }),
  context: z
    .string()
    .max(FREE_ROOM_CONTEXT_MAX_LENGTH, 'Max 100 characters')
    .optional()
    .default(''),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
}

export const freeRoomCreateSchema = z.object({
  ...baseFreeRoomFields,
})

export type FreeRoomCreateInput = z.infer<typeof freeRoomCreateSchema>

export const freeRoomEditSchema = z.object({
  ...baseFreeRoomFields,
})

export type FreeRoomEditInput = z.infer<typeof freeRoomEditSchema>
