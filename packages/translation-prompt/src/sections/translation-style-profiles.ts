import type { TranslationStyle } from '@chatwork-bot/core'

export interface TranslationStyleProfile {
  id: TranslationStyle
  name: string
  description: string
  userInstruction: string
  systemInstructions: string
  microExamples: string
}

export const TRANSLATION_STYLE_PROFILES: Record<TranslationStyle, TranslationStyleProfile> = {
  NATURAL_CASUAL: {
    id: 'NATURAL_CASUAL',
    name: 'Natural / Casual',
    description:
      'Conversational Vietnamese that feels like a friendly colleague chatting on Zalo or Slack.',
    userInstruction:
      'Use natural casual Vietnamese that sounds like an actual teammate chatting on Zalo.',
    systemInstructions: `## Active Style
Style: NATURAL_CASUAL
Voice: a friendly colleague on Zalo/Slack. Warm, fast, workplace-safe.

Do:
- Prefer short natural sentences and quick rhythm.
- Drop obvious subjects. Vietnamese does not repeat them unless needed.
- Prefer everyday Vietnamese over heavy Hán-Việt wording.
- Use light conversational connectives and sentence-ending particles only when they sound organic.
- Rewrite stiff source structure into speech-like Vietnamese.
- When explanatory prose sounds smoother with spoken compression, prefer turns like "đâu cần...", "cứ ... thôi", "cho nhẹ", "cơ mà..." over document phrasing.
- Prefer spoken anchors like "tầm 10 giây" over document scaffolding like "theo khoảng thời gian cố định".
- Translate semi-technical headings into natural Vietnamese when that reads better, for example "Frame sampling" -> "Lấy mẫu khung hình".

Avoid:
- "vui lòng", "kính", "không nhất thiết", "một cách", "việc..." unless the source truly demands them.
- Long clause chains that read like a document.
- Scaffolding such as "theo khoảng thời gian cố định" or "phần dùng cho" when a simpler spoken phrasing says the same thing.
- Half-English hybrids in casual prose such as "AI detect" or "độ chính xác detect".
- Anything that sounds like professional wording with particles sprinkled on top.`,
    microExamples: `## Micro Examples
Example 1
JP: 「この件、今日中に見てもらえる？」
VI: "Vụ này hôm nay xem giúp mình được không?"

Example 2
JP: 「全部送る必要はないと思います。」
VI: "Đâu cần gửi hết làm gì."

Example 3
JP: 「10秒ごとのチャンクに分割する」
VI: "Chia thành từng đoạn tầm 10 giây."`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    userInstruction: 'Use professional Vietnamese, like a clear internal business email.',
    systemInstructions: `## Active Style
Style: PROFESSIONAL_BUSINESS
Voice: a capable PM writing an internal email. Clear, modern, respectful.

Do:
- Use medium-length sentences with one clean idea at a time.
- Keep wording concise and professional, not stiff.
- Use mild politeness only when the source requires it.
- Preserve business intent and interpersonal register cleanly.

Avoid:
- Bureaucratic or archaic phrases.
- Casual particles and chatty filler.
- Inflated wording when a simpler phrase says the same thing.`,
    microExamples: `## Micro Examples
Example 1
JP: 「資料を確認のうえ、ご返信ください。」
VI: "Vui lòng xem tài liệu và phản hồi giúp mình."

Example 2
JP: 「来週の打ち合わせは木曜日に変更します。」
VI: "Cuộc họp tuần sau sẽ chuyển sang thứ Năm."`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and technical communication.',
    userInstruction: 'Use precise technical Vietnamese, like a senior engineer writing docs.',
    systemInstructions: `## Active Style
Style: TECHNICAL
Voice: a senior engineer writing technical docs, code review notes, or incident updates.

Do:
- Use short direct sentences.
- Keep established engineering terms in English when Vietnamese teams normally do that.
- Prefer imperative phrasing for instructions and precise wording for constraints.
- Optimize for operational clarity over smoothness.
- For explanatory prose, prefer spec-like wording with concrete terms such as chunk, proxy video, frame rate, and object detection when they are the clearest rendering.

Avoid:
- Decorative language, emotional tone, and casual particles.
- Vague hedging when the source is specific.
- Business-email cadence and conversational wrap-up phrasing.
- Replacing industry-standard English terminology with awkward Vietnamese.`,
    microExamples: `## Micro Examples
Example 1
JP: 「デプロイ前にステージングでテストしてください。」
VI: "Chạy test trên staging trước khi deploy."

Example 2
JP: 「10 fps 程度に間引いても検出精度への影響は軽微です。」
VI: "Giảm frame rate xuống khoảng 10 fps vẫn chỉ ảnh hưởng nhẹ đến độ chính xác object detection."`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return [profile.systemInstructions, profile.microExamples].join('\n\n')
}
