/**
 * Composes room description with decorative symbols (Chatwork-compatible format).
 * Uses plain text + light box drawing + emoji instead of Unicode Math Bold.
 */
export function composeRoomDescription(originalRoomName: string): string {
  return `◦•●◉✿ TRANSLATION ROOM ✿◉●•◦
╰┈☆ Original ☆┈╯: ${originalRoomName}`
}
