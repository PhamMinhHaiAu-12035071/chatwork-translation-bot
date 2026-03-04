import { describe, expect, it } from 'bun:test'
import { verifyWebhookSignature } from './verify'

describe('verifyWebhookSignature', () => {
  // Generate a known test vector:
  // secret (Base64) = Base64Encode("test-secret-key-1234")
  // = "dGVzdC1zZWNyZXQta2V5LTEyMzQ="
  const testSecret = 'dGVzdC1zZWNyZXQta2V5LTEyMzQ='
  const testBody = '{"webhook_event_type":"message_created"}'

  it('returns true for valid signature', async () => {
    // Pre-compute: HMAC-SHA256(Base64Decode(testSecret), testBody) → Base64
    const keyBytes = Uint8Array.from(atob(testSecret), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(testBody))
    const validSignature = btoa(String.fromCharCode(...new Uint8Array(sig)))

    const result = await verifyWebhookSignature(testBody, validSignature, testSecret)
    expect(result).toBe(true)
  })

  it('returns false for invalid signature', async () => {
    const result = await verifyWebhookSignature(testBody, 'invalid-signature', testSecret)
    expect(result).toBe(false)
  })

  it('returns false for empty signature', async () => {
    const result = await verifyWebhookSignature(testBody, '', testSecret)
    expect(result).toBe(false)
  })

  it('returns false for tampered body', async () => {
    const keyBytes = Uint8Array.from(atob(testSecret), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(testBody))
    const validSignature = btoa(String.fromCharCode(...new Uint8Array(sig)))

    const result = await verifyWebhookSignature('tampered body', validSignature, testSecret)
    expect(result).toBe(false)
  })
})
