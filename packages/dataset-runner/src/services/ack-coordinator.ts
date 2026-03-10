import type { DeliveryAckRecord } from '~/services/ack-store'

export class AckCoordinator {
  private readonly waiters = new Map<string, (ack: DeliveryAckRecord) => void>()

  waitForAck(sourceMessageId: string, timeoutMs: number): Promise<DeliveryAckRecord> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(sourceMessageId)
        reject(new Error(`ACK timeout for ${sourceMessageId}`))
      }, timeoutMs)

      this.waiters.set(sourceMessageId, (ack) => {
        clearTimeout(timer)
        this.waiters.delete(sourceMessageId)
        resolve(ack)
      })
    })
  }

  notify(ack: DeliveryAckRecord): void {
    this.waiters.get(ack.sourceMessageId)?.(ack)
  }
}
