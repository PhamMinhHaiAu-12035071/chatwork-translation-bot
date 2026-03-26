import { listProviderPlugins } from '@chatwork-bot/core'

export async function runStartupGuards(): Promise<void> {
  const plugins = listProviderPlugins()

  if (plugins.length === 0) {
    throw new Error('[startup] No providers registered. Did registerAllProviders() run?')
  }

  const hasCursor = plugins.some((plugin) => plugin.manifest.id === 'cursor')
  if (!hasCursor) {
    return
  }

  const proxyUrl = process.env['CURSOR_API_URL'] ?? 'http://localhost:8765/v1'
  const ok = await fetch(`${proxyUrl}/models`)
    .then((response) => response.ok)
    .catch(() => false)

  if (!ok) {
    console.warn(
      `[startup] Warning: Cursor proxy not reachable at ${proxyUrl}\n` +
        '  Per-room configs using cursor provider will fail at runtime.',
    )
  }
}
