import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readDeliveryAck, writeDeliveryAck } from './ack-store'

const inputDir = join(tmpdir(), 'ack-store-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('ack-store', () => {
  it('round-trips one delivery ACK', async () => {
    await writeDeliveryAck(inputDir, {
      sourceMessageId: 'source-1',
      status: 'sent',
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    })

    const result = await readDeliveryAck(inputDir, 'source-1')
    expect(result?.status).toBe('sent')
    expect(result?.destinationMessageId).toBe('dest-1')
  })

  it('treats exact duplicate ACK writes as idempotent', async () => {
    const firstAck = {
      sourceMessageId: 'source-1',
      status: 'sent' as const,
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    }

    const written = await writeDeliveryAck(inputDir, firstAck)
    const duplicate = await writeDeliveryAck(inputDir, firstAck)

    const result = await readDeliveryAck(inputDir, 'source-1')
    expect(written.destinationMessageId).toBe('dest-1')
    expect(duplicate.destinationMessageId).toBe('dest-1')
    expect(result?.destinationMessageId).toBe('dest-1')
  })

  it('throws on divergent duplicate ACK (same sourceMessageId, different status)', async () => {
    const firstAck = {
      sourceMessageId: 'source-1',
      status: 'sent' as const,
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    }

    const divergentAck = {
      ...firstAck,
      status: 'failed' as const,
    }

    await writeDeliveryAck(inputDir, firstAck)

    let threw = false
    try {
      await writeDeliveryAck(inputDir, divergentAck)
    } catch (err) {
      threw = true
      expect((err as Error).message).toMatch(/divergent ACK/)
    }
    expect(threw).toBe(true)
  })
})
