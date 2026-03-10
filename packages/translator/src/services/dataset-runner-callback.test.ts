import { describe, expect, it, mock } from 'bun:test'
import { notifyDatasetRunner } from './dataset-runner-callback'

describe('notifyDatasetRunner', () => {
  it('POSTs one ACK payload to dataset-runner', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 202 })))

    await notifyDatasetRunner(
      {
        sourceMessageId: 'source-1',
        status: 'sent',
        destinationRoomId: 55555,
        ackedAt: '2026-03-10T12:00:00.000Z',
        sentAt: '2026-03-10T12:00:00.000Z',
      },
      {
        callbackUrl: 'http://dataset-runner:3002/internal/delivery-acks',
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    )

    expect(fetchMock.mock.calls.length).toBe(1)
  })

  it('throws after exhausting retries when server returns non-ok non-202', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 500 })))

    let caughtError: unknown
    try {
      await notifyDatasetRunner(
        {
          sourceMessageId: 'source-2',
          status: 'sent',
          destinationRoomId: 55555,
          ackedAt: '2026-03-10T12:00:00.000Z',
          sentAt: '2026-03-10T12:00:00.000Z',
        },
        {
          callbackUrl: 'http://dataset-runner:3002/internal/delivery-acks',
          fetchImpl: fetchMock as unknown as typeof fetch,
        },
      )
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toContain(
      'Dataset-runner callback failed after bounded retries',
    )
  })
})
