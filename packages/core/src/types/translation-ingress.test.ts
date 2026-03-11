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
    }

    expect(command.translatableText).toBe('hello')
  })
})
