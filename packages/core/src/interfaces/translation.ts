export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: 'vi'
  timestamp: string
}

export interface ITranslationService {
  translate(text: string): Promise<TranslationResult>
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
