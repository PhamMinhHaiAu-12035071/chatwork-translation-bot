import { describe, it, expect } from 'bun:test'
import {
  DELAY_TIERS,
  HUMAN_INPUT_THRESHOLD,
  computeDelayMultiplier,
  computeScaledDelay,
} from './delay.config'

describe('delay.config', () => {
  describe('DELAY_TIERS', () => {
    it('should have 4 tiers in ascending maxChars order', () => {
      expect(DELAY_TIERS).toHaveLength(4)
      expect(DELAY_TIERS[0].maxChars).toBe(2_000)
      expect(DELAY_TIERS[1].maxChars).toBe(8_000)
      expect(DELAY_TIERS[2].maxChars).toBe(15_000)
      expect(DELAY_TIERS[3].maxChars).toBe(20_000)
    })

    it('should have correct multipliers', () => {
      expect(DELAY_TIERS[0].multiplier).toBe(1.0)
      expect(DELAY_TIERS[1].multiplier).toBe(1.5)
      expect(DELAY_TIERS[2].multiplier).toBe(2.5)
      expect(DELAY_TIERS[3].multiplier).toBe(4.0)
    })
  })

  describe('HUMAN_INPUT_THRESHOLD', () => {
    it('should be 500', () => {
      expect(HUMAN_INPUT_THRESHOLD).toBe(500)
    })
  })

  describe('computeDelayMultiplier', () => {
    it('should return 1.0 for 0 chars', () => {
      expect(computeDelayMultiplier(0)).toBe(1.0)
    })

    it('should return 1.0 for 2000 chars (tier 1 boundary)', () => {
      expect(computeDelayMultiplier(2_000)).toBe(1.0)
    })

    it('should return 1.5 for 2001 chars (tier 2 start)', () => {
      expect(computeDelayMultiplier(2_001)).toBe(1.5)
    })

    it('should return 1.5 for 8000 chars (tier 2 boundary)', () => {
      expect(computeDelayMultiplier(8_000)).toBe(1.5)
    })

    it('should return 2.5 for 8001 chars (tier 3 start)', () => {
      expect(computeDelayMultiplier(8_001)).toBe(2.5)
    })

    it('should return 2.5 for 15000 chars (tier 3 boundary)', () => {
      expect(computeDelayMultiplier(15_000)).toBe(2.5)
    })

    it('should return 4.0 for 15001 chars (tier 4 start)', () => {
      expect(computeDelayMultiplier(15_001)).toBe(4.0)
    })

    it('should return 4.0 for 20000 chars (tier 4 boundary)', () => {
      expect(computeDelayMultiplier(20_000)).toBe(4.0)
    })

    it('should return 4.0 for > 20000 chars (cap at max tier)', () => {
      expect(computeDelayMultiplier(25_000)).toBe(4.0)
    })
  })

  describe('computeScaledDelay', () => {
    it('should return value within ±10% of base×1.0 for charCount=1000', () => {
      const base = 1500
      // Run 50 times to cover jitter range
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 1_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 1.0 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 1.0 * 1.1))
      }
    })

    it('should return value within ±10% of base×1.5 for charCount=5000', () => {
      const base = 2000
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 5_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 1.5 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 1.5 * 1.1))
      }
    })

    it('should return value within ±10% of base×2.5 for charCount=10000', () => {
      const base = 1500
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 10_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 2.5 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 2.5 * 1.1))
      }
    })

    it('should return value within ±10% of base×4.0 for charCount=18000', () => {
      const base = 2000
      for (let i = 0; i < 50; i++) {
        const result = computeScaledDelay(base, 18_000)
        expect(result).toBeGreaterThanOrEqual(Math.floor(base * 4.0 * 0.9))
        expect(result).toBeLessThanOrEqual(Math.ceil(base * 4.0 * 1.1))
      }
    })

    it('should return a positive integer', () => {
      const result = computeScaledDelay(1000, 500)
      expect(result).toBeGreaterThan(0)
      expect(Number.isInteger(result)).toBe(true)
    })
  })
})
