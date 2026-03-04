import type { ParsedCommand } from '../types/command'
import { isSupportedLang } from '../types/command'

// Strip Chatwork markup tags: [To:xxx], [rp aid=xxx to=xxx:xxx], etc.
export function stripChatworkMarkup(text: string): string {
  return text
    .replace(/\[To:\d+\]/g, '')
    .replace(/\[rp aid=\d+ to=\d+:\d+\]/g, '')
    .replace(/\[quote\][\s\S]*?\[\/quote\]/g, '')
    .replace(/\[info\][\s\S]*?\[\/info\]/g, '')
    .replace(/\[title\][\s\S]*?\[\/title\]/g, '')
    .replace(/\[code\][\s\S]*?\[\/code\]/g, '')
    .trim()
}

// Parse /translate [lang] [text] command
export function parseCommand(rawBody: string): ParsedCommand | null {
  const cleaned = stripChatworkMarkup(rawBody)

  // Match /translate <lang> <text>
  const match = /^\/translate\s+(\S+)\s+([\s\S]+)$/i.exec(cleaned)
  if (!match) return null

  const [, langRaw, text] = match

  if (!langRaw || !text) return null

  const lang = langRaw.toLowerCase()
  if (!isSupportedLang(lang)) return null

  return {
    targetLang: lang,
    text: text.trim(),
  }
}
