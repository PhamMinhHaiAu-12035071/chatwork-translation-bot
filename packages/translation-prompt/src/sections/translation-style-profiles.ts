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
    description: 'Natural Vietnamese with a casual workplace register.',
    userInstruction: 'Use natural casual Vietnamese for an informal workplace register.',
    systemInstructions: `## Active Style
Style: NATURAL_CASUAL
Register: natural casual Vietnamese with a workplace-safe casual register. Natural, light, broadly understood.

Do:
- Prefer everyday Vietnamese and a spoken-but-work-safe rhythm.
- Split long explanations when that sounds more natural.
- Rewrite mixed technical explanation into spoken anchors when Vietnamese would naturally say it that way, for example "cứ tầm 10 giây một đoạn".
- Use light casual turns only when they are the most natural rendering.

Avoid:
- chat-app persona acting, overfamiliar xưng hô, or slangy performance.
- document phrasing such as "theo khoảng thời gian cố định" or "phần dùng cho", heavy Hán-Việt wording, and half-English hybrid jargon like "AI detect".`,
    microExamples: `## Micro Examples
Example 1
JP: 「全部送る必要はないと思います。」
VI: "Đâu cần gửi hết làm gì."

Example 2
JP: 「10秒おきに切り出して送る」
VI: "Cứ tầm 10 giây cắt một đoạn rồi gửi đi."

Example 3
JP: 「フレームサンプリング」
VI: "Frame sampling" -> "Lấy mẫu khung hình."`,
  },
  PROFESSIONAL_BUSINESS: {
    id: 'PROFESSIONAL_BUSINESS',
    name: 'Professional / Business',
    description: 'Modern professional Vietnamese for clear, polished business communication.',
    userInstruction: 'Use professional Vietnamese for clear internal business prose.',
    systemInstructions: `## Active Style
Style: PROFESSIONAL_BUSINESS
Register: internal business prose. Clear, modern, respectful.

Do:
- Use calm professional Vietnamese with one clean idea per sentence.
- Keep wording concise, polished, and easy to skim.
- Keep business and technical wording natural for internal communication.

Avoid:
- bureaucratic phrasing and archaic honorifics.
- casual particles and casual filler.
- leaving Japanese punctuation artifacts such as （...） or 「...」 in Vietnamese output.
- sounding like chat messages or terse technical notes.`,
    microExamples: `## Micro Examples
Example 1
JP: 「資料を確認のうえ、共有してください。」
VI: "Vui lòng xem tài liệu và chia sẻ lại cho team."

Example 2
JP: 「4Kのままだと重いため、軽量版を送ります。」
VI: "Do bản 4K khá nặng, tôi sẽ gửi bản nhẹ hơn để xử lý."`,
  },
  TECHNICAL: {
    id: 'TECHNICAL',
    name: 'Technical',
    description: 'Precision-first Vietnamese for engineering and technical communication.',
    userInstruction: 'Use precise Vietnamese in a technical register.',
    systemInstructions: `## Active Style
Style: TECHNICAL
Register: technical prose for docs, reviews, and incident notes.

Do:
- Use short direct sentences.
- Prefer terse technical register over business cadence.
- Keep established engineering terms in English when Vietnamese teams normally do that: chunk, proxy video, frame rate, object detection.
- Prefer imperative phrasing for instructions and precise wording for constraints.
- Normalize punctuation into standard Vietnamese or ASCII punctuation.

Avoid:
- Decorative language, emotional tone, and casual particles.
- Business-email cadence and conversational wrap-up phrasing.
- Hybrid phrasing like "detect object".
- Replacing industry-standard English terminology with awkward Vietnamese.
- Long wrap-up sentences when a terse line is clearer.`,
    microExamples: `## Micro Examples
Example 1
JP: 「デプロイ前にステージングでテストしてください。」
VI: "Chạy test trên staging trước khi deploy."

Example 2
JP: 「軽量なプロキシ動画に変換してアップロードする」
VI: "Chuyển sang proxy video nhẹ trước khi upload."

Example 3
JP: 「10 fps 程度に間引いても検出精度への影響は軽微です。」
VI: "Giảm frame rate xuống khoảng 10 fps vẫn chỉ ảnh hưởng nhẹ tới object detection."`,
  },
}

export function buildTranslationStyleSection(style: TranslationStyle): string {
  const profile = TRANSLATION_STYLE_PROFILES[style]

  return [profile.systemInstructions, profile.microExamples].join('\n\n')
}
