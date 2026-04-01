const RESERVED_MARKER_PATTERN = /\[\[\/?CW_SEG_[A-Za-z0-9-]+_\d{4}\]\]/u
const TOKEN_COLLISION_ATTEMPTS = 8

export class KagiSegmentCodecError extends Error {
  constructor(
    public readonly code:
      | 'PAYLOAD_TOO_LARGE'
      | 'SEGMENT_COUNT_OVERFLOW'
      | 'TOKEN_GENERATION_FAILED'
      | 'DECODE_SEGMENT_COUNT_MISMATCH'
      | 'MARKER_RESIDUE',
    message: string,
  ) {
    super(message)
    this.name = 'KagiSegmentCodecError'
  }
}

interface EncodeKagiSegmentsOptions {
  generateToken?: () => string
  maxEncodedPayloadChars?: number
  maxSegmentCount?: number
}

interface DecodeKagiSegmentsOptions {
  messageToken: string
  expectedSegmentCount: number
}

interface EncodedKagiSegments {
  encodedText: string
  messageToken: string
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function buildMarker(messageToken: string, ordinal: number): string {
  return `[[CW_SEG_${messageToken}_${ordinal.toString().padStart(4, '0')}]]`
}

function buildClosingMarker(messageToken: string, ordinal: number): string {
  return `[[/CW_SEG_${messageToken}_${ordinal.toString().padStart(4, '0')}]]`
}

function hasMarkerCollision(segments: string[], messageToken: string): boolean {
  const joined = segments.join('\n')
  return (
    joined.includes(`[[CW_SEG_${messageToken}_`) || joined.includes(`[[/CW_SEG_${messageToken}_`)
  )
}

function normalizeDecodedSegment(segment: string): string {
  let normalized = segment

  if (normalized.startsWith('\n')) {
    normalized = normalized.slice(1)
  }

  if (normalized.endsWith('\n')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

function resolveMessageToken(
  segments: string[],
  generateToken: (() => string) | undefined,
): string {
  const makeToken = generateToken ?? (() => crypto.randomUUID().replaceAll('-', ''))

  for (let attempt = 0; attempt < TOKEN_COLLISION_ATTEMPTS; attempt += 1) {
    const token = makeToken()
    if (!hasMarkerCollision(segments, token)) {
      return token
    }
  }

  throw new KagiSegmentCodecError(
    'TOKEN_GENERATION_FAILED',
    'Unable to generate a collision-free Kagi segment token',
  )
}

export function encodeKagiSegments(
  segments: string[],
  options: EncodeKagiSegmentsOptions = {},
): EncodedKagiSegments {
  if (options.maxSegmentCount !== undefined && segments.length > options.maxSegmentCount) {
    throw new KagiSegmentCodecError(
      'SEGMENT_COUNT_OVERFLOW',
      `Segment count ${segments.length.toString()} exceeds configured maximum`,
    )
  }

  const messageToken = resolveMessageToken(segments, options.generateToken)
  const encodedText = segments
    .map((segment, index) => {
      const ordinal = index + 1
      return [
        buildMarker(messageToken, ordinal),
        segment,
        buildClosingMarker(messageToken, ordinal),
      ].join('\n')
    })
    .join('\n')

  if (
    options.maxEncodedPayloadChars !== undefined &&
    Array.from(encodedText).length > options.maxEncodedPayloadChars
  ) {
    throw new KagiSegmentCodecError(
      'PAYLOAD_TOO_LARGE',
      'Encoded Kagi payload exceeds configured size limit',
    )
  }

  return {
    encodedText,
    messageToken,
  }
}

export function decodeKagiSegments(
  translatedText: string,
  options: DecodeKagiSegmentsOptions,
): string[] {
  const escapedToken = escapeRegExp(options.messageToken)
  const pattern = new RegExp(
    `\\[\\[CW_SEG_${escapedToken}_(\\d{4})\\]\\]([\\s\\S]*?)\\[\\[/CW_SEG_${escapedToken}_\\1\\]\\]`,
    'gu',
  )
  const segments = new Map<number, string>()
  let previousEnd = 0

  for (const match of translatedText.matchAll(pattern)) {
    const matchedText = match[0]
    const ordinal = Number(match[1])
    const capturedSegment = match[2]
    if (capturedSegment === undefined) {
      throw new KagiSegmentCodecError(
        'DECODE_SEGMENT_COUNT_MISMATCH',
        'Decoded Kagi payload is missing a captured segment body',
      )
    }
    const segment = normalizeDecodedSegment(capturedSegment)
    const matchIndex = match.index
    const gap = translatedText.slice(previousEnd, matchIndex)

    if (gap.trim() !== '') {
      throw new KagiSegmentCodecError(
        'MARKER_RESIDUE',
        'Decoded Kagi payload contains non-whitespace text outside segment markers',
      )
    }

    if (segments.has(ordinal)) {
      throw new KagiSegmentCodecError(
        'DECODE_SEGMENT_COUNT_MISMATCH',
        'Decoded Kagi payload contains duplicate segment markers',
      )
    }

    segments.set(ordinal, segment)
    previousEnd = matchIndex + matchedText.length
  }

  const trailing = translatedText.slice(previousEnd)
  if (trailing.trim() !== '') {
    throw new KagiSegmentCodecError(
      'MARKER_RESIDUE',
      'Decoded Kagi payload contains trailing text outside segment markers',
    )
  }

  if (segments.size !== options.expectedSegmentCount) {
    throw new KagiSegmentCodecError(
      'DECODE_SEGMENT_COUNT_MISMATCH',
      `Decoded ${segments.size.toString()} segments, expected ${options.expectedSegmentCount.toString()}`,
    )
  }

  const decodedSegments: string[] = []

  for (let ordinal = 1; ordinal <= options.expectedSegmentCount; ordinal += 1) {
    const segment = segments.get(ordinal)

    if (segment === undefined) {
      throw new KagiSegmentCodecError(
        'DECODE_SEGMENT_COUNT_MISMATCH',
        `Decoded Kagi payload is missing segment ${ordinal.toString()}`,
      )
    }

    if (RESERVED_MARKER_PATTERN.test(segment)) {
      throw new KagiSegmentCodecError(
        'MARKER_RESIDUE',
        'Decoded Kagi segment still contains reserved marker residue',
      )
    }

    decodedSegments.push(segment)
  }

  return decodedSegments
}
