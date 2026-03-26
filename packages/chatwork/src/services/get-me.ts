import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { ChatworkMe } from '~/types/message'

export async function getMe(token: string): Promise<ChatworkMe> {
  return chatworkApiClient.getMe(token)
}
