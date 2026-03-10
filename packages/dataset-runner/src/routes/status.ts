import { Elysia } from 'elysia'

export function createStatusRoutes(getStatus: () => unknown) {
  return new Elysia({ name: 'dataset-runner:status' }).get('/status', () => getStatus())
}
