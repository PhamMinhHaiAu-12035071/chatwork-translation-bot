import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ITranslationService, TranslationResult, TranslateOptions } from '@chatwork-bot/core'
import { TranslationError } from '@chatwork-bot/core'
import { TranslationSchema, buildTranslationPrompt } from '@chatwork-bot/translation-prompt'
import { extractJsonFromText } from './extract-json'

// Cursor has no native structured output; this prompt enforces JSON compatible with
// Gemini/OpenAI (TranslationSchema). Response is parsed by extractJsonFromText() then validated by Zod.
const JSON_FORMAT_INSTRUCTION = `

You are a structured data generator. Your output must be a pure JSON object that will be parsed automatically.

CRITICAL: This response will be parsed by extractJsonFromText() and validated against a strict Zod schema. Any format violations will cause API_ERROR and translation failure.

Required format (exactly 2 fields):
{
  "sourceLang": "<full language name in English>",
  "translated": "<Vietnamese translation>"
}

Examples of CORRECT output:

Example 1 (English):
Input: "Hello world"
Output: {"sourceLang": "English", "translated": "Xin chào thế giới"}

Example 2 (Japanese):
Input: "こんにちは"
Output: {"sourceLang": "Japanese", "translated": "Xin chào"}

Examples of INCORRECT output (will cause parsing failure):

❌ Wrong: \`\`\`json{"sourceLang": "English", "translated": "Xin chào"}\`\`\`
   (Reason: Wrapped in markdown code block)

❌ Wrong: Here is the translation: {"sourceLang": "English", "translated": "Xin chào"}
   (Reason: Contains explanation text before JSON)

❌ Wrong: {"sourceLang": "English", "translated": "Xin chào", "confidence": 0.95}
   (Reason: Extra field not in schema)

Before responding, verify:
[ ] Output is valid JSON (JSON.parse() will succeed)
[ ] Exactly 2 fields: sourceLang and translated (no extra fields)
[ ] No markdown code blocks (\`\`\`json\`\`\`)
[ ] No explanation text before or after JSON
[ ] Both fields are non-empty strings

Your entire response must be the JSON object itself. Nothing else.`

export class CursorTranslationService implements ITranslationService {
  private readonly provider: ReturnType<typeof createOpenAICompatible>

  constructor(
    private readonly modelId: string,
    private readonly baseUrl: string,
  ) {
    this.provider = createOpenAICompatible({
      name: 'cursor',
      baseURL: baseUrl,
    })
  }

  async translate(text: string, options?: TranslateOptions): Promise<TranslationResult> {
    let rawText: string
    try {
      const result = await generateText({
        model: this.provider(this.modelId),
        prompt: buildTranslationPrompt(text) + JSON_FORMAT_INSTRUCTION,
        ...(options?.signal && { abortSignal: options.signal }),
      })
      rawText = result.text
    } catch (cause) {
      throw new TranslationError(
        `Cursor API call failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    let json: unknown
    try {
      json = extractJsonFromText(rawText)
    } catch (cause) {
      throw new TranslationError(
        `No JSON in Cursor response: ${cause instanceof Error ? cause.message : String(cause)}`,
        'API_ERROR',
        cause,
      )
    }

    const result = TranslationSchema.safeParse(json)
    if (!result.success) {
      throw new TranslationError(
        `Invalid Cursor response schema: ${result.error.message}`,
        'INVALID_RESPONSE',
        result.error,
      )
    }

    return {
      cleanText: text,
      translatedText: result.data.translated,
      sourceLang: result.data.sourceLang,
      targetLang: 'Vietnamese',
      timestamp: new Date().toISOString(),
    }
  }
}
