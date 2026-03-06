import { describe, expect, it } from 'bun:test'
import { extractJsonFromText } from './extract-json'

describe('extractJsonFromText', () => {
  const validJson = { sourceLang: 'Japanese', translated: 'Xin chào' }

  it('parses a pure JSON string', () => {
    const input = JSON.stringify(validJson)
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('parses JSON with leading/trailing whitespace', () => {
    const input = `  \n${JSON.stringify(validJson)}\n  `
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('extracts JSON from markdown ```json block', () => {
    const input = `Here is the translation:\n\`\`\`json\n${JSON.stringify(validJson)}\n\`\`\``
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('extracts JSON from markdown ``` block without language tag', () => {
    const input = `\`\`\`\n${JSON.stringify(validJson)}\n\`\`\``
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('extracts JSON embedded in surrounding prose', () => {
    const input = `The translation result is: ${JSON.stringify(validJson)} — hope that helps!`
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('handles pretty-printed JSON', () => {
    const input = JSON.stringify(validJson, null, 2)
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('handles pretty-printed JSON in code block', () => {
    const input = `\`\`\`json\n${JSON.stringify(validJson, null, 2)}\n\`\`\``
    expect(extractJsonFromText(input)).toEqual(validJson)
  })

  it('throws when no JSON is found', () => {
    expect(() => extractJsonFromText('No JSON here at all')).toThrow('No valid JSON found')
  })

  it('throws on empty string', () => {
    expect(() => extractJsonFromText('')).toThrow('No valid JSON found')
  })

  it('throws on malformed JSON', () => {
    expect(() => extractJsonFromText('{ sourceLang: Japanese }')).toThrow('No valid JSON found')
  })
})
