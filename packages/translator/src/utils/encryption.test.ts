import { describe, expect, it } from 'bun:test'
import { decrypt, encrypt } from './encryption'

const KEY_HEX = 'a'.repeat(64)

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error
  }
}

describe('encrypt / decrypt', () => {
  it('roundtrips plaintext through AES-256-GCM', async () => {
    const plaintext = 'super-secret-api-key'
    const ciphertext = await encrypt(plaintext, KEY_HEX)
    const result = await decrypt(ciphertext, KEY_HEX)
    expect(result).toBe(plaintext)
  })

  it('produces different ciphertext each invocation (random IV)', async () => {
    const plaintext = 'same text'
    const c1 = await encrypt(plaintext, KEY_HEX)
    const c2 = await encrypt(plaintext, KEY_HEX)
    expect(c1).not.toBe(c2)
  })

  it('decrypt throws on tampered ciphertext', async () => {
    const ciphertext = await encrypt('hello', KEY_HEX)
    const tampered = ciphertext.slice(0, -4) + 'XXXX'
    const error = await catchError(decrypt(tampered, KEY_HEX))
    expect(error).toBeInstanceOf(Error)
  })

  it('decrypt throws on wrong key', async () => {
    const ciphertext = await encrypt('hello', KEY_HEX)
    const wrongKey = 'b'.repeat(64)
    const error = await catchError(decrypt(ciphertext, wrongKey))
    expect(error).toBeInstanceOf(Error)
  })

  it('throws on key with wrong length', async () => {
    const error = await catchError(encrypt('hello', 'tooshort'))
    expect((error as Error).message).toContain('ROOM_CONFIG_ENCRYPTION_KEY')
  })
})
