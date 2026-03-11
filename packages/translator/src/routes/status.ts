import { Elysia } from 'elysia'
import type { TranslatorStatusSnapshot } from '~/types/observability'

export function createStatusRoute(getStatus: () => TranslatorStatusSnapshot) {
  return new Elysia({ name: 'translator:status' }).get('/status', () => getStatus())
}
