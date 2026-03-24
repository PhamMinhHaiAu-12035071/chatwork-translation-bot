import { mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutputDelivery, OutputDeliveryMessage, OutputRecord } from '~/types/output'

async function writeJsonAtomically(filepath: string, content: string): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await Bun.write(tempPath, content)
  await rename(tempPath, filepath)
}

/**
 * Persists a translation record to output/{dateStr}/{messageId}.json.
 * Writes are atomic (temp file + rename) — safe to call concurrently for different message IDs.
 * @param record - The neutral ingress command extended with translation and optional origin/delivery data.
 * @param baseDir - Output base directory (defaults to `output/` in cwd). Override in tests.
 */
export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.translation.timestamp.slice(0, 10)
  const dir = join(baseDir, dateStr)
  await mkdir(dir, { recursive: true })

  const filepath = join(dir, `${record.command.sourceEventId}.json`)
  const normalizedRecord = {
    ...record,
    ...(record.delivery !== undefined ? { delivery: normalizeDelivery(record.delivery) } : {}),
  }

  await writeJsonAtomically(filepath, JSON.stringify(normalizedRecord, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}

function normalizeDelivery(
  delivery: OutputDelivery,
): OutputDelivery & { messages: OutputDeliveryMessage[] } {
  if (delivery.messages !== undefined) {
    return delivery as OutputDelivery & { messages: OutputDeliveryMessage[] }
  }

  return {
    ...delivery,
    messages: [
      {
        kind: 'body',
        status: delivery.status === 'sent' ? 'sent' : 'failed',
        ...(delivery.destinationMessageId !== undefined
          ? { destinationMessageId: delivery.destinationMessageId }
          : {}),
        ...(delivery.errorCode !== undefined ? { errorCode: delivery.errorCode } : {}),
        ...(delivery.errorMessage !== undefined ? { errorMessage: delivery.errorMessage } : {}),
      },
    ],
  }
}
