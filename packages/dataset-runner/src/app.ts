import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { env } from './env'
import { createDeliveryAckRoutes } from '~/routes/delivery-ack'
import { healthRoutes } from '~/routes/health'
import { createStatusRoutes } from '~/routes/status'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createApp(config: {
  getStatus: () => unknown
  onDeliveryAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  const app = new Elysia({ name: 'dataset-runner' })

  if (env.NODE_ENV !== 'test') {
    app.use(logixlysia({ config: { showStartupMessage: false, ip: false } }))
  }

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Dataset Runner API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(createDeliveryAckRoutes({ onAck: config.onDeliveryAck }))
    .use(createStatusRoutes(config.getStatus))
}
