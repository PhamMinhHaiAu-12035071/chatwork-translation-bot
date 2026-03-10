import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export type DeliveryAckRecord = DeliveryAckPayload

function ackPath(inputDir: string, sourceMessageId: string): string {
  return join(inputDir, 'state', 'acks', `${sourceMessageId}.json`)
}

async function writeJsonAtomic(filepath: string, payload: DeliveryAckRecord): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(payload, null, 2))
  await rename(tempPath, filepath)
}

export async function readDeliveryAck(
  inputDir: string,
  sourceMessageId: string,
): Promise<DeliveryAckRecord | null> {
  const file = Bun.file(ackPath(inputDir, sourceMessageId))
  if (!(await file.exists())) return null
  return (await file.json()) as DeliveryAckRecord
}

export async function writeDeliveryAck(
  inputDir: string,
  ack: DeliveryAckRecord,
): Promise<DeliveryAckRecord> {
  const existing = await readDeliveryAck(inputDir, ack.sourceMessageId)
  if (existing) {
    if (existing.status === ack.status) return existing
    throw new Error(
      `divergent ACK for sourceMessageId=${ack.sourceMessageId}: ` +
        `stored status="${existing.status}" but received status="${ack.status}". ` +
        `This is a data-integrity violation — stop the runner and investigate.`,
    )
  }

  await mkdir(join(inputDir, 'state', 'acks'), { recursive: true })
  await writeJsonAtomic(ackPath(inputDir, ack.sourceMessageId), ack)
  return ack
}

export async function clearDeliveryAck(inputDir: string, sourceMessageId: string): Promise<void> {
  await rm(ackPath(inputDir, sourceMessageId), { force: true })
}
