export interface ChatworkMember {
  account_id: number
  role: string
  name: string
  chatwork_id: string
  organization_id: number
  organization_name: string
  department: string
  avatar_image_url: string
}

export interface ChatworkMessage {
  message_id: string
  account: {
    account_id: number
    name: string
    avatar_image_url: string
  }
  body: string
  send_time: number
  update_time: number
}

export interface ChatworkSendMessageResult {
  message_id: string
}
