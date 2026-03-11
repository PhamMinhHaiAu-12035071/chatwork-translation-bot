import { describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'

interface CallbackEvalResult {
  callsLength: number
  firstUrl?: string
  errorMessage?: string
}

function runCallbackEval(responseStatus: number): CallbackEvalResult {
  const moduleUrl = new URL('./dataset-runner-callback-client.ts', import.meta.url).href
  const serializedStatus = JSON.stringify(responseStatus)
  const script = `
    import { notifyDatasetRunner } from ${JSON.stringify(moduleUrl)};

    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({
        url: typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url,
        method: init?.method,
      });
      return new Response(null, { status: ${serializedStatus} });
    };

    let errorMessage;
    try {
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
          fetchImpl,
        },
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    console.log(JSON.stringify({
      callsLength: calls.length,
      firstUrl: calls[0]?.url,
      errorMessage,
    }));
  `

  const stdout = execFileSync('bun', ['--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  return JSON.parse(stdout.trim()) as CallbackEvalResult
}

describe('notifyDatasetRunner', () => {
  it('POSTs one ACK payload to dataset-runner', () => {
    const result = runCallbackEval(202)

    expect(result.callsLength).toBe(1)
    expect(result.firstUrl).toBe('http://dataset-runner:3002/internal/delivery-acks')
    expect(result.errorMessage).toBeUndefined()
  })

  it('throws after exhausting retries when server returns non-ok non-202', () => {
    const result = runCallbackEval(500)

    expect(result.callsLength).toBe(3)
    expect(result.errorMessage).toContain('Dataset-runner callback failed after bounded retries')
  })
})
