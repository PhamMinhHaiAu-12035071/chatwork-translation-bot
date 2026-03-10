import { describe, expect, it } from 'bun:test'
import { createDeliveryAckRoutes } from './delivery-ack'

describe('createDeliveryAckRoutes', () => {
  it('POST /internal/delivery-acks delegates one ACK payload and returns 202', async () => {
    const calls: unknown[] = []
    const app = createDeliveryAckRoutes({
      onAck: (ack) => {
        calls.push(ack)
      },
    })

    const res = await app.handle(
      new Request('http://localhost/internal/delivery-acks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceMessageId: 'source-1',
          status: 'sent',
          destinationRoomId: 55555,
          ackedAt: '2026-03-10T12:00:00.000Z',
        }),
      }),
    )

    expect(res.status).toBe(202)
    expect(calls).toHaveLength(1)
  })
})
