import { createApp } from './app'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createServer(config: {
  getStatus: () => unknown
  onDeliveryAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return createApp(config)
}
