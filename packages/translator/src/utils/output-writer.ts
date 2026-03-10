// packages/translator/src/utils/output-writer.ts
import { mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutputRecord } from '~/types/output'

async function writeJsonAtomically(filepath: string, content: string): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await Bun.write(tempPath, content)
  await rename(tempPath, filepath)
}

export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.translation.timestamp.slice(0, 10)
  const dir = join(baseDir, dateStr)
  await mkdir(dir, { recursive: true })

  const messageId = record.webhook_event.message_id ?? 'unknown'
  const filepath = join(dir, `${messageId}.json`)

  await writeJsonAtomically(filepath, JSON.stringify(record, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}
