import { KAGI_STYLE_VALUES, type KagiStyle } from '@chatwork-bot/provider-kagi'
import { z } from 'zod'
import { KeywordEntrySchema } from '~/types/keyword-entry'

export const FREE_ROOM_KAGI_STYLE_VALUES = KAGI_STYLE_VALUES

export type FreeRoomKagiStyle = KagiStyle

export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type FreeRoomConfig = z.infer<typeof FreeRoomConfigSchema>

export const FreeRoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(FreeRoomConfigSchema),
})

export type FreeRoomConfigFile = z.infer<typeof FreeRoomConfigFileSchema>

export const CreateFreeRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  originalRoomName: z.string().min(1).max(100),
  destinationRoomName: z.string().min(1).max(128),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})

export type CreateFreeRoomRequest = z.infer<typeof CreateFreeRoomRequestSchema>

export const UpdateFreeRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  kagiStyle: z.enum(FREE_ROOM_KAGI_STYLE_VALUES).optional(),
  context: z.string().max(100).nullable().optional(),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})

export type UpdateFreeRoomRequest = z.infer<typeof UpdateFreeRoomRequestSchema>

export type { KeywordEntry, KeywordCategory } from '~/types/keyword-entry'
