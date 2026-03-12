// Types
export type { ParsedCommand, SupportedLang } from './types/command'
export { SUPPORTED_LANGUAGES, isSupportedLang } from './types/command'

export type { TranslationIngressCommand } from './types/translation-ingress'
export { TranslationIngressCommandSchema } from './types/translation-ingress'

export type { AIProvider } from './types/ai'
export { toAIProvider } from './types/ai'

// Interfaces
export type {
  ITranslationService,
  TranslationResult,
  TranslateOptions,
} from './interfaces/translation'
export { TranslationError } from './interfaces/translation'
export type {
  ProviderPlugin,
  ProviderManifest,
  ProviderCreateContext,
} from './interfaces/provider-plugin'
export type { ILLMExecutor, ISchema, PromptPair } from './interfaces/llm-executor'

// Registry
export {
  registerProviderPlugin,
  getProviderPlugin,
  listProviderPlugins,
  resetProviderRegistryForTest,
  ProviderRegistryBootError,
} from './services/provider-registry'

// Execution policy
export { translateWithPolicy } from './services/translation-execution-policy'
export type { PolicyOptions } from './services/translation-execution-policy'

// Utils
export { parseCommand } from './utils/parse-command'
export { strictBooleanFromEnv } from './utils/env-boolean'
