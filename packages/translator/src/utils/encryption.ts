const IV_LENGTH = 12
const KEY_HEX_LENGTH = 64
const KEY_HEX_PATTERN = /^[\da-f]+$/iu

function validateKeyHex(keyHex: string): void {
  if (keyHex.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `ROOM_CONFIG_ENCRYPTION_KEY must be exactly ${KEY_HEX_LENGTH.toString()} hex chars (32 bytes). Got ${keyHex.length.toString()}.`,
    )
  }

  if (!KEY_HEX_PATTERN.test(keyHex)) {
    throw new Error('ROOM_CONFIG_ENCRYPTION_KEY must contain only hex characters.')
  }
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const pairs = keyHex.match(/.{2}/gu)
  if (!pairs) {
    throw new Error('ROOM_CONFIG_ENCRYPTION_KEY must be a valid 32-byte hex string.')
  }

  const keyBytes = Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)))

  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string, keyHex: string): Promise<string> {
  validateKeyHex(keyHex)

  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), IV_LENGTH)

  return Buffer.from(combined).toString('base64url')
}

export async function decrypt(ciphertextB64: string, keyHex: string): Promise<string> {
  validateKeyHex(keyHex)

  const key = await importKey(keyHex)
  const combined = Buffer.from(ciphertextB64, 'base64url')
  const iv = combined.subarray(0, IV_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)

  return new TextDecoder().decode(plaintext)
}
