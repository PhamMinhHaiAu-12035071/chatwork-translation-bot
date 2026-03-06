import type { ITranslationService, TranslationResult } from '~/interfaces/translation'

export class MockTranslationService implements ITranslationService {
  async translate(text: string): Promise<TranslationResult> {
    await Promise.resolve()
    return {
      cleanText: text,
      translatedText: `[Mock→Vietnamese] ${text}`,
      sourceLang: 'Auto-detected',
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }
}
