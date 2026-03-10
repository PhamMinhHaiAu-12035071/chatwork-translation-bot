import type { ILLMExecutor } from '@chatwork-bot/core'
import type { ProviderPlugin, ProviderCreateContext } from '@chatwork-bot/core'
import { CursorExecutor } from './cursor-translation'

type CursorExecutorConstructor = new (
  modelId: ProviderCreateContext['modelId'],
  baseUrl: string,
) => ILLMExecutor

const CursorExecutorCtor = CursorExecutor as unknown as CursorExecutorConstructor

export const CURSOR_MODEL_VALUES = [
  // === CURSOR NATIVE ===
  // Cursor's own model pool — separate from fast/slow API quota
  'auto',
  'composer-1',
  'composer-1.5',

  // === SLOW REQUEST ===
  // Unlimited usage, queued at peak — does NOT consume fast quota
  'sonnet-4.5',
  'gemini-3-flash',
  'gemini-3-pro',
  'gemini-3.1-pro',
  'kimi-k2.5',
  'grok',
  'gpt-5.1-codex-mini',

  // === FAST REQUEST ===
  // Consumes from 500 fast requests/month quota
  'sonnet-4.6',
  'opus-4.5',
  'opus-4.6',
  'gpt-5.2',
  'gpt-5.2-high',
  'gpt-5.2-codex',
  'gpt-5.2-codex-low',
  'gpt-5.2-codex-low-fast',
  'gpt-5.2-codex-fast',
  'gpt-5.2-codex-high',
  'gpt-5.2-codex-high-fast',
  'gpt-5.3-codex',
  'gpt-5.3-codex-low',
  'gpt-5.3-codex-low-fast',
  'gpt-5.3-codex-fast',
  'gpt-5.3-codex-high',
  'gpt-5.3-codex-high-fast',
  'gpt-5.3-codex-spark-preview',
  'gpt-5.4-medium',
  'gpt-5.4-medium-fast',
  'gpt-5.4-high',
  'gpt-5.4-high-fast',
  'gpt-5.1-high',

  // === MAX MODE ===
  // Extended context window / reasoning — thinking variants + xhigh/max variants
  'sonnet-4.5-thinking',
  'sonnet-4.6-thinking',
  'opus-4.5-thinking',
  'opus-4.6-thinking',
  'gpt-5.2-codex-xhigh',
  'gpt-5.2-codex-xhigh-fast',
  'gpt-5.3-codex-xhigh',
  'gpt-5.3-codex-xhigh-fast',
  'gpt-5.4-xhigh',
  'gpt-5.4-xhigh-fast',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-max-high',
] as const
export type CursorModel = (typeof CURSOR_MODEL_VALUES)[number]
export const DEFAULT_CURSOR_MODEL: CursorModel = 'sonnet-4.6'

export const cursorPlugin: ProviderPlugin = {
  manifest: {
    id: 'cursor',
    supportedModels: CURSOR_MODEL_VALUES,
    defaultModel: DEFAULT_CURSOR_MODEL,
    capabilities: { streaming: false },
    timeoutMs: 600_000,
    requiredEnvKeys: ['CURSOR_API_URL'],
  },
  create(ctx: ProviderCreateContext): ILLMExecutor {
    if (!ctx.baseUrl) {
      throw new Error(
        'cursor provider requires baseUrl in ProviderCreateContext (set CURSOR_API_URL)',
      )
    }
    return new CursorExecutorCtor(ctx.modelId, ctx.baseUrl)
  },
}
