import { describe, it, expect } from 'bun:test'
import { PolishResultSchema, StructuredPolishResultSchema } from './polish.schema'

describe('PolishResultSchema', () => {
  it('parses valid polish result', () => {
    const result = PolishResultSchema.parse({ translated: 'Xin chào' })
    expect(result.translated).toBe('Xin chào')
  })

  it('rejects empty translated', () => {
    expect(() => PolishResultSchema.parse({ translated: '' })).toThrow()
  })

  it('rejects missing translated', () => {
    expect(() => PolishResultSchema.parse({})).toThrow()
  })
})

describe('StructuredPolishResultSchema', () => {
  it('parses valid structured polish result', () => {
    const result = StructuredPolishResultSchema.parse({
      translatedSegments: ['Xin chào', 'Vui lòng xem tài liệu.'],
    })
    expect(result.translatedSegments).toEqual(['Xin chào', 'Vui lòng xem tài liệu.'])
  })

  it('rejects empty translatedSegments array', () => {
    expect(() => StructuredPolishResultSchema.parse({ translatedSegments: [] })).toThrow()
  })

  it('rejects segments with empty strings', () => {
    expect(() =>
      StructuredPolishResultSchema.parse({ translatedSegments: ['Xin chào', ''] }),
    ).toThrow()
  })
})
