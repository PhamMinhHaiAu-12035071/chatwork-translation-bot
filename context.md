Bạn đúng — **LangChain nặng và over-engineered** cho một translation bot. Bundle size tới **101.2 kB gzipped** trong khi OpenAI SDK chỉ **34.3 kB**. Với use case của bạn, có 2 hướng rõ ràng: [strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

## Khuyến Nghị: Vercel AI SDK (`ai`)

Đây là lựa chọn tốt nhất vì bạn muốn **cả OpenAI lẫn Gemini** — Vercel AI SDK là **provider-agnostic**, một interface dùng cho cả hai, dễ swap giữa model: [strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

```bash
bun add ai @ai-sdk/openai @ai-sdk/google
```

```typescript
// packages/core/src/services/ai-translation.ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import type { ITranslationService, TranslationResult } from '../interfaces/translation'

const TRANSLATION_PROMPT = (text: string) =>
  `Detect the source language and translate the following text to Vietnamese.
   Return ONLY the translated text, natural and human-readable, no explanation.
   Text: ${text}`

export class AITranslationService implements ITranslationService {
  async translate(targetLang: string, text: string): Promise<TranslationResult> {
    const { text: translated } = await generateText({
      model: google('gemini-2.0-flash'), // hoặc openai('gpt-4o-mini')
      prompt: TRANSLATION_PROMPT(text),
    })
    return { translatedText: translated, sourceLang: 'auto', targetLang }
  }
}
```

## So Sánh 3 Lựa Chọn

|                  | `ai` (Vercel AI SDK)                                                                               | `openai` SDK                                                                                           | `@google/genai`                                     |
| ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Bundle size      | 67.5 kB [strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) | **34.3 kB** [strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) | ~50 kB                                              |
| Multi-provider   | ✅ OpenAI + Gemini + 20+                                                                           | ❌ OpenAI only                                                                                         | ❌ Gemini only                                      |
| Bun compat       | ✅                                                                                                 | ✅                                                                                                     | ✅ [github](https://github.com/googleapis/js-genai) |
| TypeScript types | ✅ Zod built-in                                                                                    | ✅ OpenAPI gen                                                                                         | ✅                                                  |
| Swap model dễ    | ✅ 1 dòng thay đổi                                                                                 | ❌ Rewrite                                                                                             | ❌ Rewrite                                          |
| LangChain        | ❌                                                                                                 | ❌                                                                                                     | ❌                                                  |

## Tại Sao Không Dùng SDK Riêng Lẻ

Nếu dùng `openai` + `@google/genai` riêng, bạn phải viết **2 implementation class** cho `ITranslationService` và maintain cả hai. Vercel AI SDK cho phép bạn switch provider chỉ bằng **1 dòng** — rất phù hợp với `ITranslationService` interface đã có trong codebase. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/168427357/2dca9bfc-16bb-4b59-aafe-122eb398c336/repomix-output.xml)

## Với `ITranslationService` Hiện Tại

```typescript
// Swap model = đổi 1 dòng, không đổi logic
model: google('gemini-2.0-flash') // Free tier rộng
model: google('gemini-2.5-pro') // Accuracy cao hơn
model: openai('gpt-4o-mini') // Rẻ, nhanh
model: openai('gpt-4o') // Accuracy tốt nhất
```

**Kết luận**: Dùng **Vercel AI SDK** (`ai`) — nhẹ hơn LangChain 1.5x, provider-agnostic nên không bị lock-in vào OpenAI hay Gemini, và fit hoàn hảo với `ITranslationService` interface đã có trong `packages/core` của bạn. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/168427357/2dca9bfc-16bb-4b59-aafe-122eb398c336/repomix-output.xml)
