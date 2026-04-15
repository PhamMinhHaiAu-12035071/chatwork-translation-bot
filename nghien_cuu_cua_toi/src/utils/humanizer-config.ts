import { HUMANIZER_CONFIG } from '~/config'

export type HumanizerPunctuationPauseMap = Record<string, { minMs: number; maxMs: number }>

interface NumberRange {
  minMs: number
  maxMs: number
}

interface HumanizerDelayConfig {
  wordsPerMinute?: number
  charDelayJitter?: number
  minDelayMs?: number
  maxDelayMs?: number
}

function randomIntFromRange(range: NumberRange): number {
  return Math.floor(Math.random() * (range.maxMs - range.minMs + 1)) + range.minMs
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }

  if (value > max) {
    return max
  }

  return value
}

/**
 * Estimate key-press delay from typing speed plus random jitter.
 * Returns a delay in milliseconds for one keystroke.
 */
export function calculateCharDelay(config?: HumanizerDelayConfig): number {
  const wordsPerMinute = config?.wordsPerMinute ?? HUMANIZER_CONFIG.WORDS_PER_MINUTE
  const charsPerWord = HUMANIZER_CONFIG.AVERAGE_CHARS_PER_WORD
  const jitter = config?.charDelayJitter ?? HUMANIZER_CONFIG.CHAR_DELAY_JITTER
  const minDelayMs = config?.minDelayMs ?? HUMANIZER_CONFIG.MIN_CHAR_DELAY_MS
  const maxDelayMs = config?.maxDelayMs ?? HUMANIZER_CONFIG.MAX_CHAR_DELAY_MS

  const safeCharsPerWord = Math.max(1, charsPerWord)
  const safeWpm = Math.max(1, wordsPerMinute)
  const safeJitter = clampNumber(jitter, 0, 0.95)

  const baseDelay = 60_000 / (safeWpm * safeCharsPerWord)
  const jitterFactor = 1 + (Math.random() * 2 - 1) * safeJitter
  const rawDelay = baseDelay * jitterFactor

  return clampNumber(Math.round(rawDelay), minDelayMs, maxDelayMs)
}

/**
 * Returns whether this keystroke should produce a typo.
 */
export function shouldMakeMistake(rate: number = HUMANIZER_CONFIG.MISTAKE_RATE): boolean {
  if (rate <= 0) {
    return false
  }

  return Math.random() < rate
}

const KEYBOARD_LAYOUT_ROWS = [
  '`1234567890-=',
  'qwertyuiop[]\\',
  "asdfghjkl;'",
  'zxcvbnm,./',
] as const

const KEYBOARD_NEIGHBORHOOD = new Map<string, string[]>()

for (const [rowIndex, row] of KEYBOARD_LAYOUT_ROWS.entries()) {
  for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
    const key = row[colIndex]
    const neighbors: string[] = []

    for (let deltaRow = -1; deltaRow <= 1; deltaRow += 1) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol += 1) {
        if (deltaRow === 0 && deltaCol === 0) {
          continue
        }

        const currentRow = KEYBOARD_LAYOUT_ROWS[rowIndex + deltaRow]
        if (currentRow === undefined) {
          continue
        }

        const currentCol = colIndex + deltaCol
        if (currentCol < 0 || currentCol >= currentRow.length) {
          continue
        }

        const currentChar = currentRow[currentCol]
        if (currentChar === undefined) {
          continue
        }
        neighbors.push(currentChar)
      }
    }

    KEYBOARD_NEIGHBORHOOD.set(key, neighbors)
  }
}

/**
 * Returns a nearby keyboard character to simulate a typo.
 */
export function getMistakeChar(correctChar: string): string {
  if (correctChar === '') {
    return correctChar
  }

  const normalized = correctChar.at(0)?.toLowerCase() ?? ''
  const neighbors = KEYBOARD_NEIGHBORHOOD.get(normalized)
  if (neighbors === undefined || neighbors.length === 0) {
    return correctChar
  }

  const replacement = neighbors[Math.floor(Math.random() * neighbors.length)]
  if (!replacement) {
    return correctChar
  }

  const isUpper = /^[A-Z]$/.test(correctChar)
  return isUpper ? replacement.toUpperCase() : replacement
}

/**
 * Generic hesitation coin-flip used across typing and movement codepaths.
 */
export function shouldAddHesitation(
  probability: number = HUMANIZER_CONFIG.HESITATION_PROBABILITY,
): boolean {
  if (probability <= 0) {
    return false
  }

  return Math.random() < probability
}

/**
 * Returns additional wait time for punctuation characters.
 */
export function getPauseAfterPunctuation(
  punctuation = '',
  punctuationPauseMap: HumanizerPunctuationPauseMap = HUMANIZER_CONFIG.PUNCTUATION_PAUSE_MS,
): number {
  const key = punctuation.at(0)
  if (key === undefined) {
    return 0
  }

  const pause = punctuationPauseMap[key]
  if (pause === undefined) {
    return 0
  }

  return randomIntFromRange(pause)
}
