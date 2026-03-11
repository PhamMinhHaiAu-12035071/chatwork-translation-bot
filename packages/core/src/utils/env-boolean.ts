import { z } from 'zod'

function normalizeBooleanFromEnv(value: unknown): unknown {
  if (typeof value === 'boolean') return value

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === '') return undefined
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }

  return value
}

export function strictBooleanFromEnv(defaultValue?: boolean) {
  const parser = z.boolean({
    message: 'Expected boolean env value (true/false/1/0)',
  })

  if (defaultValue === undefined) {
    return z.preprocess(normalizeBooleanFromEnv, parser)
  }

  return z.preprocess(normalizeBooleanFromEnv, parser.optional().default(defaultValue))
}
