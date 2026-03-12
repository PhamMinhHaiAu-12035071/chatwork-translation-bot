import { createHmac, timingSafeEqual } from 'node:crypto'
import { ChatworkWebhookSignatureError } from '~/errors/chatwork-webhook-signature-error'

export interface VerifyWebhookSignatureOptions {
  skip?: boolean
  env?: string
}

/**
 * Verifies the Chatwork webhook HMAC-SHA256 signature.
 *
 * Throws `ChatworkWebhookSignatureError` if the signature does not match.
 * Bypasses verification only when `options.skip = true` AND `options.env !== 'production'`.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  options?: VerifyWebhookSignatureOptions,
): void {
  // Skip is only honored in non-production environments
  if (options?.skip === true && options.env !== 'production') {
    return
  }

  // Chatwork webhook token is a base64-encoded binary key — decode to raw bytes before use
  const secretBytes = Buffer.from(secret, 'base64')
  const expected = createHmac('sha256', secretBytes).update(rawBody).digest('base64')

  const expectedBuf = Buffer.from(expected, 'base64')
  const actualBuf = Buffer.from(signature, 'base64')

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new ChatworkWebhookSignatureError()
  }
}
