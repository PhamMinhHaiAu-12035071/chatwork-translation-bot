import { describe, expect, it } from 'bun:test'
import { chromeExportCookiesToPlaywright } from './kagi-session-cookies'

describe('chromeExportCookiesToPlaywright', () => {
  it('maps Chrome export fields to Playwright cookies', () => {
    const pw = chromeExportCookiesToPlaywright([
      {
        domain: '.kagi.com',
        expirationDate: 1784023664.82,
        hostOnly: false,
        httpOnly: true,
        name: 'kagi_session',
        path: '/',
        sameSite: 'lax',
        secure: true,
        session: false,
        value: 'abc',
      },
    ])
    expect(pw).toHaveLength(1)
    expect(pw[0]?.name).toBe('kagi_session')
    expect(pw[0]?.value).toBe('abc')
    expect(pw[0]?.domain).toBe('.kagi.com')
    expect(pw[0]?.path).toBe('/')
    expect(pw[0]?.httpOnly).toBe(true)
    expect(pw[0]?.secure).toBe(true)
    expect(pw[0]?.sameSite).toBe('Lax')
    expect(pw[0]?.expires).toBe(1784023664)
  })

  it('uses -1 expires for session cookies (Playwright requires the field)', () => {
    const pw = chromeExportCookiesToPlaywright([
      {
        domain: 'kagi.com',
        httpOnly: true,
        name: 'sid',
        path: '/',
        sameSite: 'Lax',
        secure: true,
        session: true,
        value: 'x',
      },
    ])
    expect(pw[0]?.expires).toBe(-1)
  })
})
