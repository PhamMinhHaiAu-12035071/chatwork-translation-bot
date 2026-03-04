/**
 * Verify Chatwork webhook signature.
 *
 * Chatwork sends `x-chatworkwebhooksignature` header containing
 * Base64(HMAC-SHA256(Base64Decode(token), requestBody)).
 *
 * @param body - raw request body string
 * @param signature - value from x-chatworkwebhooksignature header
 * @param secret - webhook token (Base64 encoded, from Chatwork settings)
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature) return false

  try {
    const secretBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const hmac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))

    const expected = btoa(String.fromCharCode(...new Uint8Array(hmac)))

    return timingSafeEqual(expected, signature)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
