import { Elysia, t } from 'elysia'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createDeliveryAckRoutes(config: {
  onAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return new Elysia({ name: 'dataset-runner:delivery-ack' }).post(
    '/internal/delivery-acks',
    async ({ body }) => {
      await config.onAck(body as DeliveryAckPayload)
      return new Response(null, { status: 202 })
    },
    {
      body: t.Object({
        sourceMessageId: t.String(),
        status: t.Union([t.Literal('sent'), t.Literal('failed')]),
        destinationRoomId: t.Number(),
        destinationMessageId: t.Optional(t.String()),
        errorCode: t.Optional(t.String()),
        errorMessage: t.Optional(t.String()),
        ackedAt: t.String(),
      }),
    },
  )
}
