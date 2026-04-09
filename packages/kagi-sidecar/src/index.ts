export * from './browser-service'
export * from './runtime-config'
export * from './server'

import { KagiBrowserService } from './browser-service'
import { resolveKagiRuntimeConfig } from './runtime-config'
import { createKagiServer } from './server'

if (import.meta.main) {
  const config = resolveKagiRuntimeConfig(process.env)
  const app = createKagiServer({
    service: new KagiBrowserService(config.browser),
  })

  app.listen(config.port)

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'kagi-sidecar',
      event: 'kagi_sidecar_started',
      timestamp: new Date().toISOString(),
      port: config.port,
    }),
  )
}
