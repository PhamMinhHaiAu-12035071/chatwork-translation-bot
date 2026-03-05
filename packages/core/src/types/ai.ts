// packages/core/src/types/ai.ts

export const AI_PROVIDER_VALUES = ['gemini', 'openai'] as const
export type AIProvider = (typeof AI_PROVIDER_VALUES)[number]

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.0-flash'
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini'

export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-pro'
export const DEFAULT_OPENAI_MODEL: OpenAIModel = 'gpt-4o'
