import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import { ChatworkWebhookSignatureError } from '~/errors/chatwork-webhook-signature-error'
import { verifyWebhookSignature } from './verify-webhook-signature'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Chatwork tokens are base64-encoded binary keys — use a realistic base64 test value
const SECRET = Buffer.from('test-secret-key').toString('base64') // "dGVzdC1zZWNyZXQta2V5"
const RAW_BODY = '{"webhook_setting_id":"123","webhook_event_type":"message_created"}'

// Mirror the production logic: decode secret from base64 before HMAC
function makeSignature(body: string, secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest('base64')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  it('does not throw when signature is valid', () => {
    const signature = makeSignature(RAW_BODY, SECRET)
    expect(() => {
      verifyWebhookSignature(RAW_BODY, signature, SECRET)
    }).not.toThrow()
  })

  it('throws ChatworkWebhookSignatureError when signature is invalid', () => {
    const wrongSignature = makeSignature(RAW_BODY, 'wrong-secret')
    expect(() => {
      verifyWebhookSignature(RAW_BODY, wrongSignature, SECRET)
    }).toThrow(ChatworkWebhookSignatureError)
  })

  it('throws ChatworkWebhookSignatureError when body is tampered', () => {
    const signature = makeSignature(RAW_BODY, SECRET)
    const tamperedBody = RAW_BODY + ' tampered'
    expect(() => {
      verifyWebhookSignature(tamperedBody, signature, SECRET)
    }).toThrow(ChatworkWebhookSignatureError)
  })

  it('throws ChatworkWebhookSignatureError when signature is empty string', () => {
    expect(() => {
      verifyWebhookSignature(RAW_BODY, '', SECRET)
    }).toThrow(ChatworkWebhookSignatureError)
  })

  it('cannot silently skip verification in production even when skip=true', () => {
    const wrongSignature = makeSignature(RAW_BODY, 'wrong-secret')
    expect(() => {
      verifyWebhookSignature(RAW_BODY, wrongSignature, SECRET, { skip: true, env: 'production' })
    }).toThrow(ChatworkWebhookSignatureError)
  })

  it('bypasses verification in non-production when skip=true', () => {
    const wrongSignature = makeSignature(RAW_BODY, 'wrong-secret')
    expect(() => {
      verifyWebhookSignature(RAW_BODY, wrongSignature, SECRET, { skip: true, env: 'development' })
    }).not.toThrow()
  })

  it('bypasses verification when skip=true and env is undefined (non-production)', () => {
    const wrongSignature = makeSignature(RAW_BODY, 'wrong-secret')
    expect(() => {
      verifyWebhookSignature(RAW_BODY, wrongSignature, SECRET, { skip: true })
    }).not.toThrow()
  })

  it('does not bypass when skip=false even in development', () => {
    const wrongSignature = makeSignature(RAW_BODY, 'wrong-secret')
    expect(() => {
      verifyWebhookSignature(RAW_BODY, wrongSignature, SECRET, { skip: false, env: 'development' })
    }).toThrow(ChatworkWebhookSignatureError)
  })

  it('verifies signature byte-for-byte using HMAC-SHA256 over the raw body string', () => {
    // Verify that the exact raw body content is used — not parsed/re-serialized JSON
    const bodyWithSpaces = '{ "foo" : "bar" }'
    const sig = makeSignature(bodyWithSpaces, SECRET)
    // Same raw body → passes
    expect(() => {
      verifyWebhookSignature(bodyWithSpaces, sig, SECRET)
    }).not.toThrow()
    // Different serialization of same JSON → fails
    const reserializedBody = '{"foo":"bar"}'
    expect(() => {
      verifyWebhookSignature(reserializedBody, sig, SECRET)
    }).toThrow(ChatworkWebhookSignatureError)
  })
})
