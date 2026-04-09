import { describe, expect, it } from 'bun:test'
import { parseMessageDecoration } from './parse-message-decoration'

describe('parseMessageDecoration', () => {
  it('parses plain text message', () => {
    const result = parseMessageDecoration('Hello world')
    expect(result.translationInputs).toEqual(['Hello world'])
    expect(result.translatableText).toBe('Hello world')
  })

  it('parses [info][title] with portable structure', () => {
    const result = parseMessageDecoration('[info][title]Agenda[/title]Please review[/info]')
    expect(result.translationInputs).toContain('Agenda')
    expect(result.translationInputs).toContain('Please review')
    expect(result.translatableText).toContain('Agenda')
    expect(result.translatableText).toContain('Please review')

    // Render template preserves [info] and [title] tags (nested)
    const hasInfo = result.renderTemplate.some((n) => n.type === 'info')
    expect(hasInfo).toBe(true)
    if (hasInfo) {
      const infoNode = result.renderTemplate.find((n) => n.type === 'info') as unknown as {
        type: string
        children: { type: string }[]
      }
      const hasTitle = infoNode.children.some((n) => n.type === 'title')
      expect(hasTitle).toBe(true)
    }
  })

  it('preserves [code] as opaque literal content', () => {
    const codeContent = 'const x = 1'
    const result = parseMessageDecoration(`[code]${codeContent}[/code]`)
    expect(result.translationInputs).toHaveLength(0)
    expect(result.renderTemplate.some((n) => n.type === 'code' && n.content === codeContent)).toBe(
      true,
    )
  })

  it('translates quote body but extracts qtmeta (with [/qtmeta] closing)', () => {
    const result = parseMessageDecoration(
      '[qt][qtmeta account_id="12345" time="1710000000"][/qtmeta]quoted body[/qt]',
    )
    expect(result.translationInputs).toContain('quoted body')
    expect('quoteMetadata' in (result.metadata as unknown as Record<string, unknown>)).toBe(false)

    // qtmeta should NOT be in render template (raw qtmeta stripped)
    const hasRawQtmeta = result.renderTemplate.some(
      (n) => n.type === 'qt' && JSON.stringify(n).includes('qtmeta'),
    )
    expect(hasRawQtmeta).toBe(false)

    const qtNode = result.renderTemplate.find((n) => n.type === 'qt') as unknown as
      | {
          quoteMeta?: { senderAccountId?: number; timestamp?: number }
        }
      | undefined
    expect(qtNode?.quoteMeta).toEqual({
      senderAccountId: 12345,
      timestamp: 1710000000,
    })
  })

  it('translates quote body when qtmeta has no closing tag (real Chatwork format)', () => {
    const result = parseMessageDecoration(
      '[qt][qtmeta aid=2271723 time=1773448368]quoted body text here[/qt]',
    )
    expect(result.translationInputs).toContain('quoted body text here')
    expect('quoteMetadata' in (result.metadata as unknown as Record<string, unknown>)).toBe(false)

    const qtNode = result.renderTemplate.find((n) => n.type === 'qt') as unknown as
      | {
          quoteMeta?: { senderAccountId?: number; timestamp?: number }
        }
      | undefined
    expect(qtNode?.quoteMeta).toEqual({
      senderAccountId: 2271723,
      timestamp: 1773448368,
    })
  })

  it('translates quote body with reply text after qt block (real Chatwork format)', () => {
    const result = parseMessageDecoration(
      '[rp aid=2271723 to=424846369:2088510543039311872]\n[qt][qtmeta aid=2271723 time=1773448368]quoted body[/qt]\nreply text',
    )
    expect(result.translationInputs).toContain('quoted body')
    expect(result.translationInputs).toContain('reply text')
    expect(result.metadata.replyToData?.replyAccountId).toBe(2271723)
  })

  it('keeps nested qt metadata on the correct quote nodes', () => {
    const result = parseMessageDecoration(
      '[qt][qtmeta aid=400 time=1711267800][qt][qtmeta aid=500 time=1711267000]quoted body[/qt][/qt]',
    )

    const outerQt = result.renderTemplate[0] as unknown as {
      type: string
      quoteMeta?: { senderAccountId?: number; timestamp?: number }
      children: {
        type: string
        quoteMeta?: { senderAccountId?: number; timestamp?: number }
      }[]
    }

    expect(result.translationInputs).toEqual(['quoted body'])
    expect('quoteMetadata' in (result.metadata as unknown as Record<string, unknown>)).toBe(false)
    expect(outerQt.type).toBe('qt')
    expect(outerQt.quoteMeta).toEqual({
      senderAccountId: 400,
      timestamp: 1711267800,
    })
    expect(outerQt.children[0]?.type).toBe('qt')
    expect(outerQt.children[0]?.quoteMeta).toEqual({
      senderAccountId: 500,
      timestamp: 1711267000,
    })
  })

  it('attaches nested source-dependent tags to the quote node where they appear', () => {
    const result = parseMessageDecoration(
      '[qt][qtmeta aid=400 time=1711267800][qt][qtmeta aid=500 time=1711267000][To:600][cc:700][rp aid=800 to=999-123]quoted body[/qt][/qt]',
    )

    const outerQt = result.renderTemplate[0] as unknown as {
      type: string
      context?: {
        toAccountIds?: number[]
        ccAccountIds?: number[]
        replyToData?: {
          replyAccountId?: number
          replyRoomId?: number
          replyMessageId?: string
        }
      }
      children: {
        type: string
        context?: {
          toAccountIds?: number[]
          ccAccountIds?: number[]
          replyToData?: {
            replyAccountId?: number
            replyRoomId?: number
            replyMessageId?: string
          }
        }
      }[]
    }
    const innerQt = outerQt.children[0]

    expect(result.metadata.toAccountIds).toEqual([])
    expect(result.metadata.ccAccountIds).toEqual([])
    expect(result.metadata.replyToData).toBeUndefined()
    expect(outerQt.context?.toAccountIds).toEqual([])
    expect(outerQt.context?.ccAccountIds).toEqual([])
    expect(outerQt.context?.replyToData).toBeUndefined()
    expect(innerQt?.context?.toAccountIds).toEqual([600])
    expect(innerQt?.context?.ccAccountIds).toEqual([700])
    expect(innerQt?.context?.replyToData).toEqual({
      replyAccountId: 800,
      replyRoomId: 999,
      replyMessageId: '123',
    })
  })

  it('extracts [To:...] into metadata and render template', () => {
    const result = parseMessageDecoration('[To:1484814]Please review')
    expect(result.metadata.toAccountIds).toContain(1484814)
    expect(result.translationInputs).toContain('Please review')
    // [To:...] should be in render template as a 'to' node
    const toNode = result.renderTemplate.find((n) => n.type === 'to')
    expect(toNode).toBeDefined()
    expect(toNode?.type === 'to' && toNode.accountId).toBe(1484814)
  })

  it('extracts [cc:...] into metadata and render template', () => {
    const result = parseMessageDecoration('[cc:999]Body text')
    expect(result.metadata.ccAccountIds).toContain(999)
    expect(result.translationInputs).toContain('Body text')
    // [cc:...] should be in render template as a 'cc' node
    const ccNode = result.renderTemplate.find((n) => n.type === 'cc')
    expect(ccNode).toBeDefined()
    expect(ccNode?.type === 'cc' && ccNode.accountId).toBe(999)
  })

  it('parses [toall] tag into metadata and render template', () => {
    const result = parseMessageDecoration('[toall]Good morning everyone')
    expect(result.metadata.isToAll).toBe(true)
    expect(result.translationInputs).toContain('Good morning everyone')
    const toallNode = result.renderTemplate.find((n) => n.type === 'toall')
    expect(toallNode).toBeDefined()
  })

  it('handles [toall] combined with [To:] tags', () => {
    const result = parseMessageDecoration('[toall][To:123]Alice\nHello')
    expect(result.metadata.isToAll).toBe(true)
    expect(result.metadata.toAccountIds).toContain(123)
  })

  it('extracts [rp ...] reply metadata', () => {
    const result = parseMessageDecoration('[rp aid=12345 to=567890:789012]Reply to message')
    expect(result.metadata.replyToData?.replyAccountId).toBe(12345)
    expect(result.metadata.replyToData?.replyRoomId).toBe(567890)
    expect(result.metadata.replyToData?.replyMessageId).toBe('789012')
    expect(result.translationInputs).toContain('Reply to message')
  })

  it('preserves [quote] without qtmeta', () => {
    const result = parseMessageDecoration('[quote]quoted body[/quote]')
    expect(result.translationInputs).toContain('quoted body')
    const hasQuote = result.renderTemplate.some((n) => n.type === 'quote')
    expect(hasQuote).toBe(true)
  })

  it('downgrades malformed qt without qtmeta to a quote node', () => {
    const result = parseMessageDecoration('[qt]quoted body[/qt]')

    expect(result.translationInputs).toEqual(['quoted body'])
    expect(result.renderTemplate[0]?.type).toBe('quote')
  })

  it('preserves [hr] self-closing tag', () => {
    const result = parseMessageDecoration('Text before[hr]Text after')
    const hasHr = result.renderTemplate.some((n) => n.type === 'hr')
    expect(hasHr).toBe(true)
  })

  it('zero-translation-input case for code-only body', () => {
    const result = parseMessageDecoration('[code]const x = 1[/code]')
    expect(result.translationInputs).toHaveLength(0)
    expect(result.renderTemplate.some((n) => n.type === 'code')).toBe(true)
  })

  it('tolerates deferred tags like [picon:...] as literal text', () => {
    const result = parseMessageDecoration('[picon:12345]Hello')
    // Should not throw; deferred tags are preserved as literal
    expect(result.translatableText).toBeDefined()
  })

  it('tolerates unknown tags as literal text', () => {
    const result = parseMessageDecoration('[unknown]Hello[/unknown]')
    // Should not throw; unknown tags are treated as literals
    expect(result.translatableText).toContain('Hello')
  })

  it('tolerates malformed/unbalanced markup without throwing', () => {
    const result = parseMessageDecoration('[info]unclosed tag')
    expect(result.translatableText).toContain('unclosed tag')
  })

  it('handles complex nested structure', () => {
    const body = '[To:99][info][title]Title[/title]Body[/info][code]function() {}[/code]'
    const result = parseMessageDecoration(body)
    expect(result.metadata.toAccountIds).toContain(99)
    expect(result.translationInputs).toContain('Title')
    expect(result.translationInputs).toContain('Body')
    expect(result.renderTemplate.some((n) => n.type === 'code')).toBe(true)
  })

  it('preserves whitespace and line breaks in literal text', () => {
    const result = parseMessageDecoration('Line 1\n\nLine 2')
    expect(result.translatableText).toBe('Line 1\n\nLine 2')
  })

  it('handles empty body', () => {
    const result = parseMessageDecoration('')
    expect(result.translationInputs).toHaveLength(0)
    expect(result.translatableText).toBe('')
  })
})
