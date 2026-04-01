export interface RoomTranslationBackendInput<TRuntimeConfig = unknown> {
  cleanText: string
  translationInputs: string[]
  roomContext?: string
  keywordSystemHint?: string
  runtimeConfig: TRuntimeConfig
  phaseObserver?: {
    onPhaseStarted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseCompleted?: (params: { phase: 'translation' }) => Promise<void> | void
    onPhaseFailed?: (params: { phase: 'translation'; error: unknown }) => Promise<void> | void
  }
}

export interface RoomTranslationBackendResult {
  sourceLang: string
  translatedText: string
  translatedSegments: string[]
  debug?: unknown
}

export interface RoomTranslationBackend<TRuntimeConfig = unknown> {
  readonly kind: 'standard' | 'free'
  translate(
    input: RoomTranslationBackendInput<TRuntimeConfig>,
  ): Promise<RoomTranslationBackendResult>
}
