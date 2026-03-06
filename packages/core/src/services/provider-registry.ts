import type { ProviderPlugin } from '~/interfaces/provider-plugin'

export class ProviderRegistryBootError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRegistryBootError'
  }
}

const _registry = new Map<string, ProviderPlugin>()

export function registerProviderPlugin(plugin: ProviderPlugin): void {
  if (_registry.has(plugin.manifest.id)) {
    throw new ProviderRegistryBootError(`Provider '${plugin.manifest.id}' is already registered`)
  }
  _registry.set(plugin.manifest.id, plugin)
}

export function getProviderPlugin(id: string): ProviderPlugin {
  const plugin = _registry.get(id)
  if (!plugin) {
    const supported = [..._registry.keys()].join(', ')
    throw new ProviderRegistryBootError(
      `Provider '${id}' not registered. Registered providers: [${supported}]`,
    )
  }
  return plugin
}

export function listProviderPlugins(): ProviderPlugin[] {
  return [..._registry.values()]
}

export function resetProviderRegistryForTest(): void {
  _registry.clear()
}
