export interface ChatworkClientConfig {
  apiToken: string
  baseUrl?: string
}

export interface SendMessageParams {
  roomId: number
  message: string
  unread?: boolean
}

export interface IChatworkClient {
  sendMessage(params: SendMessageParams): Promise<{ message_id: string }>
}
