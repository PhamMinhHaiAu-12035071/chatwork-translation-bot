import { describe, expect, it } from 'bun:test'
import type { ChatworkMember, ChatworkMessage, ChatworkSendMessageResult } from './message'

describe('ChatworkMember type', () => {
  it('accepts a valid member shape', () => {
    const member: ChatworkMember = {
      account_id: 123,
      role: 'member',
      name: 'Test User',
      chatwork_id: 'testuser',
      organization_id: 456,
      organization_name: 'Test Org',
      department: 'Engineering',
      avatar_image_url: 'https://example.com/avatar.jpg',
    }
    expect(member.account_id).toBe(123)
    expect(member.name).toBe('Test User')
  })
})

describe('ChatworkMessage type', () => {
  it('accepts a valid message shape', () => {
    const message: ChatworkMessage = {
      message_id: 'msg-001',
      account: {
        account_id: 123,
        name: 'Sender',
        avatar_image_url: 'https://example.com/avatar.jpg',
      },
      body: 'Hello world',
      send_time: 1710000000,
      update_time: 0,
    }
    expect(message.message_id).toBe('msg-001')
    expect(message.body).toBe('Hello world')
  })
})

describe('ChatworkSendMessageResult type', () => {
  it('accepts a valid send result shape', () => {
    const result: ChatworkSendMessageResult = {
      message_id: '12345',
    }
    expect(result.message_id).toBe('12345')
  })
})
