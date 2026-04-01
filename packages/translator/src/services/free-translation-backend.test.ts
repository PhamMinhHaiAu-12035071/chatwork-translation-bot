import { describe, expect, it, mock } from 'bun:test'
import type { KagiTranslateRequest, KagiTranslateResponse } from '@chatwork-bot/provider-kagi'
import { FreeTranslationBackend, FreeTranslationBackendError } from './free-translation-backend'

function translatePayload(
  encodedText: string,
  replacements: Record<string, string>,
): KagiTranslateResponse {
  let translated = encodedText

  for (const [source, target] of Object.entries(replacements)) {
    translated = translated.replace(source, target)
  }

  return { translated }
}

describe('FreeTranslationBackend', () => {
  it('makes one KagiClient.translate() call for a multi-segment message', async () => {
    const translate = mock((request: KagiTranslateRequest) =>
      Promise.resolve(
        translatePayload(request.text, {
          Agenda: 'Chương trình',
          'Please review': 'Vui lòng xem',
          'quoted body': 'nội dung trích dẫn',
        }),
      ),
    )
    const backend = new FreeTranslationBackend({
      client: { translate },
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    const result = await backend.translate({
      cleanText: 'Agenda\nPlease review\nquoted body',
      translationInputs: ['Agenda', 'Please review', 'quoted body'],
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: 'software team',
        maxEncodedPayloadChars: 10_000,
        maxSegmentCount: 10,
      },
    })

    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate.mock.calls[0]?.[0]).toMatchObject({
      style: 'Clear',
      context: 'software team',
    })
    expect(result.sourceLang).toBe('auto')
    expect(result.translatedSegments).toEqual([
      'Chương trình',
      'Vui lòng xem',
      'nội dung trích dẫn',
    ])
  })

  it('fails when marker decoding cannot recover the same segment count', async () => {
    const translate = mock((request: KagiTranslateRequest) =>
      Promise.resolve({
        translated: request.text.replace(
          /\[\[CW_SEG_123e4567e89b12d3a456426614174000_0002\]\][\s\S]*$/u,
          '',
        ),
      }),
    )
    const backend = new FreeTranslationBackend({
      client: { translate },
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    const promise = backend.translate({
      cleanText: 'Agenda\nPlease review',
      translationInputs: ['Agenda', 'Please review'],
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: null,
        maxEncodedPayloadChars: 10_000,
        maxSegmentCount: 10,
      },
    })

    await promise.then(
      () => {
        throw new Error('Expected backend to reject')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(FreeTranslationBackendError)
        expect((error as FreeTranslationBackendError).code).toBe('DECODE_SEGMENT_COUNT_MISMATCH')
      },
    )
  })

  it('fails when decoded output still contains reserved marker residue', async () => {
    const translate = mock((request: KagiTranslateRequest) =>
      Promise.resolve(
        translatePayload(request.text, {
          Agenda: 'Chương trình [[CW_SEG_123e4567e89b12d3a456426614174000_9999]]',
        }),
      ),
    )
    const backend = new FreeTranslationBackend({
      client: { translate },
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    const promise = backend.translate({
      cleanText: 'Agenda',
      translationInputs: ['Agenda'],
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: null,
        maxEncodedPayloadChars: 10_000,
        maxSegmentCount: 10,
      },
    })

    await promise.then(
      () => {
        throw new Error('Expected backend to reject')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(FreeTranslationBackendError)
        expect((error as FreeTranslationBackendError).code).toBe('MARKER_RESIDUE')
      },
    )
  })

  it('fails fast before transport on oversized payload or segment-count overflow', async () => {
    const translate = mock((_request: KagiTranslateRequest) => Promise.resolve({ translated: '' }))
    const backend = new FreeTranslationBackend({
      client: { translate },
      generateToken: () => '123e4567e89b12d3a456426614174000',
    })

    const overflowPromise = backend.translate({
      cleanText: 'A\nB',
      translationInputs: ['A', 'B'],
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: null,
        maxEncodedPayloadChars: 10_000,
        maxSegmentCount: 1,
      },
    })

    await overflowPromise.then(
      () => {
        throw new Error('Expected backend to reject')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(FreeTranslationBackendError)
        expect((error as FreeTranslationBackendError).code).toBe('SEGMENT_COUNT_OVERFLOW')
      },
    )

    const oversizedPromise = backend.translate({
      cleanText: 'Long payload',
      translationInputs: ['Long payload'],
      runtimeConfig: {
        kagiStyle: 'Clear',
        context: null,
        maxEncodedPayloadChars: 10,
        maxSegmentCount: 10,
      },
    })

    await oversizedPromise.then(
      () => {
        throw new Error('Expected backend to reject')
      },
      (error: unknown) => {
        expect(error).toBeInstanceOf(FreeTranslationBackendError)
        expect((error as FreeTranslationBackendError).code).toBe('PAYLOAD_TOO_LARGE')
      },
    )

    expect(translate).toHaveBeenCalledTimes(0)
  })
})
