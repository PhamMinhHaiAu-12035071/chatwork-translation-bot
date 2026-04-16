export * from './browser-service'
export * from './runtime-config'
export * from './server'

import { KagiBrowserService } from './browser-service'
import { resolveKagiRuntimeConfig } from './runtime-config'
import { createKagiServer } from './server'

async function main(): Promise<void> {
  const config = resolveKagiRuntimeConfig(process.env)
  const service = new KagiBrowserService(config.browser)

  try {
    await service.launch()
    await service.verifyStartupSession()
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'kagi-sidecar',
        event: 'boot_failed',
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
    await service.close().catch(() => undefined)
    process.exit(1)
  }

  const app = createKagiServer({ service })
  const server = app.listen(config.port)

  async function shutdown(signal: string): Promise<void> {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'kagi-sidecar',
        event: 'shutdown_started',
        timestamp: new Date().toISOString(),
        signal,
      }),
    )
    try {
      await (server as unknown as { stop?: () => Promise<void> | void }).stop?.()
    } catch {
      // best-effort; Elysia versions differ
    }
    await service.close().catch(() => undefined)
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'kagi-sidecar',
        event: 'shutdown_complete',
        timestamp: new Date().toISOString(),
      }),
    )
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

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

if (import.meta.main) {
  void main()
}
