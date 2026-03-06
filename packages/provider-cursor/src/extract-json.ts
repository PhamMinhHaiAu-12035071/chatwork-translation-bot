const MARKDOWN_CODE_BLOCK = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/

/**
 * Extracts and parses a JSON object from LLM text output.
 *
 * Handles three response shapes that cursor-api-proxy may return:
 * 1. Pure JSON string
 * 2. JSON wrapped in markdown code blocks (```json ... ```)
 * 3. JSON object embedded in surrounding prose
 */
export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim()

  const directResult = tryParse(trimmed)
  if (directResult !== undefined) return directResult

  const codeBlockMatch = MARKDOWN_CODE_BLOCK.exec(trimmed)
  if (codeBlockMatch?.[1]) {
    const blockResult = tryParse(codeBlockMatch[1].trim())
    if (blockResult !== undefined) return blockResult
  }

  const braceStart = trimmed.indexOf('{')
  const braceEnd = trimmed.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.slice(braceStart, braceEnd + 1)
    const embeddedResult = tryParse(candidate)
    if (embeddedResult !== undefined) return embeddedResult
  }

  throw new Error(
    `No valid JSON found in response: ${trimmed.slice(0, 200)}${trimmed.length > 200 ? '…' : ''}`,
  )
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
