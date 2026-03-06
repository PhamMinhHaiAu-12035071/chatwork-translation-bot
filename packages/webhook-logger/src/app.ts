import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { webhookRoutes } from './routes/webhook'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'webhook-logger' })

  // Guard: không chạy logixlysia trong test — tránh log noise trong test runner.
  if (env.NODE_ENV !== 'test') {
    app.use(
      logixlysia({
        config: {
          showStartupMessage: false,
          ip: false,
        },
      }),
    )
  }

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Webhook Logger API', version: '1.0.0' },
        },
      }),
    )
  }

  return app.use(healthRoutes).use(webhookRoutes)
}
