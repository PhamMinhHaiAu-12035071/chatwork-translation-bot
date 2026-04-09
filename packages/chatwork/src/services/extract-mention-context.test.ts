import { describe, expect, it } from 'bun:test'
import { parseMessageDecoration } from './parse-message-decoration'
import { extractMentionContext, buildMentionHint } from './extract-mention-context'

describe('extractMentionContext', () => {
  it('extracts single To recipient with display name', () => {
    const result = parseMessageDecoration('[To:5293785]AuPMH\nお疲れ様です')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 5293785, displayName: 'AuPMH' }])
    expect(mention.ccRecipients).toEqual([])
    expect(mention.isToAll).toBe(false)
  })

  it('extracts multiple To recipients', () => {
    const result = parseMessageDecoration('[To:123]Alice\n[To:456]Bob\nHello')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toHaveLength(2)
    expect(mention.toRecipients[0]).toEqual({ accountId: 123, displayName: 'Alice' })
    expect(mention.toRecipients[1]).toEqual({ accountId: 456, displayName: 'Bob' })
  })

  it('extracts CC recipients separately', () => {
    const result = parseMessageDecoration('[To:123]Alice\n[cc:456]Bob\nMessage')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 123, displayName: 'Alice' }])
    expect(mention.ccRecipients).toEqual([{ accountId: 456, displayName: 'Bob' }])
  })

  it('sets isToAll when [toall] is present', () => {
    const result = parseMessageDecoration('[toall]Hello everyone')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.isToAll).toBe(true)
  })

  it('returns empty arrays when no mentions', () => {
    const result = parseMessageDecoration('Plain text message')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([])
    expect(mention.ccRecipients).toEqual([])
    expect(mention.isToAll).toBe(false)
  })

  it('handles To node at end of message without following literal', () => {
    const result = parseMessageDecoration('[To:123]')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients).toEqual([{ accountId: 123, displayName: '' }])
  })

  it('handles display name with parentheses', () => {
    const result = parseMessageDecoration('[To:123]ThinhNTT (ジェイ)\nMessage')
    const mention = extractMentionContext(result.renderTemplate, result.metadata)
    expect(mention.toRecipients[0]?.displayName).toBe('ThinhNTT (ジェイ)')
  })
})

describe('buildMentionHint', () => {
  it('returns undefined when no mentions', () => {
    const hint = buildMentionHint({
      toRecipients: [],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toBeUndefined()
  })

  it('returns plural hint for toall', () => {
    const hint = buildMentionHint({
      toRecipients: [],
      ccRecipients: [],
      isToAll: true,
    })
    expect(hint).toContain('all room members')
    expect(hint).toContain('plural')
  })

  it('returns singular hint for 1 To recipient', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'AuPMH' }],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toContain('1 person')
    expect(hint).toContain('AuPMH')
    expect(hint).toContain('singular')
  })

  it('returns plural hint for multiple To recipients', () => {
    const hint = buildMentionHint({
      toRecipients: [
        { accountId: 123, displayName: 'Alice' },
        { accountId: 456, displayName: 'Bob' },
      ],
      ccRecipients: [],
      isToAll: false,
    })
    expect(hint).toContain('2 people')
    expect(hint).toContain('Alice, Bob')
    expect(hint).toContain('plural')
  })

  it('separates To and CC in hint', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'Alice' }],
      ccRecipients: [{ accountId: 456, displayName: 'Bob' }],
      isToAll: false,
    })
    expect(hint).toContain('Alice')
    expect(hint).toContain('CC')
    expect(hint).toContain('Bob')
    expect(hint).toContain('singular')
  })

  it('toall overrides individual To/CC recipients', () => {
    const hint = buildMentionHint({
      toRecipients: [{ accountId: 123, displayName: 'Alice' }],
      ccRecipients: [],
      isToAll: true,
    })
    expect(hint).toContain('all room members')
    expect(hint).toContain('plural')
  })
})
