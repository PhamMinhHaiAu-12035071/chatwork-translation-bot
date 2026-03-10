import { join } from 'node:path'
import type { OutputOrigin } from '~/types/output'

export async function resolveOutputOrigin(
  messageId: string,
  inputDir: string,
): Promise<OutputOrigin> {
  const filepath = join(inputDir, 'state', 'source-map', `${messageId}.json`)
  const file = Bun.file(filepath)

  if (!(await file.exists())) {
    return { type: 'manual' }
  }

  const content = (await file.json()) as {
    datasetFile?: string
    datasetItemId?: string
    datasetLineNumber?: number
  }

  const origin: OutputOrigin = { type: 'automation' }
  if (content.datasetFile !== undefined) origin.datasetFile = content.datasetFile
  if (content.datasetItemId !== undefined) origin.datasetItemId = content.datasetItemId
  if (content.datasetLineNumber !== undefined) origin.datasetLineNumber = content.datasetLineNumber

  return origin
}
