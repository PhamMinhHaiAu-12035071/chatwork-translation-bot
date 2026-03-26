import { describe, expect, it } from 'bun:test'

describe('room schema', () => {
  it('validates the create payload and rejects invalid room ids', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    const validResult = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: 'sk-demo',
    })

    expect(validResult.success).toBe(true)

    const invalidResult = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 0,
      destinationRoomName: '',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: '',
    })

    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error?.flatten().fieldErrors.originalRoomId).toContain(
      'Room ID must be positive',
    )
    expect(invalidResult.error?.flatten().fieldErrors.destinationRoomName).toContain(
      'Destination room name is required',
    )
    expect(invalidResult.error?.flatten().fieldErrors.aiApiToken).toContain(
      'AI API token is required',
    )
  })

  it('requires a webhook token for activation', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    expect(
      schemaModule.webhookActivationSchema.safeParse({
        webhookToken: '',
      }).success,
    ).toBe(false)
    expect(
      schemaModule.webhookActivationSchema.safeParse({
        webhookToken: 'cw-token-123',
      }).success,
    ).toBe(true)
  })
})
