export const DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS = 1_800_000

export type PipelineTimeoutSource = 'env' | 'provider' | 'default'

export function hasExplicitPipelineTimeoutOverride(
  input: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = input['TRANSLATOR_PIPELINE_TIMEOUT_MS']
  return typeof value === 'string' && value.trim() !== ''
}

export function resolvePipelineTimeout(params: {
  envTimeoutMs: number | undefined
  hasEnvOverride: boolean
  providerTimeoutMs: number | undefined
}): {
  effectiveTimeoutMs: number
  timeoutSource: PipelineTimeoutSource
} {
  if (params.hasEnvOverride && params.envTimeoutMs !== undefined) {
    return {
      effectiveTimeoutMs: params.envTimeoutMs,
      timeoutSource: 'env',
    }
  }

  if (params.providerTimeoutMs !== undefined) {
    return {
      effectiveTimeoutMs: params.providerTimeoutMs,
      timeoutSource: 'provider',
    }
  }

  return {
    effectiveTimeoutMs: DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
    timeoutSource: 'default',
  }
}

export function formatTimeoutSeconds(timeoutMs: number): string {
  return `${(timeoutMs / 1000).toString()}s`
}
