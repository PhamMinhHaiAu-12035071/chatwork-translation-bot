export * from './browser-service'
export * from './server'
export * from './url-builder'

import { createKagiServer } from './server'

if (import.meta.main) {
  const port = Number.parseInt(process.env['KAGI_PORT'] ?? '3002', 10)
  const app = createKagiServer()

  app.listen(port)

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'kagi-sidecar',
      event: 'kagi_sidecar_started',
      timestamp: new Date().toISOString(),
      port,
    }),
  )
}
