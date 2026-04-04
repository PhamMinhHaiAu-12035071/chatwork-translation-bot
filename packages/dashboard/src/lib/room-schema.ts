import { z } from 'zod'

export const TRANSLATION_STYLES = ['NATURAL_CASUAL', 'PROFESSIONAL_BUSINESS', 'TECHNICAL'] as const

export const AI_PROVIDERS = ['openai', 'gemini'] as const

const keywordEntrySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Max 100 characters'),
  category: z.enum(['company', 'person', 'project', 'code', 'other'] as const),
  placeholder: z.string().max(50, 'Max 50 characters').optional(),
})

export type KeywordEntryFormInput = z.infer<typeof keywordEntrySchema>

export const roomCreateSchema = z.object({
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
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string({ required_error: 'AI Model is required' }).min(1, 'AI Model is required'),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z
    .string({ required_error: 'AI API token is required' })
    .min(1, 'AI API token is required'),
  context: z.string().max(500, 'Max 500 characters').optional().default(''),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

export const roomEditSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string({ required_error: 'AI Model is required' }).min(1, 'AI Model is required'),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z.string().optional().default(''),
  context: z.string().max(500, 'Max 500 characters').optional().default(''),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
})

export type RoomEditInput = z.infer<typeof roomEditSchema>
