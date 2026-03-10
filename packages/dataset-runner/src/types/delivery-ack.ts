export interface DeliveryAckPayload {
  sourceMessageId: string
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  ackedAt: string
}
