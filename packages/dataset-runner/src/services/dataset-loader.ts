import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DatasetItemSchema,
  type PendingDatasetFile,
  type PendingDatasetRecord,
} from '~/types/dataset'

export async function listPendingDatasetFiles(inputDir: string): Promise<PendingDatasetFile[]> {
  const pendingDir = join(inputDir, 'pending')
  const entries = await readdir(pendingDir, { withFileTypes: true }).catch(() => [])

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => ({
      filePath: join(pendingDir, entry.name),
      fileName: entry.name,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
}

export async function loadDatasetRecords(
  file: PendingDatasetFile,
): Promise<PendingDatasetRecord[]> {
  const lines = (await Bun.file(file.filePath).text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, index) => ({
    filePath: file.filePath,
    fileName: file.fileName,
    lineNumber: index + 1,
    item: DatasetItemSchema.parse(JSON.parse(line)),
  }))
}
