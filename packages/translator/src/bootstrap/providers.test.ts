import { describe, expect, it } from 'bun:test'

describe('provider package resolution', () => {
  it('can import @chatwork-bot/provider-gemini', async () => {
    const mod = await import('@chatwork-bot/provider-gemini')
    expect(mod).toBeDefined()
  })

  it('can import @chatwork-bot/provider-openai', async () => {
    const mod = await import('@chatwork-bot/provider-openai')
    expect(mod).toBeDefined()
  })

  it('can import @chatwork-bot/provider-cursor', async () => {
    const mod = await import('@chatwork-bot/provider-cursor')
    expect(mod).toBeDefined()
  })
})
