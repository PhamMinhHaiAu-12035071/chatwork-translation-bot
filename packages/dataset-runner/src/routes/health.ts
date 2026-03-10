import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'dataset-runner:health' }).get('/health', () => ({
  ok: true,
}))
