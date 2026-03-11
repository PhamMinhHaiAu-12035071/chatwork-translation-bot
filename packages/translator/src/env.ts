import { parseTranslatorEnv } from './env-schema'

export function parseEnv(input: NodeJS.ProcessEnv) {
  return parseTranslatorEnv(input)
}

export const env = parseTranslatorEnv(process.env)
export type Env = ReturnType<typeof parseTranslatorEnv>
