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
})

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

export const roomEditSchema = roomCreateSchema

export type RoomEditInput = z.infer<typeof roomEditSchema>

export const webhookActivationSchema = z.object({
  webhookToken: z
    .string({ required_error: 'Webhook token is required' })
    .min(1, 'Webhook token is required'),
})

export type WebhookActivationInput = z.infer<typeof webhookActivationSchema>
