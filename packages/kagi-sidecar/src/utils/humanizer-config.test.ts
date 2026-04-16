import { describe, expect, it } from 'bun:test'

import {
  calculateCharDelay,
  getMistakeChar,
  getPauseAfterPunctuation,
  shouldAddHesitation,
  shouldMakeMistake,
} from './humanizer-config'

function withMockRandom<T>(values: number[], action: () => T): T {
  const originalRandom = Math.random
  let index = 0
  Math.random = () => {
    const value = values[index] ?? 0
    index = Math.min(index + 1, values.length - 1)
    return value
  }

  try {
    return action()
  } finally {
    Math.random = originalRandom
  }
}

describe('humanizer-config', () => {
  it('calculateCharDelay should always stay in configured bounds', () => {
    const delay = calculateCharDelay()
    expect(delay).toBeGreaterThanOrEqual(28)
    expect(delay).toBeLessThanOrEqual(260)
  })

  it('shouldMakeMistake should follow random probability', () => {
    withMockRandom([0.001], () => {
      expect(shouldMakeMistake(0.9)).toBe(true)
    })

    withMockRandom([0.999], () => {
      expect(shouldMakeMistake(0.1)).toBe(false)
    })
  })

  it('shouldAddHesitation should follow provided probability', () => {
    withMockRandom([0.01], () => {
      expect(shouldAddHesitation(0.5)).toBe(true)
    })

    withMockRandom([0.99], () => {
      expect(shouldAddHesitation(0.5)).toBe(false)
    })
  })

  it('getPauseAfterPunctuation should return configured pause range when punctuation exists', () => {
    withMockRandom([0.999], () => {
      expect(getPauseAfterPunctuation('.')).toBeGreaterThanOrEqual(180)
      expect(getPauseAfterPunctuation('.')).toBeLessThanOrEqual(320)
    })
  })

  it('getMistakeChar should return nearby key when available and keep case', () => {
    withMockRandom([0.0], () => {
      expect(getMistakeChar('a')).toBe('q')
      const typo = getMistakeChar('X')
      expect(typo).not.toBe('X')
      expect(typo).toMatch(/^[A-Z]$/)
    })

    expect(getMistakeChar(' ')).toBe(' ')
  })
})
