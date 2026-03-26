import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { providerHealthRoute } from './routes/provider-health'
import { providersRoute } from './routes/providers'
import { createRoomsRoutes } from './routes/rooms'
import { createInternalRoomSecretRoute } from './routes/internal-room-secret'
import { createStatusRoute } from './routes/status'
import { getTranslatorStatusSnapshot } from './services/translator-observability-runtime'
import { translateRoutes } from './webhook/router'
import { env } from './env'
import type { RoomConfigStore } from './services/room-config-store'

interface AppOptions {
  store: RoomConfigStore
}

export function createApp({ store }: AppOptions) {
  const app = new Elysia({ name: 'translator' })

  // Guard: không chạy logixlysia trong test — tránh log noise trong test runner.
  // app.test.ts mock env.NODE_ENV = 'test', guard này có hiệu lực.
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
          info: { title: 'Translator API', version: '1.0.0' },
        },
      }),
    )
  }

  app.use(cors())

  return app
    .use(healthRoutes)
    .use(providerHealthRoute)
    .use(createStatusRoute(() => getTranslatorStatusSnapshot()))
    .use(providersRoute)
    .use(createRoomsRoutes({ store, chatworkApiToken: env.CHATWORK_API_TOKEN }))
    .use(createInternalRoomSecretRoute({ store, internalApiSecret: env.INTERNAL_API_SECRET }))
    .use(translateRoutes)
}
