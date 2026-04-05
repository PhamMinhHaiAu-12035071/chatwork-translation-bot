import { LRUCache } from 'lru-cache'
import type { KeywordEntry, KeywordCategory } from '~/types/keyword-entry'

export interface RedactionResult {
  maskedText: string
  restoreMap: Map<string, string> // placeholder → original keyword
  systemHint: string
}

const CATEGORY_PREFIX: Record<KeywordCategory, string> = {
  company: 'COMPANY',
  person: 'PERSON',
  project: 'PROJECT',
  code: 'CODE',
  other: 'TERM',
}

// ─── Pattern Cache ────────────────────────────────────────────────────────────

interface CompiledPatternEntry {
  placeholder: string
  original: string
  category: KeywordCategory
  pattern: RegExp
}

const patternCache = new LRUCache<string, CompiledPatternEntry[]>({
  max: parseInt(process.env['KEYWORD_PATTERN_CACHE_MAX'] ?? '100', 10),
  ttl: 1000 * 60 * 60, // 1 hour
})

const CATEGORY_DESCRIPTION: Record<KeywordCategory, string> = {
  company: 'company or organization name (proper noun)',
  person: 'person name (proper noun)',
  project: 'project or product name (proper noun)',
  code: 'internal code, ID, or reference number',
  other: 'sensitive term (proper noun or internal reference)',
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(normalizedKeyword: string): RegExp {
  const escaped = escapeRegex(normalizedKeyword)
  // Split on whitespace to detect multi-word keywords
  const parts = escaped.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return new RegExp(escaped, 'gi')
  }
  // Generate variants: flexible-space, compound (no space), hyphen, underscore
  const variants = [
    parts.join('[\\s\\u3000]+'), // flexible whitespace incl. Japanese U+3000
    parts.join(''), // compound "AsiaVion"
    parts.join('-'), // hyphen "Asia-Vion"
    parts.join('_'), // underscore "Asia_Vion"
  ]
  return new RegExp(`(?:${variants.join('|')})`, 'gi')
}

function buildSystemHint(entries: { placeholder: string; category: KeywordCategory }[]): string {
  if (entries.length === 0) return ''
  const lines = entries.map(
    ({ placeholder, category }) => `- ${placeholder}: ${CATEGORY_DESCRIPTION[category]}`,
  )
  return [
    '## Sensitive Term Placeholders',
    'The following placeholders represent sensitive terms.',
    'Preserve them UNCHANGED in your translation output.',
    ...lines,
  ].join('\n')
}

function getCachedPatterns(keywords: KeywordEntry[]): CompiledPatternEntry[] {
  // Create stable cache key (serialize sorted keywords)
  const cacheKey = keywords
    .map(k => `${k.keyword}:${k.category}:${k.placeholder ?? ''}`)
    .sort()
    .join('||')
  
  // Check cache
  const cached = patternCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  
  // Sort longest-first to prevent partial-overlap bugs
  const sorted = [...keywords].sort(
    (a, b) => b.keyword.normalize('NFC').length - a.keyword.normalize('NFC').length,
  )

  // Assign placeholders by position in sorted array (deterministic)
  const counters: Partial<Record<string, number>> = {}
  const entries = sorted.map((entry) => {
    const prefix = CATEGORY_PREFIX[entry.category]
    counters[prefix] = (counters[prefix] ?? 0) + 1
    const placeholder = entry.placeholder
      ? `[${entry.placeholder}]`
      : `[${prefix}_${(counters[prefix] ?? 0).toString()}]`
    return {
      placeholder,
      original: entry.keyword,
      category: entry.category,
      pattern: buildPattern(entry.keyword.normalize('NFC')),
    }
  })
  
  // Store in cache
  patternCache.set(cacheKey, entries)
  
  return entries
}

/**
 * Masks sensitive keywords in `text` with typed placeholders.
 *
 * Placeholder assignment is deterministic (based on position in sorted keyword
 * array, not order of first occurrence in text). This means calling mask() on
 * any text with the same keyword list produces identical restoreMap entries —
 * safe to use a single restoreMap for restoring multiple segments.
 */
export function mask(text: string, keywords: KeywordEntry[]): RedactionResult {
  if (keywords.length === 0) {
    return { maskedText: text, restoreMap: new Map(), systemHint: '' }
  }

  // Get or compile patterns (cached)
  const entries = getCachedPatterns(keywords)

  // Apply masking on NFC-normalized text
  const normalizedText = text.normalize('NFC')
  let maskedText = normalizedText
  for (const { pattern, placeholder } of entries) {
    maskedText = maskedText.replace(pattern, placeholder)
  }

  // Build restoreMap: placeholder → original keyword (only for keywords that matched)
  const restoreMap = new Map<string, string>()
  for (const { placeholder, original } of entries) {
    if (maskedText.includes(placeholder)) {
      restoreMap.set(placeholder, original)
    }
  }

  // Build systemHint only for keywords that actually matched
  const matchedEntries = entries
    .filter(({ placeholder }) => restoreMap.has(placeholder))
    .map(({ placeholder, category }) => ({ placeholder, category }))

  return { maskedText, restoreMap, systemHint: buildSystemHint(matchedEntries) }
}

/**
 * Restores all placeholders in `text` back to their original keywords.
 */
export function restore(text: string, restoreMap: Map<string, string>): string {
  if (restoreMap.size === 0) return text
  let result = text
  for (const [placeholder, original] of restoreMap) {
    result = result.replaceAll(placeholder, original)
  }
  return result
}
