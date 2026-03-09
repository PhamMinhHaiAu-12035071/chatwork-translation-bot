import {
  getProviderPlugin,
  listProviderPlugins,
  ProviderRegistryBootError,
} from '@chatwork-bot/core'

interface StartupEnv {
  AI_PROVIDER: string
  AI_MODEL?: string | undefined
}

export async function runStartupGuards(env: StartupEnv): Promise<void> {
  const registeredIds = listProviderPlugins().map((p) => p.manifest.id)
  if (!registeredIds.includes(env.AI_PROVIDER)) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' is not registered. Registered: [${registeredIds.join(', ')}]`,
    )
  }

  const plugin = getProviderPlugin(env.AI_PROVIDER)

  const missingKeys = plugin.manifest.requiredEnvKeys.filter(
    (key) => !process.env[key] || process.env[key] === '',
  )
  if (missingKeys.length > 0) {
    throw new ProviderRegistryBootError(
      `[startup] Provider '${env.AI_PROVIDER}' requires env: ${missingKeys.join(', ')}`,
    )
  }

  if (env.AI_MODEL && !plugin.manifest.supportedModels.includes(env.AI_MODEL)) {
    const supported = plugin.manifest.supportedModels.join(', ')
    console.warn(
      `[startup] ⚠ Model '${env.AI_MODEL}' not in ${env.AI_PROVIDER}'s supported list [${supported}]. Proceeding anyway (escape hatch).`,
    )
  }

  if (env.AI_PROVIDER === 'cursor') {
    const proxyUrl = process.env['CURSOR_API_URL'] ?? 'http://localhost:8765/v1'
    const ok = await fetch(`${proxyUrl}/models`)
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) {
      console.error(
        `[startup] Cursor proxy not reachable at ${proxyUrl}\n` +
          '  Fix: Start the proxy first →  bun run cursor-proxy\n' +
          '  Then: bun run dev',
      )
      process.exit(1)
    }
  }
}
