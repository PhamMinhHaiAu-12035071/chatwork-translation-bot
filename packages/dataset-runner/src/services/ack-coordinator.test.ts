import { describe, expect, it } from 'bun:test'
import { AckCoordinator } from './ack-coordinator'

describe('AckCoordinator', () => {
  it('resolves a waiter when notify() receives the matching ACK', async () => {
    const coordinator = new AckCoordinator()
    const promise = coordinator.waitForAck('source-1', 1000)

    coordinator.notify({
      sourceMessageId: 'source-1',
      status: 'sent',
      destinationRoomId: 55555,
      ackedAt: '2026-03-10T12:00:00.000Z',
    })

    const ack = await promise
    expect(ack.status).toBe('sent')
  })
})
