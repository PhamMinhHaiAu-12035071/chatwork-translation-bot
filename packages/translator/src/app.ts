import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { healthRoutes } from './routes/health'
import { translateRoutes } from './webhook/router'
import { env } from './env'

export function createApp() {
  const app = new Elysia({ name: 'translator' })

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

  return app
    .use(healthRoutes)
    .use(translateRoutes)
    .onError(({ code, error }) => {
      console.error(
        `[app] Error [${String(code)}]:`,
        error instanceof Error ? error.message : error,
      )
    })
}
