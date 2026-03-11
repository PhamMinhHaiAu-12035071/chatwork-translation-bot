export class ChatworkWebhookSignatureError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message)
    this.name = 'ChatworkWebhookSignatureError'
  }
}
