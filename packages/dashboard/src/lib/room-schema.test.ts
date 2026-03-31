import { describe, expect, it } from 'bun:test'

const removedWebhookActivationSchema = ['webhook', 'Activation', 'Schema'].join('')

describe('room schema', () => {
  it('requires aiApiToken when validating the create payload', async () => {
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
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-demo',
    })

    expect(validResult.success).toBe(true)

    const invalidResult = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 0,
      destinationRoomName: '',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
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

  it('allows blank aiApiToken on the edit schema so unchanged values can be preserved', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    const result = schemaModule.roomEditSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-5.4',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: '',
    })

    expect(result.success).toBe(true)
  })

  it('removes the old webhook activation schema export', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)

    expect(schemaModule).not.toBeNull()
    if (!schemaModule) {
      return
    }

    expect(removedWebhookActivationSchema in schemaModule).toBe(false)
  })

  it('allows context up to 500 characters on create schema', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)
    if (!schemaModule) return

    const valid = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-demo',
      context: 'Room type: Internal team.',
    })
    expect(valid.success).toBe(true)

    const tooLong = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-demo',
      context: 'a'.repeat(501),
    })
    expect(tooLong.success).toBe(false)
    expect(tooLong.error?.flatten().fieldErrors.context?.[0]).toMatch(/500/)
  })

  it('allows context to be omitted on create schema (defaults to empty string)', async () => {
    const schemaModule = await import('~/lib/room-schema').catch(() => null)
    if (!schemaModule) return

    const result = schemaModule.roomCreateSchema.safeParse({
      originalRoomId: 123456,
      destinationRoomName: 'Tokyo Support',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-demo',
    })
    expect(result.success).toBe(true)
    expect(result.data?.context).toBe('')
  })
})
