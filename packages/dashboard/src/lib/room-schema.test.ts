import { describe, expect, it } from 'bun:test'

describe('room schema', () => {
  it('requires webhookSecret when validating the create payload', async () => {
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
      webhookSecret: 'cw-secret-demo',
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
    expect(invalidResult.error?.flatten().fieldErrors.webhookSecret).toContain(
      'Webhook secret is required',
    )
  })

  it('allows blank secrets on the edit schema so unchanged values can be preserved', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    const result = schemaModule.roomEditSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: '',
      translationStyle: 'AUTO_CONTEXT',
      aiApiToken: '',
      webhookSecret: '',
    })

    expect(result.success).toBe(true)
  })

  it('removes the old webhook activation schema export', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    expect('webhookActivationSchema' in schemaModule).toBe(false)
  })
})
