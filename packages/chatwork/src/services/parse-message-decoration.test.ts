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

  it('translates quote body but extracts qtmeta', () => {
    const result = parseMessageDecoration(
      '[qt][qtmeta account_id="12345" time="1710000000"][/qtmeta]quoted body[/qt]',
    )
    expect(result.translationInputs).toContain('quoted body')
    expect(result.metadata.quoteMetadata?.quoteSenderAccountId).toBe(12345)
    expect(result.metadata.quoteMetadata?.quoteTimestamp).toBe(1710000000)

    // qtmeta should NOT be in render template (raw qtmeta stripped)
    const hasRawQtmeta = result.renderTemplate.some(
      (n) => n.type === 'qt' && JSON.stringify(n).includes('qtmeta'),
    )
    expect(hasRawQtmeta).toBe(false)
  })

  it('extracts [To:...] into metadata', () => {
    const result = parseMessageDecoration('[To:1484814]Please review')
    expect(result.metadata.toAccountIds).toContain(1484814)
    expect(result.translationInputs).toContain('Please review')
    // [To:...] should not be in render template
    const renderedText = JSON.stringify(result.renderTemplate)
    expect(renderedText).not.toContain('[To:')
  })

  it('extracts [cc:...] into metadata', () => {
    const result = parseMessageDecoration('[cc:999]Body text')
    expect(result.metadata.ccAccountIds).toContain(999)
    expect(result.translationInputs).toContain('Body text')
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
