import type { ITranslationService, TranslationResult } from '../interfaces/translation'

export class MockTranslationService implements ITranslationService {
  async translate(text: string): Promise<TranslationResult> {
    await Promise.resolve()
    return {
      originalText: text,
      translatedText: `[Mock→vi] ${text}`,
      sourceLang: 'auto',
      targetLang: 'vi',
      timestamp: new Date().toISOString(),
    }
  }
}
