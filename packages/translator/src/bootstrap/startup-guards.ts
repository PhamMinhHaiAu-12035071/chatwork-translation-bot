import { listProviderPlugins } from '@chatwork-bot/core'

/**
 * Fail-fast check invoked at process start.
 *
 * The only invariant left here after the cursor-proxy removal is that
 * `registerAllProviders()` actually ran — without it, every translation
 * request would throw a confusing `Provider not found` deep inside the
 * dispatcher. Throwing here surfaces a missed bootstrap wiring at boot.
 */
export function runStartupGuards(): void {
  const plugins = listProviderPlugins()

  if (plugins.length === 0) {
    throw new Error('[startup] No providers registered. Did registerAllProviders() run?')
  }
}
