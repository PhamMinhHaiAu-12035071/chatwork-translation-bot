import { describe, expect, it } from 'bun:test'
import type { TranslationIngressCommand } from './translation-ingress'

describe('TranslationIngressCommand', () => {
  it('accepts a neutral source payload plus raw snapshot metadata', () => {
    const command: TranslationIngressCommand = {
      sourceSystem: 'chatwork',
      sourceMessageId: 'm1',
      sourceRoomId: 42,
      senderAccountId: 99,
      rawBody: '[To:1] hello',
      translatableText: 'hello',
      sendTime: 1,
      updateTime: 0,
      audit: {
        receivedAt: '2026-03-12T00:00:00.000Z',
        rawSourceSnapshot: { provider: 'chatwork' },
      },
      sourceEventId: 'm1:message_created:1700000000',
      sourceEventType: 'message_created',
      translationInputs: ['hello'],
    }

    expect(command.translatableText).toBe('hello')
  })

  it('requires sourceEventId for per-event identity', () => {
    const command: TranslationIngressCommand = {
      sourceSystem: 'chatwork',
      sourceMessageId: 'm1',
      sourceRoomId: 42,
      senderAccountId: 99,
      rawBody: '[To:1] hello',
      translatableText: 'hello',
      sendTime: 1,
      updateTime: 0,
      audit: {
        receivedAt: '2026-03-12T00:00:00.000Z',
        rawSourceSnapshot: { provider: 'chatwork' },
      },
      sourceEventId: 'm1:message_updated:1700000001',
      sourceEventType: 'message_updated',
      translationInputs: ['hello'],
    }

    expect(command.sourceEventId).toBe('m1:message_updated:1700000001')
  })

  it('requires sourceEventType to distinguish created vs updated', () => {
    const createdCommand: TranslationIngressCommand = {
      sourceSystem: 'chatwork',
      sourceMessageId: 'm1',
      sourceRoomId: 42,
      senderAccountId: 99,
      rawBody: 'hello',
      translatableText: 'hello',
      sendTime: 1,
      updateTime: 0,
      audit: {
        receivedAt: '2026-03-12T00:00:00.000Z',
        rawSourceSnapshot: { provider: 'chatwork' },
      },
      sourceEventId: 'm1:message_created:1700000000',
      sourceEventType: 'message_created',
      translationInputs: ['hello'],
    }

    expect(createdCommand.sourceEventType).toBe('message_created')
  })

  it('requires translationInputs as ordered array of text segments', () => {
    const command: TranslationIngressCommand = {
      sourceSystem: 'chatwork',
      sourceMessageId: 'm1',
      sourceRoomId: 42,
      senderAccountId: 99,
      rawBody: '[info][title]Title[/title]Body[/info]',
      translatableText: 'Title Body',
      sendTime: 1,
      updateTime: 0,
      audit: {
        receivedAt: '2026-03-12T00:00:00.000Z',
        rawSourceSnapshot: { provider: 'chatwork' },
      },
      sourceEventId: 'm1:message_created:1700000000',
      sourceEventType: 'message_created',
      translationInputs: ['Title', 'Body'],
    }

    expect(command.translationInputs).toHaveLength(2)
    expect(command.translationInputs[0]).toBe('Title')
    expect(command.translationInputs[1]).toBe('Body')
  })
})
