export type AIProvider = string & { readonly __brand: 'AIProvider' }

export function toAIProvider(value: string): AIProvider {
  return value as AIProvider
}
