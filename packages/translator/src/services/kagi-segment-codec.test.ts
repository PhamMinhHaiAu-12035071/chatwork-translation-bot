import { describe, expect, it } from 'bun:test'
import { KagiSegmentCodecError, decodeKagiSegments, encodeKagiSegments } from './kagi-segment-codec'

function createTokenGenerator(tokens: string[]): () => string {
  let index = 0

  return () => {
    const token = tokens[index] ?? tokens.at(-1)
    index += 1

    if (token === undefined) {
      throw new Error('Expected at least one token')
    }

    return token
  }
}

describe('kagi-segment-codec', () => {
  it('round-trips ordered segments through deterministic UUID-scoped markers', () => {
    const encoded = encodeKagiSegments(['Agenda', 'Please review', 'quoted body'], {
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    expect(encoded.messageToken).toBe('123e4567e89b12d3a456426614174000')
    expect(encoded.encodedText).toContain('[[CW_SEG_123e4567e89b12d3a456426614174000_0001]]')
    expect(encoded.encodedText).toContain('[[/CW_SEG_123e4567e89b12d3a456426614174000_0003]]')

    const decoded = decodeKagiSegments(encoded.encodedText, {
      messageToken: encoded.messageToken,
      expectedSegmentCount: 3,
    })

    expect(decoded).toEqual(['Agenda', 'Please review', 'quoted body'])
  })

  it('regenerates the message token when a generated marker collides with source text', () => {
    const encoded = encodeKagiSegments(
      ['Agenda', 'Please review [[CW_SEG_collision_0002]] before shipping'],
      {
        generateToken: createTokenGenerator(['collision', 'freshuuidtoken']),
      },
    )

    expect(encoded.messageToken).toBe('freshuuidtoken')
    expect(encoded.encodedText).toContain('[[CW_SEG_freshuuidtoken_0001]]')
    expect(encoded.encodedText).not.toContain('[[CW_SEG_collision_0001]]')
  })

  it('fails fast when segment count exceeds the configured limit', () => {
    try {
      encodeKagiSegments(['A', 'B'], {
        generateToken: () => '123e4567e89b12d3a456426614174000',
        maxSegmentCount: 1,
      })
      throw new Error('Expected codec to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiSegmentCodecError)
      expect((error as KagiSegmentCodecError).code).toBe('SEGMENT_COUNT_OVERFLOW')
    }
  })

  it('fails fast when encoded payload exceeds the configured size limit', () => {
    try {
      encodeKagiSegments(['Long payload'], {
        generateToken: () => '123e4567e89b12d3a456426614174000',
        maxEncodedPayloadChars: 10,
      })
      throw new Error('Expected codec to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(KagiSegmentCodecError)
      expect((error as KagiSegmentCodecError).code).toBe('PAYLOAD_TOO_LARGE')
    }
  })

  it('preserves emoji and mixed-language content through encode/decode', () => {
    const encoded = encodeKagiSegments(['Hello xin chào 👋', '仕様レビューお願いします 🙏'], {
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    const decoded = decodeKagiSegments(encoded.encodedText, {
      messageToken: encoded.messageToken,
      expectedSegmentCount: 2,
    })

    expect(decoded).toEqual(['Hello xin chào 👋', '仕様レビューお願いします 🙏'])
  })
})
