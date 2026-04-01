import { z } from 'zod'
import { KeywordEntrySchema } from '~/types/keyword-entry'

export const AI_PROVIDER_VALUES = ['openai', 'gemini'] as const
export type RoomAiProvider = (typeof AI_PROVIDER_VALUES)[number]

export const TRANSLATION_STYLE_VALUES_ROOM = [
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const
export type RoomTranslationStyle = (typeof TRANSLATION_STYLE_VALUES_ROOM)[number]

export const RoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM),
  context: z.string().max(500).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  encryptedAiApiToken: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type RoomConfig = z.infer<typeof RoomConfigSchema>

export const RoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(RoomConfigSchema),
})

export type RoomConfigFile = z.infer<typeof RoomConfigFileSchema>

export const ArchivedRoomConfigSchema = RoomConfigSchema.extend({
  archivedAt: z.iso.datetime(),
})

export type ArchivedRoomConfig = z.infer<typeof ArchivedRoomConfigSchema>

export const ArchiveFileSchema = z.object({
  archived: z.array(ArchivedRoomConfigSchema),
})

export type ArchiveFile = z.infer<typeof ArchiveFileSchema>

export type RoomConfigPublic = Omit<RoomConfig, 'encryptedAiApiToken'>

export function redactRoomConfig(room: RoomConfig): RoomConfigPublic {
  const { encryptedAiApiToken: _a, ...rest } = room

  return rest
}

export const CreateRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1).max(128),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable().default(null),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).default('PROFESSIONAL_BUSINESS'),
  context: z.string().max(500).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  aiApiToken: z.string().min(1),
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>

export const UpdateRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  aiProvider: z.enum(AI_PROVIDER_VALUES).optional(),
  aiModel: z.string().min(1).nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).optional(),
  aiApiToken: z.string().min(1).optional(),
  context: z.string().max(500).nullable().optional(),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})

export type UpdateRoomRequest = z.infer<typeof UpdateRoomRequestSchema>

export type { KeywordEntry, KeywordCategory } from '~/types/keyword-entry'
