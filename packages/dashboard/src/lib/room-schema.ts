import { z } from 'zod'

export const TRANSLATION_STYLES = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const

export const AI_PROVIDERS = ['openai', 'gemini'] as const

export const roomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  aiProvider: z.enum(AI_PROVIDERS, { required_error: 'AI Provider is required' }),
  aiModel: z.string().nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z
    .string({ required_error: 'AI API token is required' })
    .min(1, 'AI API token is required'),
  webhookSecret: z
    .string({ required_error: 'Webhook secret is required' })
    .min(1, 'Webhook secret is required'),
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
  aiModel: z.string().optional().default(''),
  translationStyle: z.enum(TRANSLATION_STYLES, {
    required_error: 'Translation style is required',
  }),
  aiApiToken: z.string().optional().default(''),
  webhookSecret: z.string().optional().default(''),
})

export type RoomEditInput = z.infer<typeof roomEditSchema>
