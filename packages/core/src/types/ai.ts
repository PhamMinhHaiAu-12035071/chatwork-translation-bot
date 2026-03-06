export const AI_PROVIDER_VALUES = ['gemini', 'openai', 'cursor'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

export const GEMINI_MODEL_VALUES = ['gemini-2.5-pro', 'gemini-2.0-flash'] as const
export type GeminiModel = (typeof GEMINI_MODEL_VALUES)[number]

export const OPENAI_MODEL_VALUES = ['gpt-4o', 'gpt-4o-mini'] as const
export type OpenAIModel = (typeof OPENAI_MODEL_VALUES)[number]

export const CURSOR_MODEL_VALUES = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-6',
  'claude-sonnet-4-6-thinking',
  'gpt-4o',
  'cursor-small',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]

export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
export const DEFAULT_CURSOR_MODEL: CursorModel = 'claude-sonnet-4-5'
