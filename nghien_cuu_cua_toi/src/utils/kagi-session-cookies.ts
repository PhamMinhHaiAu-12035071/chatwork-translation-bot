/**
 * Load Chrome-style exported cookies (e.g. from "EditThisCookie" / extension export) and apply via Playwright
 * {@link BrowserContext.addCookies}, after opening kagi.com — same idea as udemy-crawler `processCookies` +
 * `setCookiesAndReload`, adapted for patchright.
 */

import { readFile } from 'node:fs/promises'
import type { BrowserContext, Cookie, Page } from 'patchright'
import { KAGI_ORIGIN_URL } from '~/config'

/** Shape produced by common browser cookie export extensions */
export interface ChromeExportCookie {
  domain: string
  expirationDate?: number
  hostOnly?: boolean
  httpOnly?: boolean
  name: string
  path?: string
  sameSite?: string
  secure?: boolean
  session?: boolean
  storeId?: string
  value: string
}

export interface KagiSessionJsonFile {
  /** Optional first-hop URL (defaults to {@link KAGI_ORIGIN_URL}) */
  url?: string
  cookies: ChromeExportCookie[]
}

function normalizeSameSite(raw: string | undefined): 'Strict' | 'Lax' | 'None' {
  if (raw === undefined || raw === '') {
    return 'Lax'
  }
  const lower = raw.toLowerCase()
  if (lower === 'strict') {
    return 'Strict'
  }
  if (lower === 'lax' || lower === 'unspecified') {
    return 'Lax'
  }
  if (lower === 'none' || lower === 'no_restriction') {
    return 'None'
  }
  return 'Lax'
}

/**
 * Maps Chrome extension cookie JSON to Playwright {@link Cookie} objects for {@link BrowserContext.addCookies}.
 */
export function chromeExportCookiesToPlaywright(cookies: ChromeExportCookie[]): Cookie[] {
  return cookies.map((c) => {
    let expires: number
    if (
      c.session !== true &&
      typeof c.expirationDate === 'number' &&
      !Number.isNaN(c.expirationDate)
    ) {
      expires = Math.floor(c.expirationDate)
    } else {
      // Playwright `Cookie` requires `expires`; Chrome "session" cookies omit expiration — use sentinel.
      expires = -1
    }
    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path ?? '/',
      expires,
      httpOnly: Boolean(c.httpOnly),
      secure: c.secure !== false,
      sameSite: normalizeSameSite(c.sameSite),
    } satisfies Cookie
  })
}

export async function loadKagiSessionJsonFile(filePath: string): Promise<KagiSessionJsonFile> {
  const raw = await readFile(filePath, 'utf8')
  const data = JSON.parse(raw) as unknown
  if (data === null || typeof data !== 'object') {
    throw new Error('Invalid Kagi session file: root must be an object')
  }
  const cookies = (data as { cookies?: unknown }).cookies
  if (!Array.isArray(cookies)) {
    throw new Error('Invalid Kagi session file: missing "cookies" array')
  }
  return data as KagiSessionJsonFile
}

export interface ApplyKagiSessionOptions {
  sessionFilePath: string
  timeoutMs: number
  /** Override first navigation (JSON `url` field wins when present) */
  defaultOriginUrl?: string
}

/**
 * Visit Kagi origin, inject exported session cookies, then return (caller runs `page.goto` to translate).
 */
export async function visitKagiOriginAndInjectSessionCookies(
  page: Page,
  context: BrowserContext,
  options: ApplyKagiSessionOptions,
): Promise<void> {
  const { sessionFilePath, timeoutMs, defaultOriginUrl = KAGI_ORIGIN_URL } = options
  const file = await loadKagiSessionJsonFile(sessionFilePath)
  const rawOrigin = file.url?.trim()
  const origin = rawOrigin !== undefined && rawOrigin !== '' ? rawOrigin : defaultOriginUrl
  const playwrightCookies = chromeExportCookiesToPlaywright(file.cookies)

  console.log(
    `[kagi-session] Opening ${origin} then injecting ${playwrightCookies.length} cookie(s) from ${sessionFilePath}`,
  )
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  await context.addCookies(playwrightCookies)
}
