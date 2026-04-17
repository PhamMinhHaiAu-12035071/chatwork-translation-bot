import { describe, expect, it } from 'bun:test'
import { HUMAN_INPUT_THRESHOLD, computeDelayMultiplier, computeScaledDelay } from './delay-config'

describe('computeDelayMultiplier', () => {
  it('returns 1.0 for 0 chars', () => {
    expect(computeDelayMultiplier(0)).toBe(1.0)
  })
  it('returns 1.0 for 2000 chars', () => {
    expect(computeDelayMultiplier(2_000)).toBe(1.0)
  })
  it('returns 1.5 for 2001 chars', () => {
    expect(computeDelayMultiplier(2_001)).toBe(1.5)
  })
  it('returns 1.5 for 8000 chars', () => {
    expect(computeDelayMultiplier(8_000)).toBe(1.5)
  })
  it('returns 2.5 for 8001 chars', () => {
    expect(computeDelayMultiplier(8_001)).toBe(2.5)
  })
  it('returns 2.5 for 15000 chars', () => {
    expect(computeDelayMultiplier(15_000)).toBe(2.5)
  })
  it('returns 4.0 for 15001 chars', () => {
    expect(computeDelayMultiplier(15_001)).toBe(4.0)
  })
  it('returns 4.0 for 20000 chars', () => {
    expect(computeDelayMultiplier(20_000)).toBe(4.0)
  })
})

describe('computeScaledDelay', () => {
  it('scales base 1000ms by 1.0x with neutral jitter (random=0.5)', () => {
    // 1000 * 1.0 = 1000; jitter = (0.5*0.2 - 0.1) * 1000 = 0
    expect(computeScaledDelay(1_000, 1_000, () => 0.5)).toBe(1_000)
  })

  it('scales base 2000ms by 1.5x with neutral jitter', () => {
    // 2000 * 1.5 = 3000; jitter = 0
    expect(computeScaledDelay(2_000, 5_000, () => 0.5)).toBe(3_000)
  })

  it('applies -10% jitter when random=0', () => {
    // 1000 * 1.0 = 1000; jitter = (0*0.2 - 0.1) * 1000 = -100 → 900
    expect(computeScaledDelay(1_000, 1_000, () => 0)).toBe(900)
  })

  it('applies +10% jitter when random=1', () => {
    // 1000 * 1.0 = 1000; jitter = (1*0.2 - 0.1) * 1000 = 100 → 1100
    expect(computeScaledDelay(1_000, 1_000, () => 1)).toBe(1_100)
  })

  it('applies 4.0x for 20k chars with neutral jitter', () => {
    // 1500 * 4.0 = 6000; jitter = 0
    expect(computeScaledDelay(1_500, 20_000, () => 0.5)).toBe(6_000)
  })
})

describe('HUMAN_INPUT_THRESHOLD', () => {
  it('is 50', () => {
    expect(HUMAN_INPUT_THRESHOLD).toBe(50)
  })
})
