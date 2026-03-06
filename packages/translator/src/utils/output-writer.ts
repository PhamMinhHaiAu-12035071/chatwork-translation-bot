import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutputRecord } from '~/types/output'

/**
 * Writes a translation record to output/{dateStr}/{messageId}.json.
 * The record is the full ChatworkWebhookEvent extended with a `translation` block.
 * @param record - The webhook event + translation data to persist.
 * @param baseDir - Output base directory (defaults to `output/` in cwd). Overridable for tests.
 */
export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.translation.timestamp.slice(0, 10)
  const dir = join(baseDir, dateStr)

  await mkdir(dir, { recursive: true })

  const messageId = record.webhook_event.message_id ?? 'unknown'
  const filename = `${messageId}.json`
  const filepath = join(dir, filename)

  await Bun.write(filepath, JSON.stringify(record, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}
