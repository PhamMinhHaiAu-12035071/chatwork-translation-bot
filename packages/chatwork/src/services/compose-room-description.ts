/**
 * Converts ASCII text to Unicode Math Bold characters (U+1D400-U+1D433).
 * Uses codepoint arithmetic for A-Z (U+1D400-U+1D419) and a-z (U+1D41A-U+1D433).
 */
export function convertToUnicodeBold(text: string): string {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 65 && code <= 90) return String.fromCodePoint(code - 65 + 0x1d400) // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(code - 97 + 0x1d41a) // a-z
      return char
    })
    .join('')
}

/**
 * Composes the Neubrutalism-styled room description for translation rooms.
 */
export function composeRoomDescription(originalRoomName: string): string {
  const title = convertToUnicodeBold('TRANSLATION ROOM')
  const label = convertToUnicodeBold('Original')

  return `╔═══════════════════════════════════════╗
║    🌐 ${title} 🌐    ║
╚═══════════════════════════════════════╝

📍 ${label}: ${originalRoomName}`
}
