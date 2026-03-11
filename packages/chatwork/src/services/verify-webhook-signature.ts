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

  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')

  let expectedBuf: Buffer
  let actualBuf: Buffer

  try {
    expectedBuf = Buffer.from(expected, 'base64')
    actualBuf = Buffer.from(signature, 'base64')
  } catch {
    throw new ChatworkWebhookSignatureError('Malformed signature encoding')
  }

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new ChatworkWebhookSignatureError()
  }
}
