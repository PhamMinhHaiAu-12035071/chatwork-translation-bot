import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface OutputRecord {
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: 'vi'
  timestamp: string
  roomId: number
  accountId: number
  messageId: string
}

/**
 * Writes a translation result to output/{dateStr}/{roomId}-{messageId}.json.
 * @param record - The translation data to persist.
 * @param baseDir - Output base directory (defaults to `output/` in cwd). Overridable for tests.
 */
export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.timestamp.slice(0, 10)
  const dir = join(baseDir, dateStr)

  await mkdir(dir, { recursive: true })

  const filename = `${record.roomId.toString()}-${record.messageId}.json`
  const filepath = join(dir, filename)

  await Bun.write(filepath, JSON.stringify(record, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}
