import { describe, it, expect } from 'bun:test'
import { ReviewSchema, MQMLiteSchema, TranslationDraftSchema } from './review.schema'

describe('MQMLiteSchema', () => {
  it('parses valid scores', () => {
    const result = MQMLiteSchema.parse({
      naturalFlow: 3,
      culturalFidelity: 2,
      readerExperience: 2,
      semanticAccuracy: 2,
      targetConventions: 1,
    })
    expect(result.naturalFlow).toBe(3)
  })

  it('rejects naturalFlow > 3', () => {
    expect(() =>
      MQMLiteSchema.parse({
        naturalFlow: 4,
        culturalFidelity: 2,
        readerExperience: 2,
        semanticAccuracy: 2,
        targetConventions: 1,
      }),
    ).toThrow()
  })
})

describe('ReviewSchema', () => {
  const validReview = {
    scores: {
      naturalFlow: 2,
      culturalFidelity: 2,
      readerExperience: 1,
      semanticAccuracy: 2,
      targetConventions: 1,
    },
    totalScore: 8,
    passed: false,
    critique: 'Flow is slightly stiff in sentence 2.',
    refinedTranslation: 'Kính gửi anh/chị, tôi xin phép xác nhận lịch release.',
    personaFeedback: {
      freshReader: 'Reads naturally but ending feels formal.',
      linguist: 'Register correctly mapped from sonkeigo.',
      editor: 'Opening phrase can be shortened.',
    },
  }

  it('parses valid review', () => {
    const result = ReviewSchema.parse(validReview)
    expect(result.passed).toBe(false)
    expect(result.totalScore).toBe(8)
  })

  it('accepts passed=true when totalScore is 9', () => {
    const passing = {
      ...validReview,
      scores: {
        naturalFlow: 3,
        culturalFidelity: 2,
        readerExperience: 2,
        semanticAccuracy: 1,
        targetConventions: 1,
      },
      totalScore: 9,
      passed: true,
    }
    expect(ReviewSchema.parse(passing).passed).toBe(true)
  })
})

describe('TranslationDraftSchema', () => {
  it('parses valid draft', () => {
    const result = TranslationDraftSchema.parse({
      sourceLang: 'Japanese',
      translated: 'Xin chào',
    })
    expect(result.sourceLang).toBe('Japanese')
  })

  it('rejects empty translated', () => {
    expect(() => TranslationDraftSchema.parse({ sourceLang: 'Japanese', translated: '' })).toThrow()
  })
})
