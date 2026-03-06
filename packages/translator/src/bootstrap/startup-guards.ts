import { listProviderPlugins, ProviderRegistryBootError } from '@chatwork-bot/core'
import type { Env } from '~/env'

export async function runStartupGuards(
  env: Pick<Env, 'AI_PROVIDER'> & Partial<{ CURSOR_API_URL: string }>,
): Promise<void> {
  const registeredIds = listProviderPlugins().map((p) => p.manifest.id)
  if (!registeredIds.includes(env.AI_PROVIDER)) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' is not registered. Registered: [${registeredIds.join(', ')}]`,
    )
  }

  if (env.AI_PROVIDER === 'cursor') {
    const proxyUrl = env.CURSOR_API_URL ?? 'http://localhost:3040'
    const ok = await fetch(`${proxyUrl}/models`)
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) {
      console.error(
        `[startup] Cursor proxy not reachable at ${proxyUrl}\n` +
          '  Fix: Start the proxy first →  node_modules/.bin/cursor-api-proxy\n' +
          '  Then: bun run dev',
      )
      process.exit(1)
    }
  }
}
