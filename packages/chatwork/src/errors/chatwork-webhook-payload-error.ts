export class ChatworkWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatworkWebhookPayloadError'
  }
}
