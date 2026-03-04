export interface ChatworkAccount {
  account_id: number
  name: string
  avatar_image_url: string
}

export interface ChatworkRoom {
  room_id: number
}

export interface ChatworkMessageBody {
  message_id: string
  account: ChatworkAccount
  body: string
  send_time: number
  update_time: number
}

export interface ChatworkWebhookEvent {
  webhook_setting_id: string
  webhook_event_type: string
  webhook_event_time: number
  webhook_event: {
    message_id?: string
    room_id?: number
    account_id?: number
    body?: string
    send_time?: number
    update_time?: number
    from_account_id?: number
    to_account_id?: number
  }
}

export interface ChatworkMessageEvent extends ChatworkWebhookEvent {
  webhook_event_type: 'message_created'
  webhook_event: {
    message_id: string
    room_id: number
    account_id: number
    body: string
    send_time: number
    update_time: number
  }
}

export function isChatworkMessageEvent(event: ChatworkWebhookEvent): event is ChatworkMessageEvent {
  return (
    event.webhook_event_type === 'message_created' &&
    typeof event.webhook_event.room_id === 'number' &&
    typeof event.webhook_event.account_id === 'number' &&
    typeof event.webhook_event.body === 'string'
  )
}

export interface ChatworkRoomDetail {
  room_id: number
  name: string
  type: string
  icon_path: string
  member_count?: number
}

export interface ChatworkSendMessageResponse {
  message_id: string
}
