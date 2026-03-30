/** Structural duck-type for any schema with a parse() method. Zod schemas satisfy this. */
export interface ISchema<T> {
  parse(data: unknown): T
}

/** A system+user prompt pair for structured LLM calls. */
export interface PromptPair {
  system: string
  user: string
}

export interface LLMExecutionGenerationMetadata {
  temperature: number | null
  maxOutputTokens: number | null
  providerOptions: Record<string, unknown> | null
  providerManaged: boolean
}

export interface LLMExecutionMetadata {
  generation: LLMExecutionGenerationMetadata
}

/** Generic LLM execution interface — all providers implement this. */
export interface ILLMExecutor {
  execute<T>(
    prompts: PromptPair,
    schema: ISchema<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T>
  describeExecution(): LLMExecutionMetadata
}
