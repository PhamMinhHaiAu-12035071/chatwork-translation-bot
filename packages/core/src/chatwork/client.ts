import type { ChatworkSendMessageResponse, ChatworkMember } from '../types/chatwork'
import type {
  IChatworkClient,
  ChatworkClientConfig,
  SendMessageParams,
} from '../interfaces/chatwork'

const DEFAULT_BASE_URL = 'https://api.chatwork.com/v2'

export class ChatworkClient implements IChatworkClient {
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(config: ChatworkClientConfig) {
    this.apiToken = config.apiToken
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  }

  async sendMessage({
    roomId,
    message,
    unread = false,
  }: SendMessageParams): Promise<ChatworkSendMessageResponse> {
    const url = `${this.baseUrl}/rooms/${roomId.toString()}/messages`

    const body = new URLSearchParams({
      body: message,
      self_unread: unread ? '1' : '0',
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': this.apiToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Chatwork API error: ${response.status.toString()} ${response.statusText} - ${errorText}`,
      )
    }

    return (await response.json()) as ChatworkSendMessageResponse
  }

  async getMembers(roomId: number): Promise<ChatworkMember[]> {
    const url = `${this.baseUrl}/rooms/${roomId.toString()}/members`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-ChatWorkToken': this.apiToken,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Chatwork API error: ${response.status.toString()} ${response.statusText} - ${errorText}`,
      )
    }

    return (await response.json()) as ChatworkMember[]
  }
}
