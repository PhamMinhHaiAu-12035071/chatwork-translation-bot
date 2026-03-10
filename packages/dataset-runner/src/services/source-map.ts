import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface AutomationSourceMapEntry {
  sourceMessageId: string
  datasetFile: string
  datasetItemId: string
  datasetLineNumber: number
  sentAt: string
}

export async function writeAutomationSourceMapEntry(
  inputDir: string,
  entry: AutomationSourceMapEntry,
): Promise<void> {
  const dir = join(inputDir, 'state', 'source-map')
  await mkdir(dir, { recursive: true })
  await Bun.write(join(dir, `${entry.sourceMessageId}.json`), JSON.stringify(entry, null, 2))
}

export async function readAutomationSourceMapEntry(
  inputDir: string,
  sourceMessageId: string,
): Promise<AutomationSourceMapEntry | null> {
  const file = Bun.file(join(inputDir, 'state', 'source-map', `${sourceMessageId}.json`))
  if (!(await file.exists())) return null
  return (await file.json()) as AutomationSourceMapEntry
}
