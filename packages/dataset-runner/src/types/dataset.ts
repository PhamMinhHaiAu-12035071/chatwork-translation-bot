import { z } from 'zod'

const DatasetMetadataSchema = z
  .object({
    caseNo: z.number().int().positive().optional(),
    title: z.string().min(1).optional(),
    expectedText: z.string().min(1).optional(),
    expectedRule: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
  })
  .strict()

export const DatasetItemSchema = z
  .object({
    id: z.string().min(1),
    message: z.string().min(1),
    originalRoomId: z.coerce.number().int().positive().optional(),
    metadata: DatasetMetadataSchema.optional(),
  })
  .strict()

export type DatasetItem = z.infer<typeof DatasetItemSchema>

export interface PendingDatasetFile {
  filePath: string
  fileName: string
}

export interface PendingDatasetRecord {
  filePath: string
  fileName: string
  lineNumber: number
  item: DatasetItem
}
