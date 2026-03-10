import { describe, it, expect } from 'bun:test'
import type { ILLMExecutor, PromptPair, ISchema } from './llm-executor'

describe('ILLMExecutor types', () => {
  it('ISchema is satisfied by an object with parse()', () => {
    const schema: ISchema<number> = { parse: (d: unknown) => Number(d) }
    expect(schema.parse('42')).toBe(42)
  })

  it('PromptPair has system and user fields', () => {
    const pair: PromptPair = { system: 'sys', user: 'usr' }
    expect(pair.system).toBe('sys')
    expect(pair.user).toBe('usr')
  })

  it('an object implementing ILLMExecutor is type-compatible', async () => {
    const executor: ILLMExecutor = {
      execute<T>(prompts: PromptPair, schema: ISchema<T>): Promise<T> {
        return Promise.resolve(schema.parse({ x: 1 }))
      },
    }
    const result = await executor.execute(
      { system: 'sys', user: 'usr' },
      { parse: (d: unknown) => d as { x: number } },
    )
    expect(result.x).toBe(1)
  })
})
