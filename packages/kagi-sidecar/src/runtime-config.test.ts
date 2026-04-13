import { describe, expect, it } from 'bun:test'

describe('resolveKagiRuntimeConfig', () => {
  it('applies safe defaults when optional env vars are absent', async () => {
    const { resolveKagiRuntimeConfig } = await import('./runtime-config')
    const config = resolveKagiRuntimeConfig({})

    expect(config.port).toBe(3002)
    expect(config.browser.minIntervalMs).toBe(1_500)
    expect(config.browser.maxRetries).toBe(2)
    expect(config.browser.retryBaseMs).toBe(1_000)
    expect(config.browser.requestTimeoutMs).toBe(120_000)
    expect(config.browser.maxQueueDepth).toBe(10)
    expect(config.browser.maxQueueWaitMs).toBe(15_000)
  })

  it('parses explicit runtime overrides from env', async () => {
    const { resolveKagiRuntimeConfig } = await import('./runtime-config')
    const config = resolveKagiRuntimeConfig({
      KAGI_PORT: '3999',
      KAGI_MIN_INTERVAL_MS: '2200',
      KAGI_MAX_RETRIES: '4',
      KAGI_RETRY_BASE_MS: '1800',
      KAGI_REQUEST_TIMEOUT_MS: '45000',
      KAGI_MAX_QUEUE_DEPTH: '3',
      KAGI_MAX_QUEUE_WAIT_MS: '9000',
    })

    expect(config.port).toBe(3999)
    expect(config.browser.minIntervalMs).toBe(2_200)
    expect(config.browser.maxRetries).toBe(4)
    expect(config.browser.retryBaseMs).toBe(1_800)
    expect(config.browser.requestTimeoutMs).toBe(45_000)
    expect(config.browser.maxQueueDepth).toBe(3)
    expect(config.browser.maxQueueWaitMs).toBe(9_000)
  })

  it('rejects invalid numeric overrides early', async () => {
    const { resolveKagiRuntimeConfig } = await import('./runtime-config')

    expect(() =>
      resolveKagiRuntimeConfig({
        KAGI_MAX_QUEUE_DEPTH: '0',
      }),
    ).toThrow('KAGI_MAX_QUEUE_DEPTH must be a positive integer')
  })
})
