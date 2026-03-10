import { mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutputRecord } from '~/types/output'

async function writeJsonAtomically(filepath: string, content: string): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await Bun.write(tempPath, content)
  await rename(tempPath, filepath)
}

/**
 * Persists a translation record to output/{dateStr}/{messageId}.json.
 * Writes are atomic (temp file + rename) — safe to call concurrently for different message IDs.
 * @param record - The webhook event extended with translation and optional origin/delivery data.
 * @param baseDir - Output base directory (defaults to `output/` in cwd). Override in tests.
 */
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
