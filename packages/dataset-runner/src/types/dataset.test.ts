import { describe, expect, it } from 'bun:test'
import { DatasetItemSchema } from './dataset'

describe('DatasetItemSchema', () => {
  it('parses a valid item', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-001',
      message: 'ありがとう',
      originalRoomId: 424846369,
      metadata: {
        caseNo: 1,
        title: 'Dịch từ đơn/Cụm từ thông dụng',
        expectedText: 'Cảm ơn',
        category: 'functional',
        tags: ['jp-basic'],
        source: 'spreadsheet-import',
      },
    })

    expect(result.id).toBe('vfa-001')
    expect(result.originalRoomId).toBe(424846369)
    expect(result.metadata?.caseNo).toBe(1)
  })

  it('rejects empty message', () => {
    expect(() => DatasetItemSchema.parse({ id: 'vfa-001', message: '' })).toThrow()
  })

  it('parses escaped newlines inside message content', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-014',
      message: 'できれば年内に！\n\n実装してみてください。',
      metadata: {
        expectedRule: 'Preserve paragraph break and translate naturally',
      },
    })

    expect(result.message).toContain('\n\n')
  })

  it('accepts structured spreadsheet metadata', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-004',
      message: '箸で食べる',
      metadata: {
        caseNo: 4,
        title: 'Từ đồng âm khác nghĩa (Homonyms)',
        expectedRule: 'Dịch đúng ngữ cảnh: Ăn bằng đũa',
        category: 'disambiguation',
        tags: ['homonym', 'context'],
        source: 'spreadsheet-import',
      },
    })

    expect(result.metadata?.expectedRule).toContain('Ăn bằng đũa')
    expect(result.metadata?.tags).toContain('homonym')
  })

  it('rejects unknown top-level keys', () => {
    expect(() =>
      DatasetItemSchema.parse({
        id: 'vfa-003',
        message: 'hello',
        room: 123,
      }),
    ).toThrow()
  })
})
