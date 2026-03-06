export interface TranslationResult {
  cleanText: string
  translatedText: string
  sourceLang: string
  targetLang: 'Vietnamese'
  timestamp: string
}

export interface TranslateOptions {
  signal?: AbortSignal
}

export interface ITranslationService {
  translate(text: string, options?: TranslateOptions): Promise<TranslationResult>
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'UNKNOWN',
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TranslationError'
  }
}
